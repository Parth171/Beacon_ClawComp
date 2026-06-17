/**
 * camelCase mirrors of the backend Pydantic models, as they arrive over SSE
 * (`model_dump_json(by_alias=True)`). Kept loose where the backend allows extra
 * fields (Evidence) or freeform strings (CalcInput.source).
 */

export interface VisualFlag {
  imageIndex: number;
  issue: string;
  location?: string | null;
  reason?: string | null;
  confidence: number;
}

export interface PerImageAssessment {
  imageIndex: number;
  imageUrl?: string | null;
  roofRisk: number;
  waterRisk: number;
  foundationRisk: number;
  electricalRisk: number;
  renovationScore: number;
  flags: VisualFlag[];
}

export interface CalcInput {
  label: string;
  value: unknown;
  /** Freeform provenance tag — "market", "DOB", "ECB/OATH", or absent. */
  source?: string | null;
  note?: string | null;
  evidenceUrls?: string[];
}

export interface BreakdownItem {
  label: string;
  value: unknown;
  formula?: string | null;
  inputs: CalcInput[];
  note?: string | null;
}

/** Evidence allows extra fields, so this is intentionally open. */
export interface Evidence {
  type: string;
  detail?: string | null;
  weight?: "high" | "medium" | "low" | null;
  issue?: string;
  location?: string | null;
  imageIndex?: number;
  confidence?: number;
  source?: string;
  severity?: string | null;
  status?: string;
  dateIssued?: string | null;
  [key: string]: unknown;
}

export interface MunicipalSignal {
  level: "high" | "medium" | "low";
  label: string;
  detail?: string | null;
  count: number;
  points: number;
}

export interface MunicipalRiskResult {
  municipalRiskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  summary: string;
  signals: MunicipalSignal[];
  evidence: Evidence[];
  breakdown: BreakdownItem[];
}

export interface InspectionResult {
  repairRisk: number;
  renovationScore: number;
  estimatedRepairCost: number;
  imageCount: number;
  model: string;
  perImage: PerImageAssessment[];
  evidence: Evidence[];
  breakdown: BreakdownItem[];
  notes: string[];
  municipal: MunicipalRiskResult | null;
}

export interface PriceHistoryEntry {
  date: string;
  price: number;
}

export interface CanonicalProperty {
  listingUrl?: string | null;
  source?: string | null;
  address?: string | null;
  price: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  lotSize?: number | null;
  yearBuilt?: number | null;
  propertyType?: string | null;
  description?: string | null;
  images: string[];
  daysOnMarket?: number | null;
  priceHistory: PriceHistoryEntry[];
  latitude?: number | null;
  longitude?: number | null;
  postalCode?: string | null;
  city?: string | null;
}

export interface AnalyzeReport {
  property: CanonicalProperty;
  inspection: InspectionResult;
}
