import type { RecommendationRequest } from "@/types/api";

export async function loadDemoRequest(): Promise<RecommendationRequest> {
  const response = await fetch("/demo_request.json");
  if (!response.ok) {
    throw new Error("Failed to load demo request.");
  }

  return (await response.json()) as RecommendationRequest;
}

export function parseListingUrls(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildRecommendationRequest(
  buyer: RecommendationRequest["buyer"],
  listingUrlsText: string,
  properties: RecommendationRequest["properties"] = [],
): RecommendationRequest {
  const listing_urls = parseListingUrls(listingUrlsText);

  return {
    buyer,
    properties,
    listing_urls,
  };
}
