import type { AnalyzeReport } from "@/lib/analyze/types";
import type { LoiData } from "./types";

/** POST the completed analysis to Agent 6 and get back the LOI document data. */
export async function generateLoi(report: AnalyzeReport): Promise<LoiData> {
  const res = await fetch("/api/loi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? "Could not generate the letter of intent.");
  }

  return (await res.json()) as LoiData;
}
