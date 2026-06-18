"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  CONFIDENCE_LABEL,
  CONFIDENCE_OPTIONS,
  type Confidence,
  type Slide,
} from "@/lib/deck-content";
import { cn } from "@/lib/utils";

type EditableValue = string | number | string[];
type FieldType = "text" | "textarea" | "number" | "list" | "confidence";

interface FieldSpec<T> {
  key: Extract<keyof T, string>;
  label: string;
  type?: FieldType;
}

const INPUT =
  "w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-ink-faint";
const LABEL = "font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint";

// ── Field atoms ───────────────────────────────────────────────────────────────

function TextField({
  label,
  value,
  onChange,
  area = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      {area ? (
        <textarea
          className={cn(INPUT, "min-h-[64px] resize-y leading-snug")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <input
        type="number"
        className={INPUT}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </label>
  );
}

function ConfidenceSelect({
  label = "Confidence",
  value,
  onChange,
}: {
  label?: string;
  value: Confidence;
  onChange: (v: Confidence) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL}>{label}</span>
      <select
        className={cn(INPUT, "cursor-pointer")}
        value={value}
        onChange={(e) => onChange(e.target.value as Confidence)}
      >
        {CONFIDENCE_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {CONFIDENCE_LABEL[c]}
          </option>
        ))}
      </select>
    </label>
  );
}

function StringListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={INPUT}
            value={it}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <IconButton label="Remove item" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ""])}>Add item</AddButton>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function AddButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
    >
      <Plus className="h-3 w-3" />
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">{title}</h4>
      {children}
    </section>
  );
}

// ── Generic array-of-objects editor ───────────────────────────────────────────

function ObjectListEditor<T>({
  title,
  items,
  fields,
  make,
  onChange,
}: {
  title: string;
  items: T[];
  fields: FieldSpec<T>[];
  make: () => T;
  onChange: (items: T[]) => void;
}) {
  function update(idx: number, key: string, val: EditableValue) {
    const next = items.map((it, i) =>
      i === idx
        ? ({ ...(it as Record<string, EditableValue>), [key]: val } as unknown as T)
        : it,
    );
    onChange(next);
  }

  return (
    <Section title={title}>
      {items.map((item, idx) => {
        const rec = item as unknown as Record<string, unknown>;
        return (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-lg border border-line bg-sand/30 p-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-ink-faint">#{idx + 1}</span>
              <IconButton
                label="Remove entry"
                onClick={() => onChange(items.filter((_, j) => j !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
            {fields.map((f) => {
              const raw = rec[f.key];
              if (f.type === "list") {
                return (
                  <StringListEditor
                    key={f.key}
                    label={f.label}
                    items={(raw as string[]) ?? []}
                    onChange={(v) => update(idx, f.key, v)}
                  />
                );
              }
              if (f.type === "number") {
                return (
                  <NumberField
                    key={f.key}
                    label={f.label}
                    value={Number(raw ?? 0)}
                    onChange={(v) => update(idx, f.key, v)}
                  />
                );
              }
              if (f.type === "confidence") {
                return (
                  <ConfidenceSelect
                    key={f.key}
                    label={f.label}
                    value={(raw as Confidence) ?? "assumption"}
                    onChange={(v) => update(idx, f.key, v)}
                  />
                );
              }
              return (
                <TextField
                  key={f.key}
                  label={f.label}
                  area={f.type === "textarea"}
                  value={String(raw ?? "")}
                  onChange={(v) => update(idx, f.key, v)}
                />
              );
            })}
          </div>
        );
      })}
      <AddButton onClick={() => onChange([...items, make()])}>Add</AddButton>
    </Section>
  );
}

// ── The panel ──────────────────────────────────────────────────────────────────

export function EditPanel({
  slide,
  onChange,
}: {
  slide: Slide;
  onChange: (slide: Slide) => void;
}) {
  const set = (patch: Partial<Slide>) => onChange({ ...slide, ...patch });

  const updateFounder = (fi: number, patch: Partial<NonNullable<Slide["founders"]>[number]>) =>
    set({ founders: slide.founders!.map((f, i) => (i === fi ? { ...f, ...patch } : f)) });

  return (
    <div className="flex flex-col gap-4 text-ink">
      {/* Common copy */}
      <section className="flex flex-col gap-2">
        {slide.eyebrow !== undefined ? (
          <TextField label="Eyebrow" value={slide.eyebrow} onChange={(v) => set({ eyebrow: v })} />
        ) : null}
        <TextField label="Title" value={slide.title} onChange={(v) => set({ title: v })} />
        {slide.subtitle !== undefined ? (
          <TextField area label="Subtitle" value={slide.subtitle} onChange={(v) => set({ subtitle: v })} />
        ) : null}
        {slide.lead !== undefined ? (
          <TextField area label="Lead paragraph" value={slide.lead} onChange={(v) => set({ lead: v })} />
        ) : null}
      </section>

      {slide.bullets ? (
        <ObjectListEditor
          title="Bullets"
          items={slide.bullets}
          fields={[
            { key: "text", label: "Text" },
            { key: "sub", label: "Sub-text", type: "textarea" },
          ]}
          make={() => ({ text: "", sub: "" })}
          onChange={(bullets) => set({ bullets })}
        />
      ) : null}

      {slide.metrics ? (
        <ObjectListEditor
          title="Metrics"
          items={slide.metrics}
          fields={[
            { key: "value", label: "Value" },
            { key: "label", label: "Label" },
            { key: "sub", label: "Sub" },
            { key: "confidence", label: "Confidence", type: "confidence" },
          ]}
          make={() => ({ value: "", label: "", confidence: "assumption" as Confidence })}
          onChange={(metrics) => set({ metrics })}
        />
      ) : null}

      {slide.kind === "listing" ? (
        <>
          <Section title="Listing photo">
            <TextField
              label="Image URL (blank = house placeholder)"
              value={slide.imageSrc ?? ""}
              onChange={(v) => set({ imageSrc: v })}
            />
            <TextField
              label="Image alt text"
              value={slide.imageAlt ?? ""}
              onChange={(v) => set({ imageAlt: v })}
            />
          </Section>
          <Section title="Listing details">
            <TextField label="Price" value={slide.price ?? ""} onChange={(v) => set({ price: v })} />
            <TextField
              label="Address"
              value={slide.address ?? ""}
              onChange={(v) => set({ address: v })}
            />
          </Section>
          <ObjectListEditor
            title="Specs (reveal in order)"
            items={slide.specs ?? []}
            fields={[
              { key: "value", label: "Value" },
              { key: "label", label: "Label" },
            ]}
            make={() => ({ value: "", label: "" })}
            onChange={(specs) => set({ specs })}
          />
        </>
      ) : null}

      {slide.founders ? (
        <Section title="Founders">
          {slide.founders.map((f, fi) => (
            <div key={fi} className="flex flex-col gap-2 rounded-lg border border-line bg-sand/30 p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-ink-faint">#{fi + 1}</span>
                <IconButton
                  label="Remove founder"
                  onClick={() => set({ founders: slide.founders!.filter((_, i) => i !== fi) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              <TextField label="Name" value={f.name} onChange={(v) => updateFounder(fi, { name: v })} />
              <TextField label="Role" value={f.role} onChange={(v) => updateFounder(fi, { role: v })} />
              <TextField
                label="Photo URL (blank = initials)"
                value={f.photo ?? ""}
                onChange={(v) => updateFounder(fi, { photo: v })}
              />
              <ObjectListEditor
                title="Points (with image of what you did)"
                items={f.points}
                fields={[
                  { key: "text", label: "Point", type: "textarea" },
                  { key: "imageSrc", label: "Image URL (blank = placeholder)" },
                ]}
                make={() => ({ text: "", imageSrc: "" })}
                onChange={(points) => updateFounder(fi, { points })}
              />
            </div>
          ))}
          <AddButton
            onClick={() =>
              set({ founders: [...slide.founders!, { name: "", role: "", photo: "", points: [] }] })
            }
          >
            Add founder
          </AddButton>
        </Section>
      ) : null}

      {slide.story ? (
        <>
          <ObjectListEditor
            title="Story beats"
            items={slide.story.beats}
            fields={[
              { key: "signal", label: "Signal" },
              { key: "detail", label: "Detail", type: "textarea" },
              { key: "source", label: "Source" },
            ]}
            make={() => ({ signal: "", detail: "", source: "" })}
            onChange={(beats) => set({ story: { ...slide.story!, beats } })}
          />
          <Section title="Story outcome">
            <TextField
              area
              label="Outcome"
              value={slide.story.outcome}
              onChange={(v) => set({ story: { ...slide.story!, outcome: v } })}
            />
          </Section>
        </>
      ) : null}

      {slide.comparison ? (
        <>
          <Section title="Comparison headers">
            <TextField
              label="Left column title"
              value={slide.comparison.leftTitle}
              onChange={(v) => set({ comparison: { ...slide.comparison!, leftTitle: v } })}
            />
            <TextField
              label="Right column title"
              value={slide.comparison.rightTitle}
              onChange={(v) => set({ comparison: { ...slide.comparison!, rightTitle: v } })}
            />
          </Section>
          <ObjectListEditor
            title="Comparison rows"
            items={slide.comparison.rows}
            fields={[
              { key: "label", label: "Label" },
              { key: "left", label: "Left" },
              { key: "right", label: "Right" },
            ]}
            make={() => ({ label: "", left: "", right: "" })}
            onChange={(rows) => set({ comparison: { ...slide.comparison!, rows } })}
          />
        </>
      ) : null}

      {slide.flow ? (
        <ObjectListEditor
          title="Flow steps"
          items={slide.flow}
          fields={[
            { key: "label", label: "Label" },
            { key: "detail", label: "Detail", type: "textarea" },
          ]}
          make={() => ({ label: "", detail: "" })}
          onChange={(flow) => set({ flow })}
        />
      ) : null}

      {slide.verdict ? (
        <Section title="Verdict">
          <TextField
            label="Verdict label"
            value={slide.verdict.label}
            onChange={(v) => set({ verdict: { ...slide.verdict!, label: v } })}
          />
          <TextField
            area
            label="Verdict detail"
            value={slide.verdict.sub}
            onChange={(v) => set({ verdict: { ...slide.verdict!, sub: v } })}
          />
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Tone</span>
            <select
              className={cn(INPUT, "cursor-pointer")}
              value={slide.verdict.tone}
              onChange={(e) =>
                set({ verdict: { ...slide.verdict!, tone: e.target.value as "buy" | "pass" } })
              }
            >
              <option value="buy">buy</option>
              <option value="pass">pass</option>
            </select>
          </label>
        </Section>
      ) : null}

      {slide.agents ? (
        <ObjectListEditor
          title="Agents"
          items={slide.agents}
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role", type: "textarea" },
          ]}
          make={() => ({ name: "", role: "" })}
          onChange={(agents) => set({ agents })}
        />
      ) : null}

      {slide.market ? (
        <Section title="Market tiers (TAM / SAM / SOM)">
          {slide.market.map((tier, ti) => (
            <div key={tier.key} className="flex flex-col gap-2 rounded-lg border border-line bg-sand/30 p-2.5">
              <div className="font-mono text-[10px] font-medium tracking-[0.12em] text-ink">{tier.key}</div>
              <TextField
                label="Label"
                value={tier.label}
                onChange={(v) =>
                  set({ market: slide.market!.map((t, i) => (i === ti ? { ...t, label: v } : t)) })
                }
              />
              <TextField
                area
                label="Formula"
                value={tier.formula}
                onChange={(v) =>
                  set({ market: slide.market!.map((t, i) => (i === ti ? { ...t, formula: v } : t)) })
                }
              />
              <TextField
                area
                label="Note"
                value={tier.note}
                onChange={(v) =>
                  set({ market: slide.market!.map((t, i) => (i === ti ? { ...t, note: v } : t)) })
                }
              />
              <ConfidenceSelect
                label="Tier confidence"
                value={tier.confidence}
                onChange={(v) =>
                  set({ market: slide.market!.map((t, i) => (i === ti ? { ...t, confidence: v } : t)) })
                }
              />
              <ObjectListEditor
                title="Variables (multiplicands)"
                items={tier.variables}
                fields={[
                  { key: "name", label: "Name" },
                  { key: "value", label: "Value", type: "number" },
                  { key: "unit", label: "Unit (use $/yr for money)" },
                  { key: "confidence", label: "Confidence", type: "confidence" },
                  { key: "citation", label: "Citation / assumption", type: "textarea" },
                ]}
                make={() => ({
                  name: "",
                  value: 0,
                  unit: "",
                  confidence: "needs-validation" as Confidence,
                  citation: "[TODO: add source]",
                })}
                onChange={(variables) =>
                  set({ market: slide.market!.map((t, i) => (i === ti ? { ...t, variables } : t)) })
                }
              />
            </div>
          ))}
        </Section>
      ) : null}

      {slide.principles ? (
        <ObjectListEditor
          title="Principles"
          items={slide.principles}
          fields={[
            { key: "title", label: "Title" },
            { key: "detail", label: "Detail", type: "textarea" },
          ]}
          make={() => ({ title: "", detail: "" })}
          onChange={(principles) => set({ principles })}
        />
      ) : null}

      {slide.segments ? (
        <ObjectListEditor
          title="Segments"
          items={slide.segments}
          fields={[
            { key: "name", label: "Name" },
            { key: "tag", label: "Tag (Wedge / Expansion / Enterprise)" },
            { key: "detail", label: "Detail", type: "textarea" },
            { key: "uses", label: "Use cases", type: "list" },
          ]}
          make={() => ({ name: "", tag: "Expansion", detail: "", uses: [] })}
          onChange={(segments) => set({ segments })}
        />
      ) : null}

      {slide.tiers ? (
        <ObjectListEditor
          title="Pricing tiers"
          items={slide.tiers}
          fields={[
            { key: "name", label: "Name" },
            { key: "price", label: "Price" },
            { key: "who", label: "Who" },
            { key: "features", label: "Features", type: "list" },
          ]}
          make={() => ({ name: "", price: "", who: "", features: [] })}
          onChange={(tiers) => set({ tiers })}
        />
      ) : null}

      {slide.partners ? (
        <ObjectListEditor
          title="Partners"
          items={slide.partners}
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role", type: "textarea" },
          ]}
          make={() => ({ name: "", role: "" })}
          onChange={(partners) => set({ partners })}
        />
      ) : null}

      {slide.privacy ? (
        <Section title="Privacy & data rights">
          <StringListEditor label="Points" items={slide.privacy} onChange={(privacy) => set({ privacy })} />
        </Section>
      ) : null}

      {slide.team ? (
        <ObjectListEditor
          title="Team members"
          items={slide.team}
          fields={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "background", label: "Background", type: "textarea" },
          ]}
          make={() => ({ name: "[Name]", role: "[Role]", background: "[Background]" })}
          onChange={(team) => set({ team })}
        />
      ) : null}

      {slide.research ? (
        <Section title="Research & evidence">
          <StringListEditor label="Items" items={slide.research} onChange={(research) => set({ research })} />
        </Section>
      ) : null}

      {slide.milestones ? (
        <ObjectListEditor
          title="Milestones"
          items={slide.milestones}
          fields={[
            { key: "period", label: "Period" },
            { key: "title", label: "Title" },
            { key: "detail", label: "Detail", type: "textarea" },
          ]}
          make={() => ({ period: "", title: "", detail: "" })}
          onChange={(milestones) => set({ milestones })}
        />
      ) : null}

      {slide.ask ? (
        <>
          <Section title="Ask">
            <TextField
              label="Raising"
              value={slide.ask.raising}
              onChange={(v) => set({ ask: { ...slide.ask!, raising: v } })}
            />
            <TextField
              area
              label="Milestone"
              value={slide.ask.milestone}
              onChange={(v) => set({ ask: { ...slide.ask!, milestone: v } })}
            />
            <TextField
              label="Contact"
              value={slide.ask.contact}
              onChange={(v) => set({ ask: { ...slide.ask!, contact: v } })}
            />
          </Section>
          <ObjectListEditor
            title="Use of funds"
            items={slide.ask.useOfFunds}
            fields={[
              { key: "label", label: "Label" },
              { key: "detail", label: "Detail", type: "textarea" },
            ]}
            make={() => ({ label: "", detail: "" })}
            onChange={(useOfFunds) => set({ ask: { ...slide.ask!, useOfFunds } })}
          />
        </>
      ) : null}

      {/* Speaker notes — present on every slide */}
      <Section title="Speaker notes">
        <TextField
          area
          label="Notes (presenter only)"
          value={slide.notes ?? ""}
          onChange={(v) => set({ notes: v })}
        />
      </Section>
    </div>
  );
}
