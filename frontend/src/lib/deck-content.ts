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

export const DECK_VERSION = 10;
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

/** One image in a multi-image slide (blank src → on-brand placeholder). */
export interface VisionImage {
  src?: string;
  alt?: string;
}

/** A labelled LaTeX equation with a short plain-language caption. */
export interface Equation {
  label: string;
  tex: string;
  caption?: string;
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
  highlight?: boolean;
}

export interface AgentItem {
  name: string;
  role: string;
}

/** A pipeline agent with the tech behind it and short bullets of what it does. */
export interface PipelineAgent {
  name: string;
  tech?: string;
  points: string[];
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
  | "matters"
  | "pipeline"
  | "techpipeline"
  | "vision"
  | "valuation"
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

  // multi-image slide (e.g. vision deep dive)
  images?: VisionImage[];

  // valuation slide
  inputs?: string[];
  equations?: Equation[];

  // other kind-specific blocks
  story?: { beats: StoryBeat[]; outcome: string };
  comparison?: { leftTitle: string; rightTitle: string; rows: ComparisonRow[] };
  flow?: FlowStep[];
  verdict?: { label: string; sub: string; tone: "buy" | "pass" };
  agents?: AgentItem[];
  techAgents?: PipelineAgent[];
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

    // 4 · WHY THIS PROBLEM MATTERS — market size + the gap ───────────────────────
    {
      id: "matters",
      kind: "matters",
      eyebrow: "Why this problem matters",
      title: "A $4 trillion market, still underwritten on gut feel.",
      metrics: [
        {
          value: "$4T",
          label: "Total addressable market",
          sub: "Real estate is the largest asset class on earth.",
          confidence: "needs-validation",
        },
      ],
      bullets: [
        { text: "Buyers lack the time and access to consolidated data." },
        {
          text: "Agents tell buyers what they want to hear — Beacon tells them what they need to know.",
        },
        { text: "Data-driven analytics is the missing piece." },
      ],
      notes:
        "Make the stakes concrete: a $4T market making decisions without data. The agent-incentive line is the sharpest point — let it land. The $4T figure carries a 'needs validation' tag; replace the citation with a real source (e.g. transaction volume vs. asset value) before pitching.",
    },

    // 5 · WHERE BEACON FITS — the decision layer in the buying journey ───────────
    {
      id: "pipeline",
      kind: "pipeline",
      eyebrow: "Where Beacon fits",
      title: "A decision layer between discovery and your realtor.",
      flow: [
        { label: "Search", detail: "Browse listings" },
        { label: "Beacon", detail: "Decide what's worth pursuing", highlight: true },
        { label: "Realtor", detail: "Engage on the shortlist" },
        { label: "Offer", detail: "Negotiate with evidence" },
        { label: "Closing", detail: "Buy with confidence" },
      ],
      bullets: [
        { text: "Beacon is the decision layer between discovery and realtor engagement." },
        {
          text: "We don't replace agents — we help buyers decide which properties deserve further consideration.",
        },
      ],
      notes:
        "Position, don't threaten. Beacon slots into the journey buyers already follow — it doesn't disrupt the realtor relationship, it sharpens the front of the funnel. The highlighted node makes the placement obvious at a glance.",
    },

    // 6 · TECHNICAL PIPELINE — the agents and the tech behind each ───────────────
    {
      id: "techpipeline",
      kind: "techpipeline",
      eyebrow: "Technical pipeline",
      title: "Specialist agents, running in sequence.",
      lead: "Paste a listing and Beacon's agents initiate analysis — each consuming the last one's evidence.",
      techAgents: [
        {
          name: "Property Intelligence",
          tech: "Qwen2.5-VL + LoRA",
          points: [
            "Reads every listing photo",
            "Scores condition & structural risk",
            "Estimates repair cost with confidence",
          ],
        },
        {
          name: "Valuation Intelligence",
          tech: "XGBoost",
          points: [
            "Prices the deal against live comps",
            "Flags mispricing vs. asking",
            "Reads price history for distress",
          ],
        },
        {
          name: "Municipal Intelligence",
          tech: "RAG retrieval",
          points: [
            "Searches permits, rezonings & transit",
            "Weights signals by evidence",
            "Cites every source document",
          ],
        },
        {
          name: "LOI Agent",
          tech: "Structured output",
          points: [
            "Drafts the Letter of Intent",
            "Builds a cited underwriting report",
            "Ready to send on a BUY",
          ],
        },
      ],
      notes:
        "The 'how it actually works' slide. Name the real tech — local vision model with a condition LoRA, gradient-boosted valuation, retrieval over municipal records, structured-output document drafting. The sequence matters: each agent's output is evidence for the next.",
    },

    // 7 · PROPERTY INTELLIGENCE — the vision model, deep dive ─────────────────────
    {
      id: "vision",
      kind: "vision",
      eyebrow: "Property Intelligence",
      title: "Vision that reads the photos.",
      subtitle: "Qwen2.5-VL + LoRA",
      images: [
        { src: "", alt: "Exterior photo with detected risks" },
        { src: "", alt: "Interior photo with detected risks" },
      ],
      bullets: [
        { text: "A local vision-language model reads every listing photo." },
        { text: "It flags structural risk — roof, water, and foundation." },
        { text: "A LoRA fine-tunes that detection on real listing photos." },
      ],
      notes:
        "Deep dive on the VLM, but keep it visual — the markers on the photo do the talking. Three lines only: what it is, what it finds, how it gets sharp. The LoRA is the proprietary edge; the rest is the demo.",
    },

    // 8 · VALUATION INTELLIGENCE — XGBoost engine + the math ─────────────────────
    {
      id: "valuation",
      kind: "valuation",
      eyebrow: "Valuation Intelligence",
      title: "A financial engine that prices the deal.",
      lead: "Historical sales, property features, and location feed an XGBoost model that predicts fair value — then we measure how far the ask drifts from it.",
      inputs: ["Historical sales", "Property features", "Location data"],
      equations: [
        {
          label: "Mispricing",
          tex: "\\text{Mispricing} = \\dfrac{\\text{Ask}-\\hat{P}}{\\hat{P}}\\times 100\\%",
          caption: "How far the asking price sits above or below predicted fair value P̂.",
        },
        {
          label: "Repair risk",
          tex: "\\text{Repair} = 100\\cdot\\min\\!\\left(1,\\ \\max_k w_k r_k + 0.4\\!\\!\\sum_{k\\neq k^{*}}\\! w_k r_k\\right)",
          caption: "Driven by the worst weighted dimension, with partial credit for the rest.",
        },
        {
          label: "Municipal risk",
          tex: "\\text{Municipal} = \\operatorname{clamp}\\!\\left(\\sum_s \\sigma_s - \\sum_m \\mu_m,\\ 0,\\ 100\\right)",
          caption: "Risk signals net of mitigants, clamped to 0–100.",
        },
      ],
      notes:
        "The quant slide. Left: the model is just inputs → XGBoost → fair value. Right: the three numbers we actually report, with the formulas behind them. Don't read the equations aloud — point to mispricing as the headline and let the math signal rigor.",
    },
  ],
};
