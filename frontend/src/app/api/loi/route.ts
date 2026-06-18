import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import type { AnalyzeReport } from "@/lib/analyze/types";
import type { LoiData } from "@/lib/loi/types";
import { LOI_SCHEMA, buildMockLoi, buildPrompt } from "@/lib/loi/schema";

// Agent 6 — synthesise the Letter of Intent data with Claude. Server-side so the
// API key stays off the client. Falls back to a deterministic mock when no key is
// set or the call fails, so the document always renders.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  let report: AnalyzeReport;
  try {
    report = (await request.json()) as AnalyzeReport;
  } catch {
    return NextResponse.json({ detail: "Invalid request body." }, { status: 400 });
  }

  if (!report?.property || !report?.inspection) {
    return NextResponse.json({ detail: "Missing analysis data." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(buildMockLoi(report));
  }

  try {
    const client = new Anthropic();

    // output_config (structured outputs) and adaptive thinking may be newer than
    // the installed SDK's static types, but the SDK forwards them to the API
    // verbatim — cast through unknown to keep the non-streaming return type.
    const params = {
      model: "claude-opus-4-8",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: LOI_SCHEMA },
      },
      messages: [{ role: "user", content: buildPrompt(report) }],
    };

    const message = await client.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    const text = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    const data = extractJson(text) as LoiData;

    if (!data?.offerTerms || !Array.isArray(data?.futureCosts)) {
      throw new Error("Model returned an unexpected shape.");
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[loi] generation failed, using mock fallback:", err);
    return NextResponse.json(buildMockLoi(report));
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("No JSON object found in model response.");
  }
}
