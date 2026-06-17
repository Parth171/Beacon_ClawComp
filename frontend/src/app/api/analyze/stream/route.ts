import { NextResponse } from "next/server";

// Stream the backend's analyze SSE through to the browser. Same-origin proxy so the
// client never needs CORS and the backend URL stays server-side.
export const dynamic = "force-dynamic";

const DEFAULT_API_URL = "http://127.0.0.1:8000";
// Backstop for establishing the upstream connection only. It is cleared in `finally`
// as soon as the response headers arrive, so the (potentially multi-minute) SSE body
// streams without a timeout — a full vision inspection must never be cut off.
const CONNECT_TIMEOUT_MS = 600_000;

export async function POST(request: Request) {
  const apiUrl = process.env.DEALSENSE_API_URL ?? DEFAULT_API_URL;
  const body = await request.text();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${apiUrl}/api/v1/analyze/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const payload = await upstream
        .json()
        .catch(() => ({ detail: "Upstream analyze stream failed." }));
      return NextResponse.json(payload, { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { detail: "Could not reach the DealSense API in time." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      {
        detail:
          "Could not reach the DealSense API. Is the backend running on port 8000?",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
