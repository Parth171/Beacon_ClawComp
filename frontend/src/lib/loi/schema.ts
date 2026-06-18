import type { AnalyzeReport } from "@/lib/analyze/types";
import type { LoiData } from "./types";

/** Today, per the project clock. Keeps generated dates coherent. */
const TODAY = "2026-06-17";

/**
 * JSON Schema handed to Claude structured outputs. Every object sets
 * additionalProperties:false and lists all keys in `required` (structured-output
 * rules). No numeric/string min-max constraints — those aren't supported.
 */
export const LOI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reference: { type: "string" },
    date: { type: "string" },
    buyerName: { type: "string" },
    sellerName: { type: "string" },
    executiveSummary: { type: "string" },
    offerTerms: {
      type: "object",
      additionalProperties: false,
      properties: {
        offerPrice: { type: "integer" },
        depositAmount: { type: "integer" },
        financingType: { type: "string" },
        closingDate: { type: "string" },
        possessionDate: { type: "string" },
        contingencies: { type: "array", items: { type: "string" } },
        inspectionClause: { type: "string" },
      },
      required: [
        "offerPrice",
        "depositAmount",
        "financingType",
        "closingDate",
        "possessionDate",
        "contingencies",
        "inspectionClause",
      ],
    },
    valuation: {
      type: "object",
      additionalProperties: false,
      properties: {
        askingPrice: { type: "integer" },
        estimatedValue: { type: "integer" },
        mispricing: { type: "integer" },
        mispricingPct: { type: "number" },
        sellerUrgency: { type: "number" },
        distressSale: { type: "boolean" },
        comparableCount: { type: "integer" },
        medianPpsf: { type: "number" },
        priceReductionCount: { type: "integer" },
        priceReductionTotal: { type: "integer" },
        summary: { type: "string" },
      },
      required: [
        "askingPrice",
        "estimatedValue",
        "mispricing",
        "mispricingPct",
        "sellerUrgency",
        "distressSale",
        "comparableCount",
        "medianPpsf",
        "priceReductionCount",
        "priceReductionTotal",
        "summary",
      ],
    },
    trajectory: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "integer" },
        summary: { type: "string" },
        signals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              score: { type: "integer" },
              detail: { type: "string" },
            },
            required: ["name", "score", "detail"],
          },
        },
      },
      required: ["score", "summary", "signals"],
    },
    inspectionSummary: {
      type: "object",
      additionalProperties: false,
      properties: {
        repairRisk: { type: "integer" },
        renovationScore: { type: "integer" },
        estimatedRepairCost: { type: "integer" },
        repairBreakdown: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: { type: "string" },
              cost: { type: "integer" },
            },
            required: ["category", "cost"],
          },
        },
        summary: { type: "string" },
      },
      required: [
        "repairRisk",
        "renovationScore",
        "estimatedRepairCost",
        "repairBreakdown",
        "summary",
      ],
    },
    thesis: {
      type: "object",
      additionalProperties: false,
      properties: {
        recommendation: { type: "string", enum: ["BUY", "PASS"] },
        confidence: { type: "string" },
        basis: { type: "string" },
        corroborations: { type: "array", items: { type: "string" } },
        conflicts: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
      },
      required: ["recommendation", "confidence", "basis", "corroborations", "conflicts", "risks"],
    },
    futureCosts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          year: { type: "integer" },
          propertyTax: { type: "integer" },
          maintenance: { type: "integer" },
          insurance: { type: "integer" },
          financing: { type: "integer" },
          projectedValue: { type: "integer" },
        },
        required: ["year", "propertyTax", "maintenance", "insurance", "financing", "projectedValue"],
      },
    },
    narrative: {
      type: "object",
      additionalProperties: false,
      properties: {
        intro: { type: "string" },
        valuationNarrative: { type: "string" },
        closing: { type: "string" },
      },
      required: ["intro", "valuationNarrative", "closing"],
    },
  },
  required: [
    "reference",
    "date",
    "buyerName",
    "sellerName",
    "executiveSummary",
    "offerTerms",
    "valuation",
    "trajectory",
    "inspectionSummary",
    "thesis",
    "futureCosts",
    "narrative",
  ],
} as const;

export function buildPrompt(report: AnalyzeReport): string {
  const { property: p, inspection: i } = report;
  const flags = i.perImage
    .flatMap((img) => img.flags.map((f) => f.issue))
    .filter(Boolean)
    .slice(0, 8);
  const priceHistory = (p.priceHistory ?? [])
    .map((e) => `${e.date}: $${e.price.toLocaleString()}`)
    .join("; ");

  const facts = [
    `Address: ${p.address ?? "Unknown"}`,
    `City: ${p.city ?? "Unknown"}`,
    `Asking price: $${p.price.toLocaleString()}`,
    p.bedrooms != null ? `Bedrooms: ${p.bedrooms}` : null,
    p.bathrooms != null ? `Bathrooms: ${p.bathrooms}` : null,
    p.sqft != null ? `Square feet: ${p.sqft}` : null,
    p.yearBuilt != null ? `Year built: ${p.yearBuilt}` : null,
    p.propertyType ? `Type: ${p.propertyType}` : null,
    p.daysOnMarket != null ? `Days on market: ${p.daysOnMarket}` : null,
    priceHistory ? `Price history: ${priceHistory}` : null,
    `Inspection repair risk (0–100): ${i.repairRisk}`,
    `Inspection renovation score (0–100): ${i.renovationScore}`,
    `Inspection estimated repair cost: $${i.estimatedRepairCost.toLocaleString()}`,
    flags.length ? `Visible defects flagged: ${flags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are Agent 6 in the Beacon real-estate underwriting pipeline. You produce the data for a polished, presentable 2–3 page Letter of Intent (LOI) to purchase the property below.

You have real outputs from Agent 1 (listing data) and Agent 3 (visual inspection). The valuation, neighbourhood trajectory, and investment thesis blocks stand in for Agents 2, 4, and 5, which have not run — so synthesise plausible, professional-looking figures for them. Precision does not matter; internal consistency and presentation do.

PROPERTY & INSPECTION FACTS:
${facts}

REQUIREMENTS:
- Today's date is ${TODAY}. Use ${TODAY} for "date"; set closing ~50 days out and possession a few days after closing.
- "reference" like "LOI-2026-04817".
- Use realistic placeholder parties: buyer "Beacon Capital Partners", seller "the Seller / current owner".
- valuation: estimatedValue should sit a few percent above or below askingPrice depending on condition; mispricing = estimatedValue − askingPrice; mispricingPct = mispricing / askingPrice (a fraction like 0.072). sellerUrgency is 0–1. medianPpsf ≈ estimatedValue / square feet. If price history shows cuts, reflect them in priceReductionCount/Total and raise sellerUrgency.
- offerTerms.offerPrice slightly below askingPrice; depositAmount ≈ 5% of offerPrice; contingencies is a short list (financing, inspection, clear title, etc.).
- trajectory: exactly 6 signals named "Transit & infrastructure", "Rezoning & development", "Employment growth", "Schools & amenities", "Council sentiment", "Market liquidity", each score 0–100 with a one-sentence detail. Overall score roughly the weighted average.
- inspectionSummary.estimatedRepairCost should equal the inspection figure above; repairBreakdown splits it across 4–6 categories (e.g. Roof, Water & moisture, Foundation, Electrical, Cosmetic/interior) that sum to roughly that total.
- futureCosts: exactly 5 entries, year 1 through 5. propertyTax ≈ 1% of value, maintenance rising each year, insurance ≈ 0.25% of value, financing = annual mortgage interest on ~80% LTV (declining slowly). projectedValue appreciates ~3–5% per year from estimatedValue.
- thesis.recommendation is "BUY" when the deal looks attractive (undervalued, manageable risk) else "PASS"; include 2–4 corroborations, 1–3 conflicts, 2–4 risks, and a one-paragraph basis.
- All prose fields are concise and read like a real underwriting memo. executiveSummary is 2–3 sentences. narrative.intro/valuationNarrative/closing are one short paragraph each.

Return only the structured JSON object.`;
}

/** Deterministic, key-free fallback so the LOI always renders (demo-safe). */
export function buildMockLoi(report: AnalyzeReport): LoiData {
  const { property: p, inspection: i } = report;
  const asking = p.price;
  const sqft = p.sqft ?? 1500;
  const condition = (i.renovationScore - 70) / 1000 - Math.max(0, i.repairRisk - 40) / 1000;
  const estimatedValue = Math.round(asking * (1.06 + condition));
  const mispricing = estimatedValue - asking;
  const offerPrice = Math.round(asking * 0.965);
  const deposit = Math.round((offerPrice * 0.05) / 1000) * 1000;
  const reductions = p.priceHistory ?? [];
  const priceReductionCount = Math.max(0, reductions.length - 1);
  const priceReductionTotal =
    reductions.length > 1 ? Math.max(0, reductions[0].price - reductions[reductions.length - 1].price) : 0;

  const repairTotal = i.estimatedRepairCost || 12000;
  const repairBreakdown = [
    { category: "Roof & exterior", cost: Math.round(repairTotal * 0.3) },
    { category: "Water & moisture", cost: Math.round(repairTotal * 0.25) },
    { category: "Foundation & structure", cost: Math.round(repairTotal * 0.15) },
    { category: "Electrical & systems", cost: Math.round(repairTotal * 0.15) },
    { category: "Cosmetic & interior", cost: Math.round(repairTotal * 0.15) },
  ];

  const futureCosts: LoiData["futureCosts"] = Array.from({ length: 5 }, (_, idx) => {
    const year = idx + 1;
    const value = Math.round(estimatedValue * Math.pow(1.04, year));
    return {
      year,
      propertyTax: Math.round(value * 0.0105),
      maintenance: Math.round(asking * 0.008 * (1 + idx * 0.18)),
      insurance: Math.round(value * 0.0025),
      financing: Math.round(asking * 0.8 * 0.052 * (1 - idx * 0.04)),
      projectedValue: value,
    };
  });

  const recommendation: "BUY" | "PASS" = mispricing > 0 && i.repairRisk < 62 ? "BUY" : "PASS";

  return {
    reference: `LOI-2026-${(asking % 100000).toString().padStart(5, "0")}`,
    date: TODAY,
    buyerName: "Beacon Capital Partners",
    sellerName: "the Seller / current owner",
    executiveSummary: `Beacon Capital Partners submits this non-binding Letter of Intent for ${
      p.address ?? "the subject property"
    }. Our underwriting estimates fair value at ${
      mispricing >= 0 ? `roughly $${Math.abs(mispricing).toLocaleString()} above` : `roughly $${Math.abs(mispricing).toLocaleString()} below`
    } the current asking price, with a manageable repair profile and a constructive neighbourhood trajectory.`,
    offerTerms: {
      offerPrice,
      depositAmount: deposit,
      financingType: "Conventional mortgage, ~80% loan-to-value",
      closingDate: "2026-08-06",
      possessionDate: "2026-08-13",
      contingencies: [
        "Satisfactory professional home inspection",
        "Financing approval within 21 days",
        "Clear title and survey review",
        "Review of recent municipal records",
      ],
      inspectionClause:
        "Offer conditional on a licensed inspection within 10 business days; Buyer may renegotiate or withdraw based on findings.",
    },
    valuation: {
      askingPrice: asking,
      estimatedValue,
      mispricing,
      mispricingPct: mispricing / asking,
      sellerUrgency: priceReductionCount >= 2 ? 0.68 : priceReductionCount >= 1 ? 0.46 : 0.32,
      distressSale: priceReductionCount >= 2,
      comparableCount: 7,
      medianPpsf: Math.round(estimatedValue / sqft),
      priceReductionCount,
      priceReductionTotal,
      summary: `Comparable sales imply a fair value of about $${estimatedValue.toLocaleString()} ($${Math.round(
        estimatedValue / sqft,
      ).toLocaleString()}/sqft). ${
        priceReductionCount > 0
          ? `${priceReductionCount} prior reduction${priceReductionCount > 1 ? "s" : ""} totalling $${priceReductionTotal.toLocaleString()} signals motivated selling.`
          : "Pricing appears steady with no recorded reductions."
      }`,
    },
    trajectory: {
      score: 74,
      summary:
        "The submarket shows above-average appreciation potential, anchored by planned transit access and steady development approvals, tempered by moderate market liquidity.",
      signals: [
        { name: "Transit & infrastructure", score: 82, detail: "Approved capital plan adds rapid-transit access within ~800m." },
        { name: "Rezoning & development", score: 71, detail: "Active mixed-use applications signal intensifying land use nearby." },
        { name: "Employment growth", score: 66, detail: "Announced employer expansions support local demand." },
        { name: "Schools & amenities", score: 78, detail: "Strong school catchment and walkable retail." },
        { name: "Council sentiment", score: 69, detail: "Recent votes favour density and infrastructure renewal." },
        { name: "Market liquidity", score: 61, detail: "Days-on-market slightly elevated versus the city average." },
      ],
    },
    inspectionSummary: {
      repairRisk: i.repairRisk,
      renovationScore: i.renovationScore,
      estimatedRepairCost: repairTotal,
      repairBreakdown,
      summary: `Visual inspection scores condition at ${i.renovationScore}/100 with a repair-risk index of ${i.repairRisk}/100. Estimated near-term remediation is about $${repairTotal.toLocaleString()}, concentrated in roof and moisture items.`,
    },
    thesis: {
      recommendation,
      confidence: "medium",
      basis:
        recommendation === "BUY"
          ? "The property is priced below our modelled fair value, the repair profile is contained, and neighbourhood trajectory signals are constructive — a conditional offer with an inspection clause is warranted."
          : "While the location is attractive, the combination of pricing and condition risk does not yet clear our return threshold; we recommend proceeding only on improved terms.",
      corroborations: [
        "Valuation gap and seller-pricing behaviour both point to negotiating room.",
        "Trajectory signals (transit, development) align with medium-term appreciation.",
        "Repair items are visible and quantifiable rather than structural unknowns.",
      ],
      conflicts: [
        "Elevated days-on-market sits against an otherwise strong trajectory ward.",
      ],
      risks: [
        "Full extent of moisture-related repairs is unconfirmed until inspection.",
        "Appreciation depends on transit timelines that may slip.",
        "Financing costs could rise before closing.",
      ],
    },
    futureCosts,
    narrative: {
      intro: `This Letter of Intent sets out the principal terms under which Beacon Capital Partners would acquire ${
        p.address ?? "the subject property"
      }. It is non-binding and intended as the basis for a definitive purchase agreement.`,
      valuationNarrative: `Our valuation blends comparable sales with a condition adjustment from the visual inspection. The result places fair value at approximately $${estimatedValue.toLocaleString()}, supporting an opening offer of $${offerPrice.toLocaleString()} subject to the contingencies below.`,
      closing:
        "We appreciate your consideration and look forward to working toward a definitive agreement. This letter expresses our good-faith intent and does not create binding obligations except as set out in any subsequent executed contract.",
    },
  };
}
