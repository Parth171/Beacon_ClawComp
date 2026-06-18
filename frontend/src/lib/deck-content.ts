// ─────────────────────────────────────────────────────────────────────────────
// Beacon pitch deck — single source of truth for all slide copy & data.
//
// Everything on /deck lives in DEFAULT_DECK below. The deck is fully editable
// in-browser (Edit mode) and persisted to localStorage; this file is the
// canonical default the "Reset" control falls back to.
//
// The deck is being authored slide by slide. Bump DECK_VERSION whenever the
// default structure changes so a previously-cached deck in the browser doesn't
// shadow the new defaults (old localStorage under the prior key is ignored).
//
// CONTENT RULE: no market number is presented as fact unless backed by something
// concrete. Sizing figures are explicit, editable assumptions — each carries a
// `confidence` label and a `citation` field. Do not delete citation TODOs.
// ─────────────────────────────────────────────────────────────────────────────

export const DECK_VERSION = 4;
export const STORAGE_KEY = `beacon-deck-v${DECK_VERSION}`;

/** Honesty label attached to every metric and market variable. */
export type Confidence = "source-backed" | "assumption" | "needs-validation";

export const CONFIDENCE_OPTIONS: Confidence[] = [
  "source-backed",
  "assumption",
  "needs-validation",
];

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  "source-backed": "Source-backed",
  assumption: "Assumption",
  "needs-validation": "Needs validation",
};

// ── Shared content primitives ────────────────────────────────────────────────

export interface Bullet {
  text: string;
  sub?: string;
}

export interface Metric {
  value: string;
  label: string;
  sub?: string;
  confidence?: Confidence;
}

/** A single editable listing fact, e.g. { value: "1,850", label: "Sq. ft" }. */
export interface ListingSpec {
  value: string;
  label: string;
}

export interface StoryBeat {
  signal: string;
  detail: string;
  source: string;
}

export interface ComparisonRow {
  label: string;
  left: string;
  right: string;
}

export interface FlowStep {
  label: string;
  detail: string;
}

export interface AgentItem {
  name: string;
  role: string;
}

export interface Principle {
  title: string;
  detail: string;
}

export interface Segment {
  name: string;
  tag: string;
  detail: string;
  uses: string[];
}

export interface PricingTier {
  name: string;
  price: string;
  who: string;
  features: string[];
}

export interface Partner {
  name: string;
  role: string;
}

export interface TeamMember {
  name: string;
  role: string;
  background: string;
}

/** A point about a founder, paired with a small image of what they did. */
export interface FounderPoint {
  text: string;
  imageSrc?: string;
}

export interface Founder {
  name: string;
  role: string;
  photo?: string;
  points: FounderPoint[];
}

export interface Milestone {
  period: string;
  title: string;
  detail: string;
}

export interface UseOfFunds {
  label: string;
  detail: string;
}

export interface AskBlock {
  raising: string;
  milestone: string;
  useOfFunds: UseOfFunds[];
  contact: string;
}

// ── Market sizing (TAM / SAM / SOM) ──────────────────────────────────────────
// Each tier's value is the PRODUCT of its variables, so the math is reproducible
// on the slide: edit a multiplicand and the headline number updates live.

export interface MarketVariable {
  name: string;
  value: number;
  unit: string;
  confidence: Confidence;
  citation: string;
}

export interface MarketTier {
  key: "TAM" | "SAM" | "SOM";
  label: string;
  formula: string;
  note: string;
  confidence: Confidence;
  variables: MarketVariable[];
}

// ── Slide ─────────────────────────────────────────────────────────────────────
// One flexible shape with optional fields keeps in-browser editing simple: the
// editor renders a control for whichever fields a given slide actually uses.

export type SlideKind =
  | "listing"
  | "intro"
  | "founders"
  | "title"
  | "story"
  | "problem"
  | "whyNow"
  | "demo"
  | "engine"
  | "market"
  | "methodology"
  | "customers"
  | "business"
  | "moat"
  | "team"
  | "roadmap"
  | "ask";

export interface Slide {
  id: string;
  kind: SlideKind;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  lead?: string;
  bullets?: Bullet[];
  metrics?: Metric[];
  notes?: string;

  // listing-reveal slide
  imageSrc?: string;
  imageAlt?: string;
  price?: string;
  address?: string;
  specs?: ListingSpec[];

  // other kind-specific blocks
  story?: { beats: StoryBeat[]; outcome: string };
  comparison?: { leftTitle: string; rightTitle: string; rows: ComparisonRow[] };
  flow?: FlowStep[];
  verdict?: { label: string; sub: string; tone: "buy" | "pass" };
  agents?: AgentItem[];
  market?: MarketTier[];
  principles?: Principle[];
  segments?: Segment[];
  tiers?: PricingTier[];
  partners?: Partner[];
  privacy?: string[];
  team?: TeamMember[];
  founders?: Founder[];
  research?: string[];
  milestones?: Milestone[];
  ask?: AskBlock;
}

export interface Deck {
  title: string;
  slides: Slide[];
}

// ── Formatting helpers (shared by slides, charts, and the editor) ─────────────

/** Product of a tier's editable multiplicands — the reproducible market math. */
export function productOf(vars: { value: number }[]): number {
  return vars.reduce(
    (acc, v) => acc * (Number.isFinite(v.value) ? v.value : 0),
    1,
  );
}

/** Drop a trailing ".0" so 12.0 → "12" but 12.5 stays. */
function trim0(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatCompactUSD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${trim0((abs / 1e12).toFixed(abs >= 1e14 ? 0 : 1))}T`;
  if (abs >= 1e9) return `${sign}$${trim0((abs / 1e9).toFixed(abs >= 1e11 ? 0 : 1))}B`;
  if (abs >= 1e6) return `${sign}$${trim0((abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1))}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatCompactNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim0((n / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${trim0((n / 1e6).toFixed(abs >= 1e7 ? 0 : 1))}M`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}K`;
  return `${Math.round(n)}`;
}

/** A variable's human-readable value, e.g. "12M pros" or "$1,200 /yr". */
export function formatVariable(v: MarketVariable): string {
  const isMoney = /\$|\/yr|spend|acv|value/i.test(v.unit);
  const num = isMoney ? formatCompactUSD(v.value) : formatCompactNum(v.value);
  return v.unit ? `${num} ${v.unit}` : num;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT DECK  (authored slide by slide)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_DECK: Deck = {
  title: "Beacon — Investor Deck",
  slides: [
    // 1 · THE BUYER'S VIEW — staged listing reveal (house → price → specs) ───────
    {
      id: "listing",
      kind: "listing",
      eyebrow: "The buyer's view",
      title: "This is everything a buyer is given.",
      subtitle:
        "A photo, a price, and a few numbers. It isn't enough to know whether it's a good deal.",
      imageSrc: "",
      imageAlt: "Property listing photo",
      price: "$829,000",
      address: "142 Maple Crescent, Toronto, ON",
      specs: [
        { value: "3", label: "Beds" },
        { value: "2", label: "Baths" },
        { value: "1,850", label: "Sq. ft" },
        { value: "1962", label: "Year built" },
      ],
      notes:
        "Cold open. Let the listing reveal play on its own: first the house, then the price, then the specs. The punchline lands last — this is all a buyer gets, and it's not nearly enough to underwrite a deal. Everything Beacon does builds from this gap. To use a real photo, drop one in /public and put its path (e.g. /listing.jpg) in the Image URL field via Edit mode.",
    },

    // 2 · WHY WE BUILT BEACON — logo + one-line intro ───────────────────────────
    {
      id: "intro",
      kind: "intro",
      eyebrow: "Why we built Beacon",
      title:
        "Autonomous real-estate underwriting — from a listing link to an evidence-backed decision.",
      bullets: [
        { text: "Local-first" },
        { text: "Evidence-backed" },
        { text: "Seconds, not days" },
      ],
      notes:
        "The turn. Slide 1 showed the gap; this names the answer. Keep it minimal — let the logo and the single line carry it. The three chips are the whole thesis in three words; don't over-explain them.",
    },

    // 3 · THE FOUNDERS — Raj & Parth, side by side ───────────────────────────────
    {
      id: "founders",
      kind: "founders",
      eyebrow: "Who's building Beacon",
      title: "Raj & Parth",
      founders: [
        {
          name: "Raj",
          role: "[Role / focus]",
          photo: "",
          points: [
            { text: "[What you built or shipped]", imageSrc: "" },
            { text: "[Relevant experience — AI / real estate / finance]", imageSrc: "" },
            { text: "[Why you understand the underwriting problem]", imageSrc: "" },
          ],
        },
        {
          name: "Parth",
          role: "[Role / focus]",
          photo: "",
          points: [
            { text: "[What you built or shipped]", imageSrc: "" },
            { text: "[Relevant experience — AI / real estate / finance]", imageSrc: "" },
            { text: "[Why you understand the underwriting problem]", imageSrc: "" },
          ],
        },
      ],
      notes:
        "Establish credibility fast — who we are and what we've done. Placeholders are intentional; do not invent credentials. Add real photos (drop files in /public and reference e.g. /raj.jpg) and replace each point with something concrete, ideally with a small image of the thing you shipped next to it.",
    },
  ],
};
