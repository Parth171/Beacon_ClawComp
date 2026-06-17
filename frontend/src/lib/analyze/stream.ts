import type { ProgressEvent } from "./events";
import type { AnalyzeReport } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String((item as { msg: unknown }).msg)
          : JSON.stringify(item),
      )
      .join("; ");
  }
  if (typeof detail === "object" && detail !== null) return JSON.stringify(detail);
  return "Request failed.";
}

/**
 * Read a POST SSE stream: parse `data:`-framed JSON events, push each to
 * `onEvent`, resolve with the `complete` result, throw `ApiError` on `error`.
 * Ported from the homepilot app's `consumeSseStream`.
 */
async function consumeSseStream(
  response: Response,
  onEvent: (event: ProgressEvent) => void,
): Promise<AnalyzeReport> {
  if (!response.body) {
    throw new ApiError("No response stream returned.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AnalyzeReport | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);

      if (chunk.startsWith("data:")) {
        const event = JSON.parse(chunk.slice(5).trim()) as ProgressEvent;
        onEvent(event);

        if (event.type === "error") {
          throw new ApiError(event.message, event.status ?? 500);
        }
        if (event.type === "complete") {
          finalResult = event.result;
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

/** Kick off an analysis and stream its progress events back to `onEvent`. */
export async function runAnalyze(
  listingUrl: string,
  onEvent: (event: ProgressEvent) => void,
): Promise<AnalyzeReport> {
  const response = await fetch("/api/analyze/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingUrl }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      formatErrorDetail((payload as { detail?: unknown }).detail),
      response.status,
    );
  }

  return consumeSseStream(response, onEvent);
}
