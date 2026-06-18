"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { AgentRun } from "@/components/analyze/AgentRun";
import { InspectionReport } from "@/components/analyze/InspectionReport";
import { PasteForm } from "@/components/analyze/PasteForm";
import { LoiDocument } from "@/components/loi/LoiDocument";
import {
  applyEvent,
  initialAnalyzeState,
  type AnalyzeState,
} from "@/lib/analyze/events";
import { runAnalyze } from "@/lib/analyze/stream";
import type { AnalyzeReport } from "@/lib/analyze/types";
import { generateLoi } from "@/lib/loi/generate";
import type { LoiData } from "@/lib/loi/types";

type View = "idle" | "running" | "report" | "loi" | "error";

const FADE = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function AnalyzeApp() {
  const [view, setView] = useState<View>("idle");
  const [live, setLive] = useState<AnalyzeState | null>(null);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loiData, setLoiData] = useState<LoiData | null>(null);
  const [generatingLoi, setGeneratingLoi] = useState(false);

  async function handleSubmit(url: string) {
    setSubmitting(true);
    setErrorMsg(null);
    setReport(null);
    setLive(initialAnalyzeState(url));
    setView("running");

    try {
      const result = await runAnalyze(url, (event) => {
        setLive((prev) => (prev ? applyEvent(prev, event) : prev));
      });
      setReport(result);
      setView("report");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setView("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateLoi() {
    if (!report || generatingLoi) return;
    setGeneratingLoi(true);
    setErrorMsg(null);
    try {
      // Reuse a prior draft if one exists for this report.
      const data = loiData ?? (await generateLoi(report));
      setLoiData(data);
      setView("loi");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not generate the letter of intent.");
      setView("error");
    } finally {
      setGeneratingLoi(false);
    }
  }

  function reset() {
    setView("idle");
    setLive(null);
    setReport(null);
    setErrorMsg(null);
    setLoiData(null);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === "idle" ? (
        <motion.div key="idle" {...FADE}>
          <PasteForm onSubmit={handleSubmit} submitting={submitting} />
        </motion.div>
      ) : view === "running" && live ? (
        <motion.div key="running" {...FADE}>
          <AgentRun state={live} />
        </motion.div>
      ) : view === "report" && report ? (
        <motion.div key="report" {...FADE}>
          <InspectionReport
            report={report}
            onReset={reset}
            onGenerateLoi={handleGenerateLoi}
            generatingLoi={generatingLoi}
          />
        </motion.div>
      ) : view === "loi" && report && loiData ? (
        <motion.div key="loi" {...FADE}>
          <LoiDocument data={loiData} report={report} onBack={() => setView("report")} />
        </motion.div>
      ) : view === "error" ? (
        <motion.div key="error" {...FADE} className="mx-auto max-w-lg text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-700/30 bg-red-700/5 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="mt-5 font-serif text-2xl font-normal text-ink">
            The analysis couldn&apos;t finish
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-7 inline-flex h-11 items-center justify-center rounded-md bg-ink px-6 text-sm font-medium text-canvas transition-colors hover:bg-ink/88"
          >
            Try another listing
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
