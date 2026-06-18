/**
 * Agent 6 — Letter of Intent data.
 *
 * Synthesised by a single Claude call (see /api/loi) from the real Agent 1
 * (property) + Agent 3 (inspection) outputs. The valuation / trajectory / thesis
 * blocks stand in for Agents 2 / 4 / 5, which aren't wired to the UI yet. Numbers
 * are plausible, not precise — the deliverable is a presentable document.
 */

export interface LoiOfferTerms {
  offerPrice: number;
  depositAmount: number;
  financingType: string;
  closingDate: string;
  possessionDate: string;
  contingencies: string[];
  inspectionClause: string;
}

export interface LoiValuation {
  askingPrice: number;
  estimatedValue: number;
  /** estimatedValue − askingPrice (positive = undervalued). */
  mispricing: number;
  /** Fraction, e.g. 0.085 for 8.5%. */
  mispricingPct: number;
  /** 0–1. */
  sellerUrgency: number;
  distressSale: boolean;
  comparableCount: number;
  medianPpsf: number;
  priceReductionCount: number;
  priceReductionTotal: number;
  summary: string;
}

export interface LoiTrajectorySignal {
  name: string;
  /** 0–100. */
  score: number;
  detail: string;
}

export interface LoiTrajectory {
  /** 0–100. */
  score: number;
  summary: string;
  signals: LoiTrajectorySignal[];
}

export interface LoiRepairItem {
  category: string;
  cost: number;
}

export interface LoiInspectionSummary {
  repairRisk: number;
  renovationScore: number;
  estimatedRepairCost: number;
  repairBreakdown: LoiRepairItem[];
  summary: string;
}

export interface LoiThesis {
  recommendation: "BUY" | "PASS";
  confidence: string;
  basis: string;
  corroborations: string[];
  conflicts: string[];
  risks: string[];
}

export interface LoiFutureCost {
  year: number;
  propertyTax: number;
  maintenance: number;
  insurance: number;
  financing: number;
  projectedValue: number;
}

export interface LoiNarrative {
  intro: string;
  valuationNarrative: string;
  closing: string;
}

export interface LoiData {
  reference: string;
  date: string;
  buyerName: string;
  sellerName: string;
  executiveSummary: string;
  offerTerms: LoiOfferTerms;
  valuation: LoiValuation;
  trajectory: LoiTrajectory;
  inspectionSummary: LoiInspectionSummary;
  thesis: LoiThesis;
  futureCosts: LoiFutureCost[];
  narrative: LoiNarrative;
}
