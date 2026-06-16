import type { RecommendationResponse } from "@/types/api";

const STORAGE_KEY = "homepilot:recommendations";
let cachedRaw: string | null | undefined;
let cachedRecommendations: RecommendationResponse | null = null;

export function saveRecommendations(response: RecommendationResponse): void {
  const raw = JSON.stringify(response);
  sessionStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedRecommendations = response;
}

export function loadRecommendations(): RecommendationResponse | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedRecommendations;
  }

  cachedRaw = raw;

  if (!raw) {
    cachedRecommendations = null;
    return null;
  }

  try {
    cachedRecommendations = JSON.parse(raw) as RecommendationResponse;
    return cachedRecommendations;
  } catch {
    cachedRecommendations = null;
    return null;
  }
}

export function clearRecommendations(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedRecommendations = null;
}
