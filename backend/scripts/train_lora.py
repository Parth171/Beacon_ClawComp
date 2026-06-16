"""LoRA fine-tune Qwen2.5-VL on the wall-damage dataset (Agent 3 enhancement).

QLoRA-style training: the base 4-bit weights stay FROZEN; only lightweight LoRA
adapters on the language-model attention projections (q_proj, k_proj, v_proj,
o_proj) are trained. The result is a small, swappable adapter that
``MLXVisionClient`` layers on top of the base model at inference time when
``BEACON_VISION_ADAPTER_PATH`` points at it — the rest of Agent 3's contract
is unchanged.

Dataset: ``Francesco/wall-damage`` (HF) — an object-detection set of wall photos
labelled wall-damage / Minor / Moderate / Severe rotation. Each image is turned
into a single-turn instruction example (see ``test.py`` for raw access):

    user:      Analyze this property image and identify any visible defects.
    assistant: Visible severe wall rotation and structural displacement.
               Estimated severity: Severe. Recommend immediate structural inspection.

Deliverable: ``trained_lora/`` containing ``adapter_config.json`` +
``adapters.safetensors``.

Usage (must use the MLX venv):
    cd backend
    .venv-mlx/bin/python scripts/train_lora.py
    .venv-mlx/bin/python scripts/train_lora.py --epochs 2 --batch-size 1
    .venv-mlx/bin/python scripts/train_lora.py --iters 200 --output-dir ../trained_lora
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("train_lora")

# The plan targets only the attention projections — keeps the adapter tiny and
# leaves MLP/vision weights untouched.
LORA_TARGET_MODULES = ["q_proj", "k_proj", "v_proj", "o_proj"]

# Fallback if the dataset's ClassLabel names can't be read. Order matters only as
# a lookup; severity ranking is defined separately below.
DEFAULT_CATEGORY_NAMES = [
    "wall-damage",
    "Minorrotation",
    "Moderaterotation",
    "Severerotation",
]

# category name -> (foundationRisk, renovationScore, flag issue, confidence).
# The adapter is trained to emit the SAME per-image JSON the inspection agent asks
# for at inference, so it sharpens wall/foundation defect reads without fighting the
# output format. (The previous free-text answers taught the model to emit prose and
# broke JSON generation entirely.)
CATEGORY_RISK = {
    "wall-damage": (0.65, 45, "wall cracking", 0.70),
    "Minorrotation": (0.40, 65, "minor wall rotation / tilt", 0.55),
    "Moderaterotation": (0.65, 45, "moderate wall rotation", 0.72),
    "Severerotation": (0.88, 25, "severe wall rotation / structural displacement", 0.90),
}
_SEVERITY_RANK = {"Minorrotation": 1, "wall-damage": 2, "Moderaterotation": 2, "Severerotation": 3}


def _category_names(dataset) -> list[str]:
    """Best-effort read of the object-detection ClassLabel names."""
    try:
        return list(dataset.features["objects"].feature["category"].feature.names)
    except Exception:  # noqa: BLE001 - schema drift; fall back to known names
        return DEFAULT_CATEGORY_NAMES


def _inference_question() -> str:
    """The exact user prompt the inspection agent sends at inference, so the adapter
    trains on the same prompt distribution it sees in production."""
    import json as _json

    from app.agents.inspection import PROMPT
    from app.models.inspection import PER_IMAGE_SCHEMA
    from app.services.inference.base import schema_hint

    return (
        f"{PROMPT}\n\nRespond with ONLY a JSON object of exactly this shape, "
        f"replacing each <placeholder> with a real value:\n"
        f"{_json.dumps(schema_hint(PER_IMAGE_SCHEMA))}"
    )


def _json_answer(category_ids: list[int], names: list[str]) -> str:
    """A valid PER_IMAGE_SCHEMA JSON describing the worst wall defect in the image."""
    import json as _json

    worst = None
    for cid in category_ids:
        name = names[cid] if 0 <= cid < len(names) else None
        if name in CATEGORY_RISK and (
            worst is None or _SEVERITY_RANK.get(name, 0) > _SEVERITY_RANK.get(worst, 0)
        ):
            worst = name

    obj = {
        "roofRisk": 0.0,
        "waterRisk": 0.0,
        "foundationRisk": 0.0,
        "electricalRisk": 0.0,
        "renovationScore": 70,
        "flags": [],
    }
    if worst is not None:
        found, renov, issue, conf = CATEGORY_RISK[worst]
        obj["foundationRisk"] = found
        obj["renovationScore"] = renov
        obj["flags"] = [
            {"issue": issue, "location": "wall", "reason": f"visible {issue}", "confidence": conf}
        ]
    return _json.dumps(obj)


def build_instruction_dataset(dataset_name: str, split: str):
    """Load the wall-damage set and map it to image + single-turn JSON messages."""
    from datasets import load_dataset

    logger.info("Loading dataset %s (split=%s)", dataset_name, split)
    ds = load_dataset(dataset_name, split=split)
    names = _category_names(ds)
    logger.info("Categories: %s", names)
    question = _inference_question()

    def to_example(example):
        category_ids = (example.get("objects") or {}).get("category") or []
        return {
            "messages": [
                {"role": "user", "content": question},
                {"role": "assistant", "content": _json_answer(category_ids, names)},
            ]
        }

    # Drop detection columns we no longer need; keep `image` for the VLM.
    remove = [c for c in ds.column_names if c not in ("image",)]
    ds = ds.map(to_example, remove_columns=remove)
    logger.info("Built %d instruction examples", len(ds))
    return ds


def _make_rope_differentiable(model) -> int:
    """Force MRoPE off its fused Metal kernel onto the pure-mlx fallback.

    The fused multimodal-RoPE path is a hand-written mx.fast.metal_kernel
    (a CustomKernel) with no vjp, so backprop through q_proj/k_proj LoRA dies on
    it. Setting fused_apply=False routes apply_rotary through the differentiable
    _apply_*_rotary_pos_emb path instead. Inference is unaffected (we never train
    in-process). Returns the number of modules switched.
    """
    switched = 0
    for _, module in model.named_modules():
        if hasattr(module, "fused_apply") and getattr(module, "fused_apply"):
            module.fused_apply = False
            switched += 1
    return switched


def _stop_grad_vision_tower(model) -> None:
    """Wrap the model's vision-tower forward so its output is stop_gradient'd."""
    import mlx.core as mx

    tower = getattr(model, "vision_tower", None)
    if tower is None:
        return
    cls = type(tower)
    if getattr(cls, "_beacon_stop_grad", False):
        return
    orig_call = cls.__call__

    def patched(self, *a, __orig=orig_call, **k):
        return mx.stop_gradient(__orig(self, *a, **k))

    cls.__call__ = patched
    cls._beacon_stop_grad = True
    logger.info("Vision tower output detached (frozen, non-differentiable SDPA).")


def main() -> None:
    parser = argparse.ArgumentParser(description="LoRA fine-tune Qwen2.5-VL for Agent 3")
    parser.add_argument(
        "--model-path",
        default=None,
        help="Base VLM (default: Beacon vision_model setting).",
    )
    parser.add_argument("--dataset", default="Francesco/wall-damage")
    parser.add_argument("--split", default="train")
    parser.add_argument(
        "--output-dir",
        default=str(REPO_ROOT / "trained_lora"),
        help="Directory for adapter_config.json + adapters.safetensors.",
    )
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument(
        "--iters",
        type=int,
        default=None,
        help="Override epoch-derived iteration count.",
    )
    parser.add_argument("--batch-size", type=int, default=1)
    # 2e-5 (gentle) — the old 1e-4 over-wrote the base model's general behaviour.
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--lora-rank", type=int, default=8)
    parser.add_argument("--lora-alpha", type=float, default=16.0)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument(
        "--image-resize",
        type=int,
        nargs=2,
        default=[512, 512],
        help="Resize images before training (keeps vision token count/memory sane).",
    )
    parser.add_argument("--steps-per-report", type=int, default=10)
    parser.add_argument("--steps-per-save", type=int, default=100)
    parser.add_argument(
        "--no-grad-checkpoint",
        action="store_true",
        help="Disable gradient checkpointing (faster, more memory).",
    )
    args = parser.parse_args()

    from app.core.config import get_settings

    model_path = args.model_path or get_settings().vision_model

    # All MLX/mlx-vlm training imports are lazy so --help works without the venv.
    import mlx.optimizers as optim
    from mlx_vlm.trainer.sft_trainer import TrainingArgs, train
    from mlx_vlm.trainer.datasets import VisionDataset
    from mlx_vlm.trainer.utils import (
        get_peft_model,
        not_supported_for_training,
        print_trainable_parameters,
    )
    from mlx_vlm.utils import load

    dataset = build_instruction_dataset(args.dataset, args.split)

    logger.info("Loading base model %s", model_path)
    model, processor = load(model_path, processor_config={"trust_remote_code": True})

    model_type = getattr(getattr(model, "config", None), "model_type", None)
    if model_type in not_supported_for_training:
        raise SystemExit(f"Model type {model_type} not supported for training")

    config = model.config.__dict__

    logger.info("Setting up LoRA on %s (rank=%d, alpha=%s)",
                LORA_TARGET_MODULES, args.lora_rank, args.lora_alpha)
    model = get_peft_model(
        model,
        LORA_TARGET_MODULES,
        rank=args.lora_rank,
        alpha=args.lora_alpha,
        dropout=args.lora_dropout,
        verbose=False,
    )
    print_trainable_parameters(model)

    # The frozen vision tower uses mx.fast.scaled_dot_product_attention, whose vjp
    # is unimplemented. We only train language-model LoRA, so block gradient from
    # propagating back into the vision tower (its features stay a fixed input to
    # the LM). Patch the loaded model's vision-tower class once, process-locally.
    _stop_grad_vision_tower(model)
    n_rope = _make_rope_differentiable(model)
    logger.info("Routed %d MRoPE module(s) onto the differentiable path.", n_rope)

    train_dataset = VisionDataset(
        dataset,
        config,
        processor,
        image_resize_shape=tuple(args.image_resize) if args.image_resize else None,
    )

    if args.iters is not None:
        iters = args.iters
    else:
        iters = max(1, (len(dataset) // args.batch_size)) * args.epochs
    logger.info("Training for %d iterations", iters)

    output_dir = Path(args.output_dir).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    adapter_file = output_dir / "adapters.safetensors"

    training_args = TrainingArgs(
        batch_size=args.batch_size,
        iters=iters,
        steps_per_report=args.steps_per_report,
        steps_per_eval=10**9,  # no val split wired in
        steps_per_save=args.steps_per_save,
        val_batches=0,
        max_seq_length=args.max_seq_length,
        adapter_file=str(adapter_file),
        grad_checkpoint=not args.no_grad_checkpoint,
        learning_rate=args.learning_rate,  # display only; optimizer below sets the real LR
    )

    optimizer = optim.Adam(learning_rate=args.learning_rate)

    # Train ONLY on the JSON answer, not the prompt. Without this the model learns
    # to reproduce the prompt/chat-template tokens and emits '{"user...' garbage
    # instead of answering. The mask is anchored on the assistant-turn token; Qwen
    # renders "<|im_start|>assistant", so we use the id of the word "assistant".
    tok = getattr(processor, "tokenizer", processor)
    _asst = tok.encode("assistant", add_special_tokens=False)
    assistant_id = _asst[-1] if _asst else 77091
    logger.info("train_on_completions=True; masking prompt up to assistant id %d", assistant_id)

    train(
        model=model,
        optimizer=optimizer,
        train_dataset=train_dataset,
        val_dataset=None,
        args=training_args,
        train_on_completions=True,
        assistant_id=assistant_id,
    )

    logger.info("Done. Adapter saved to %s", output_dir)
    logger.info(
        "Use it: set BEACON_VISION_ADAPTER_PATH=%s (or pass adapter_path to "
        "MLXVisionClient).",
        output_dir,
    )
    # MLX/Metal can segfault during interpreter teardown; results are already on
    # disk, so exit hard once we're here (see beacon-mlx-runtime notes).
    sys.stdout.flush()
    os._exit(0)


if __name__ == "__main__":
    main()
