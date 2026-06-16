import type { BuyerProfile, PropertyListing } from "@/types/api";

export interface SearchBrief {
  budget: string;
  locations: string;
  children: number;
  hasPets: boolean;
  minBedrooms: number;
  workLocation: string;
  maxCommuteMinutes: string;
  mustHaves: string;
  niceToHaves: string;
  exclusions: string;
  listingUrls: string;
}

export interface ListingSearchRequest {
  budget: number;
  locations: string[];
  bedrooms?: number;
  pets?: boolean;
  commuteTo?: string;
  maxCommuteMinutes?: number;
  mustHaves?: string[];
  niceToHaves?: string[];
  exclusions?: string[];
  useDemo?: boolean;
}

export interface ListingSearchResponse {
  properties: PropertyListing[];
  source: "demo" | "live";
  summary: string;
}

export const defaultSearchBrief: SearchBrief = {
  budget: "950000",
  locations: "Toronto, Burlington, Mississauga",
  children: 2,
  hasPets: true,
  minBedrooms: 3,
  workLocation: "Toronto",
  maxCommuteMinutes: "45",
  mustHaves: "good schools\nparks nearby\nmove-in ready",
  niceToHaves: "finished basement\ntransit access",
  exclusions: "major foundation issues\nbusy arterial roads",
  listingUrls: "",
};

export function parseCurrency(value: string): number {
  return Number(value.replace(/[^\d]/g, ""));
}

export function parseLines(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function searchBriefToBuyerProfile(brief: SearchBrief): BuyerProfile {
  const commute = Number(brief.maxCommuteMinutes.replace(/[^\d]/g, ""));

  return {
    budget: parseCurrency(brief.budget),
    children: brief.children,
    dog: brief.hasPets,
    preferred_city: parseLines(brief.locations)[0] ?? null,
    watched_area: brief.locations.trim() || null,
    min_bedrooms: brief.minBedrooms,
    work_location: brief.workLocation.trim() || null,
    max_commute_minutes: Number.isFinite(commute) && commute > 0 ? commute : null,
  };
}

export function searchBriefToListingSearchRequest(brief: SearchBrief): ListingSearchRequest {
  const commute = Number(brief.maxCommuteMinutes.replace(/[^\d]/g, ""));

  return {
    budget: parseCurrency(brief.budget),
    locations: parseLines(brief.locations),
    bedrooms: brief.minBedrooms || undefined,
    pets: brief.hasPets,
    commuteTo: brief.workLocation.trim() || undefined,
    maxCommuteMinutes: Number.isFinite(commute) && commute > 0 ? commute : undefined,
    mustHaves: parseLines(brief.mustHaves),
    niceToHaves: parseLines(brief.niceToHaves),
    exclusions: parseLines(brief.exclusions),
  };
}
