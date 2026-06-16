import { NextResponse } from "next/server";

const DEFAULT_API_URL = "http://127.0.0.1:8000";
const TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  const apiUrl = process.env.HOMEPILOT_API_URL ?? DEFAULT_API_URL;
  const body = await request.text();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${apiUrl}/api/v1/recommendations/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const payload = await upstream.json().catch(() => ({
        detail: "Upstream stream failed.",
      }));

      return NextResponse.json(payload, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { detail: "Recommendation stream timed out after 120 seconds." },
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
