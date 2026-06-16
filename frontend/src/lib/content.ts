import {
  FileSignature,
  Link2,
  Lock,
  type LucideIcon,
  MapPinned,
  ScanEye,
  Scale,
  TrendingUp,
} from "lucide-react";

export const NAV_LINKS = [
  { label: "Product", href: "#pillars" },
  { label: "How it works", href: "#pipeline" },
  { label: "Customers", href: "#customers" },
  { label: "FAQ", href: "#faq" },
] as const;

/** Placeholder customer wordmarks for the trust strip. */
export const LOGOS = [
  "Cedarline Capital",
  "Northgate Residential",
  "Harborstone",
  "Brixton Yield",
  "Marrow & Vale",
  "Oakhart Group",
];

export type Stat = {
  to: number;
  prefix?: string;
  suffix?: string;
  label: string;
};

export const STATS: Stat[] = [
  { to: 5, suffix: " min", label: "Median time to a complete underwrite" },
  { to: 6, label: "Specialist agents reviewing every deal" },
  { to: 12, suffix: "+", label: "Trajectory signals weighted by evidence" },
  { to: 100, suffix: "%", label: "Local inference — nothing leaves your network" },
];

export type Pillar = {
  tag: string;
  title: string;
  body: string;
  points: string[];
  visual: "inspection" | "valuation" | "trajectory";
};

export const PILLARS: Pillar[] = [
  {
    tag: "Inspection",
    title: "See the condition before the inspection.",
    body: "A local vision model reads every listing photo — scoring roof, water, foundation, and electrical risk, then estimating repair cost with a confidence on each flag.",
    points: ["Per-photo risk scoring", "Repair-cost estimate", "Confidence on every flag"],
    visual: "inspection",
  },
  {
    tag: "Valuation",
    title: "Price the deal against the live market.",
    body: "DealSense pulls live comparables, adjusts for condition, and reads the listing text and price cuts to surface mispricing and the seller's urgency.",
    points: ["Condition-adjusted comps", "Mispricing vs. asking", "Seller-urgency signals"],
    visual: "valuation",
  },
  {
    tag: "Trajectory",
    title: "Map where the neighborhood is heading.",
    body: "Retrieval over municipal records weights approved transit, rezonings, and developments into a five-to-ten-year trajectory score you can defend.",
    points: ["Transit & rezoning signals", "Evidence-weighted scoring", "Cited source documents"],
    visual: "trajectory",
  },
];

export type Difference = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export const DIFFERENCE: Difference[] = [
  {
    icon: Scale,
    title: "Evidence-first thesis",
    body: "Every BUY or PASS shows its work — corroborating signals, conflicts named out loud, and a citation behind each claim.",
  },
  {
    icon: FileSignature,
    title: "Documents, drafted",
    body: "On a BUY, DealSense pre-fills the Letter of Intent and a shareable, fully-cited underwriting report.",
  },
  {
    icon: Lock,
    title: "Local and private",
    body: "Vision, valuation, and reasoning run on your own Apple Silicon. No per-deal metering, no data leaving the building.",
  },
];

export type PipelineStage = {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    icon: Link2,
    step: "01",
    title: "Data collection",
    description: "Scrapes the listing URL — price, address, photos, and full price history.",
  },
  {
    icon: ScanEye,
    step: "02",
    title: "Inspection",
    description: "A vision model scores each photo for structural risk and condition.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "Valuation",
    description: "Pulls live comps and reads the listing for distress and urgency.",
  },
  {
    icon: MapPinned,
    step: "04",
    title: "Trajectory",
    description: "Retrieval over municipal records weights the signals driving upside.",
  },
  {
    icon: Scale,
    step: "05",
    title: "Thesis",
    description: "Synthesizes the evidence into a BUY/PASS with cited reasoning.",
  },
  {
    icon: FileSignature,
    step: "06",
    title: "Documents",
    description: "Auto-drafts the LOI and a shareable underwriting report.",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "DealSense compressed our first-pass underwriting from a full afternoon to a coffee break. The conflict flags alone have killed two deals we'd have regretted.",
    name: "Maya Ellison",
    role: "Principal",
    company: "Cedarline Capital",
    initials: "ME",
  },
  {
    quote:
      "The photo inspection caught foundation movement our analyst missed. That single flag paid for the year.",
    name: "Devin Park",
    role: "Head of Acquisitions",
    company: "Northgate Residential",
    initials: "DP",
  },
  {
    quote:
      "Our investment committee finally trusts the model, because every number cites a source.",
    name: "Sofia Marchetti",
    role: "Underwriting Lead",
    company: "Harborstone Partners",
    initials: "SM",
  },
];

export type Faq = {
  q: string;
  a: string;
};

export const FAQS: Faq[] = [
  {
    q: "Does my data leave my machine?",
    a: "No. Inspection (vision), valuation, trajectory retrieval, and the thesis all run locally on Apple Silicon. The only optional outbound call is document generation, which you can disable.",
  },
  {
    q: "Which listing sites are supported?",
    a: "Public listing URLs such as Realtor.ca and Zillow. DealSense scrapes the canonical property data — price, address, photos, and price history — automatically.",
  },
  {
    q: "How accurate is the computer-vision inspection?",
    a: "Every flag carries a confidence score from 0 to 1. Treat it as a fast, consistent first-pass filter that surfaces risk for a professional inspection — not a replacement for a licensed inspector.",
  },
  {
    q: "What if a property isn't in a fully-supported municipality?",
    a: "Analysis degrades gracefully. You still get inspection, valuation, and trajectory wherever public records exist; municipal risk scoring is richest where open data is available.",
  },
  {
    q: "Can I export the LOI and the report?",
    a: "Yes. On a BUY, DealSense pre-fills a Letter of Intent; on either verdict it produces a shareable, fully-cited underwriting report.",
  },
  {
    q: "Why would it recommend PASS — and can I still see the analysis?",
    a: "Always. A PASS simply means the evidence doesn't corroborate a buy. You receive the complete report — valuation, inspection, trajectory, and the reasoning — every time.",
  },
];
