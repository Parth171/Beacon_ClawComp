import {
  applyProgressEvent,
  initialAnalysisProgressState,
  type ProgressEvent,
} from "@/lib/agents";
import type { ListingSearchRequest, ListingSearchResponse } from "@/lib/search";
import type { RecommendationRequest, RecommendationResponse } from "@/types/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }

  if (typeof detail === "object" && detail !== null) {
    return JSON.stringify(detail);
  }

  return "Request failed.";
}

async function consumeSseStream(
  response: Response,
  onEvent: (event: ProgressEvent) => void,
): Promise<RecommendationResponse> {
  if (!response.body) {
    throw new ApiError("No response stream returned.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: RecommendationResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);

      if (chunk.startsWith("data:")) {
        const payload = JSON.parse(chunk.slice(5).trim()) as ProgressEvent;
        onEvent(payload);

        if (payload.type === "error") {
          throw new ApiError(payload.message, payload.status ?? 500);
        }

        if (payload.type === "complete") {
          finalResult = payload.result as RecommendationResponse;
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }

  if (!finalResult) {
    throw new ApiError("Analysis stream ended before results were ready.", 500);
  }

  return finalResult;
}

export async function fetchRecommendations(
  body: RecommendationRequest,
): Promise<RecommendationResponse> {
  const response = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(formatErrorDetail(payload.detail), response.status);
  }

  return payload as RecommendationResponse;
}

export async function fetchRecommendationsWithProgress(
  body: RecommendationRequest,
  onProgress: (state: ReturnType<typeof initialAnalysisProgressState>) => void,
): Promise<RecommendationResponse> {
  let progressState = initialAnalysisProgressState();
  onProgress(progressState);

  const response = await fetch("/api/recommendations/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(formatErrorDetail(payload.detail), response.status);
  }

  return consumeSseStream(response, (event) => {
    progressState = applyProgressEvent(progressState, event);
    onProgress(progressState);
  });
}

export async function searchListings(
  body: ListingSearchRequest,
): Promise<ListingSearchResponse> {
  const response = await fetch("/api/listings/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(formatErrorDetail(payload.detail), response.status);
  }

  return payload as ListingSearchResponse;
}
