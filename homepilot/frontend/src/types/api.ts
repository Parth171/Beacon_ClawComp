export interface BuyerProfile {
  id?: string | null;
  budget: number;
  children?: number;
  dog?: boolean;
  work_location?: string | null;
  preferred_city?: string | null;
  max_commute_minutes?: number | null;
  telegram_chat_id?: string | null;
  watched_area?: string | null;
  min_bedrooms?: number | null;
  alert_threshold?: number;
}

export interface PropertyLocation {
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PropertyListing {
  id: string;
  url?: string | null;
  mls_number?: string | null;
  listing_price: number;
  location?: PropertyLocation;
  description?: string | null;
  photo_urls?: string[];
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_feet?: number | null;
  year_built?: number | null;
  property_type?: string | null;
  school_score?: number | null;
  safety_score?: number | null;
  park_distance_meters?: number | null;
  commute_minutes?: number | null;
  annual_property_tax?: number | null;
  maintenance_fees?: string | null;
}

export interface RecommendationRequest {
  buyer: BuyerProfile;
  properties?: PropertyListing[];
  listing_urls?: string[];
}

export type InputSource =
  | "listing"
  | "assumption"
  | "market"
  | "model"
  | "computed";

export interface CalcInput {
  label: string;
  value: string;
  source: InputSource;
  note?: string | null;
  evidence_urls?: string[];
}

export interface BreakdownItem {
  label: string;
  value: string;
  formula?: string | null;
  inputs: CalcInput[];
  note?: string | null;
}

export interface AgentOutputBase {
  explanation?: string | null;
  confidence?: number | null;
  breakdown?: BreakdownItem[];
}

export interface PropertyIntelligenceResult extends AgentOutputBase {
  property_quality_score: number;
  repair_risk_score: number;
  roof_condition?: string | null;
  water_damage_risk?: string | null;
  estimated_major_repairs?: string[];
}

export interface HiddenCostResult extends AgentOutputBase {
  annual_property_tax: number;
  annual_utilities: number;
  annual_insurance: number;
  annual_maintenance: number;
  true_annual_cost: number;
}

export interface FamilyFitResult extends AgentOutputBase {
  family_fit_score: number;
  school_score?: number | null;
  commute_score?: number | null;
  safety_score?: number | null;
  park_score?: number | null;
}

export interface PropertyValueResult extends AgentOutputBase {
  asking_price: number;
  estimated_value: number;
  value_gap: number;
  value_gap_pct: number;
  deal_score: number;
  recommendation?: string;
  comparable_count?: number;
  median_ppsf?: number | null;
  positive_factors?: string[];
  negative_factors?: string[];
}

export interface FutureOutlookResult extends AgentOutputBase {
  future_score: number;
  reasons?: string[];
  signals?: Record<string, unknown>;
}

export interface PropertyRecommendation {
  rank: number;
  property: PropertyListing;
  overall_score: number;
  property_intelligence: PropertyIntelligenceResult;
  hidden_cost: HiddenCostResult;
  family_fit: FamilyFitResult;
  property_value: PropertyValueResult;
  future_outlook: FutureOutlookResult;
  recommendation_summary: string;
  tradeoffs?: string[];
}

export interface RecommendationResponse {
  recommendations: PropertyRecommendation[];
}
