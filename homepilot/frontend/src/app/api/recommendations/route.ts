import { NextResponse } from "next/server";

import type { RecommendationRequest } from "@/types/api";

const DEFAULT_API_URL = "http://127.0.0.1:8000";
const TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  const apiUrl = process.env.HOMEPILOT_API_URL ?? DEFAULT_API_URL;
  let body: RecommendationRequest;

  try {
    body = (await request.json()) as RecommendationRequest;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${apiUrl}/api/v1/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await upstream.json().catch(() => ({
      detail: "Upstream returned a non-JSON response.",
    }));

    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { detail: "Recommendation request timed out after 120 seconds." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        detail:
          "Could not reach the HomePilot API. Is the backend running on port 8000?",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
