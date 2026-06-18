"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Printer,
  RotateCcw,
  StickyNote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditPanel } from "@/components/deck/EditPanel";
import { Slide } from "@/components/deck/Slide";
import {
  DEFAULT_DECK,
  STORAGE_KEY,
  type Deck,
  type Slide as SlideData,
} from "@/lib/deck-content";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const cloneDefault = (): Deck =>
  typeof structuredClone === "function"
    ? structuredClone(DEFAULT_DECK)
    : (JSON.parse(JSON.stringify(DEFAULT_DECK)) as Deck);

function ToolButton({
  onClick,
  active = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
        active
          ? "border-accent bg-accent/[0.07] text-accent"
          : "border-line text-ink-muted hover:bg-sand hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function EditableDeck() {
  const [deck, setDeck] = useState<Deck>(cloneDefault);
  const [hydrated, setHydrated] = useState(false);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const reduce = useReducedMotion();

  // Load persisted edits once, after mount. This is intentionally an effect (not
  // a useState initializer) so the server and first client render both show the
  // default deck — reading localStorage during render would cause a hydration
  // mismatch. Seeding state from an external store on mount is the supported use.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Deck;
        if (parsed && Array.isArray(parsed.slides) && parsed.slides.length) {
          setDeck(parsed);
        }
      }
    } catch {
      /* corrupt storage — fall back to defaults */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist on change (only after the initial load).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [deck, hydrated]);

  const total = deck.slides.length;
  const safeIndex = Math.min(index, total - 1);
  const current = deck.slides[safeIndex];

  const goTo = useCallback(
    (next: number) => {
      setIndex((prev) => {
        const clamped = Math.max(0, Math.min(next, total - 1));
        setDir(clamped >= prev ? 1 : -1);
        return clamped;
      });
    },
    [total],
  );

  const updateSlide = useCallback(
    (slide: SlideData) => {
      setDeck((d) => ({
        ...d,
        slides: d.slides.map((s, i) => (i === safeIndex ? slide : s)),
      }));
    },
    [safeIndex],
  );

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beacon-deck.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [deck]);

  const reset = useCallback(() => {
    if (!window.confirm("Reset the deck to its default content? This discards your edits.")) return;
    setDeck(cloneDefault());
    setIndex(0);
  }, []);

  // Keyboard navigation + shortcuts (ignored while typing in the editor).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing) return;

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          goTo(safeIndex + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          goTo(safeIndex - 1);
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(total - 1);
          break;
        case "e":
        case "E":
          setEditMode((v) => !v);
          break;
        case "n":
        case "N":
          setNotesOpen((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, safeIndex, total]);

  const variants = useMemo(
    () => ({
      enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d > 0 ? 28 : -28 }),
      center: { opacity: 1, x: 0 },
      exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d > 0 ? -28 : 28 }),
    }),
    [reduce],
  );

  return (
    <div className="mx-auto w-full max-w-[1480px]">
      {/* ── Interactive deck (hidden when printing) ─────────────────────────── */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-serif text-lg text-ink">{deck.title}</span>
              <span className="font-mono text-[12px] text-ink-faint">
                {safeIndex + 1} / {total}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolButton onClick={() => setEditMode((v) => !v)} active={editMode} title="Toggle edit mode (E)">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </ToolButton>
              <ToolButton onClick={() => setNotesOpen((v) => !v)} active={notesOpen} title="Toggle speaker notes (N)">
                <StickyNote className="h-3.5 w-3.5" />
                Notes
              </ToolButton>
              <ToolButton onClick={() => window.print()} title="Print / export to PDF">
                <Printer className="h-3.5 w-3.5" />
                Print
              </ToolButton>
              <ToolButton onClick={exportJson} title="Export deck content as JSON">
                <Download className="h-3.5 w-3.5" />
                Export
              </ToolButton>
              <ToolButton onClick={reset} title="Reset to default content">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </ToolButton>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3 h-0.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${((safeIndex + 1) / total) * 100}%` }}
            />
          </div>

          {/* Stage */}
          <div className="relative">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_24px_60px_-32px_rgba(26,23,20,0.35)]">
              <AnimatePresence custom={dir} mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  custom={dir}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: EASE }}
                  className="absolute inset-0"
                >
                  <Slide slide={current} />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Prev / next */}
            <button
              type="button"
              onClick={() => goTo(safeIndex - 1)}
              disabled={safeIndex === 0}
              aria-label="Previous slide"
              className="absolute -left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-canvas text-ink shadow-sm transition-colors hover:bg-sand disabled:opacity-30 sm:flex lg:-left-5"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(safeIndex + 1)}
              disabled={safeIndex === total - 1}
              aria-label="Next slide"
              className="absolute -right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-canvas text-ink shadow-sm transition-colors hover:bg-sand disabled:opacity-30 sm:flex lg:-right-5"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Dots */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {deck.slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}: ${s.title}`}
                title={s.title}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === safeIndex ? "w-6 bg-accent" : "w-1.5 bg-line-strong hover:bg-ink-faint",
                )}
              />
            ))}
          </div>

          {/* Notes panel */}
          {notesOpen ? (
            <div className="mt-4 rounded-xl border border-line bg-sand/40 p-4">
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                Speaker notes · slide {safeIndex + 1}
              </div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-muted">
                {current.notes?.trim() || "No notes for this slide yet."}
              </p>
            </div>
          ) : null}

          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            ← → navigate · E edit · N notes · Print → PDF
          </p>
        </div>

        {/* Edit drawer */}
        {editMode ? (
          <aside className="w-full shrink-0 lg:w-[380px]">
            <div className="rounded-2xl border border-line bg-canvas p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-serif text-base text-ink">
                  Editing slide {safeIndex + 1}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {current.kind}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  aria-label="Close editor"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-muted hover:bg-sand"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <label className="mb-3 flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                  Deck title
                </span>
                <input
                  className="w-full rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink-faint"
                  value={deck.title}
                  onChange={(e) => setDeck((d) => ({ ...d, title: e.target.value }))}
                />
              </label>
              <EditPanel key={current.id} slide={current} onChange={updateSlide} />
              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-snug text-ink-faint">
                Edits save to this browser automatically. Use Export to download the
                JSON, or Reset to restore the default deck.
              </p>
            </div>
          </aside>
        ) : null}
      </div>

      {/* ── Print tree: every slide as its own page (clean PDF export) ──────── */}
      <div className="deck-print hidden print:block">
        {deck.slides.map((s) => (
          <section key={s.id} className="deck-print-page">
            <div className="deck-print-slide">
              <Slide slide={s} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
