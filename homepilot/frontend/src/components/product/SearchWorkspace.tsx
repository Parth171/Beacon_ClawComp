"use client";

import { ArrowRight, Bot, CheckCircle2, Home, Loader2, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import AgentPipeline from "@/components/home/AgentPipeline";
import PropertyReport from "@/components/home/PropertyReport";
import SearchBriefForm from "@/components/product/SearchBriefForm";
import { fetchRecommendationsWithProgress, searchListings, ApiError } from "@/lib/api";
import { initialAnalysisProgressState } from "@/lib/agents";
import { parseListingUrls } from "@/lib/demo";
import { formatCurrency } from "@/lib/scoring";
import {
  defaultSearchBrief,
  parseCurrency,
  searchBriefToBuyerProfile,
  searchBriefToListingSearchRequest,
  type ListingSearchResponse,
  type SearchBrief,
} from "@/lib/search";
import { saveRecommendations } from "@/lib/session";
import type { PropertyListing, RecommendationResponse } from "@/types/api";

type Phase = "brief" | "searching" | "analyzing" | "results" | "error";

const phaseCopy: Record<Phase, { title: string; body: string }> = {
  brief: {
    title: "Ready when you are.",
    body: "Give me the same brief you would send in Telegram. I will find candidate homes, run the specialist agents, and rank the shortlist.",
  },
  searching: {
    title: "Finding candidate homes.",
    body: "I am matching your budget, location, bedroom, commute, and lifestyle preferences against the current discovery contract.",
  },
  analyzing: {
    title: "Agents are reviewing the shortlist.",
    body: "Condition, true cost, family fit, fair value, and future outlook are being scored in parallel.",
  },
  results: {
    title: "Your ranked shortlist is ready.",
    body: "Open any property to inspect tradeoffs, formulas, assumptions, and agent-level reasoning.",
  },
  error: {
    title: "I hit a blocker.",
    body: "Adjust the brief or confirm the backend is running, then try again.",
  },
};

const assistantSteps = ["Brief", "Search", "Analyze"] as const;

function CandidateCard({ property }: { property: PropertyListing }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">
            {property.location?.address ?? property.id}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {property.location?.city ?? "Unknown area"}
            {property.bedrooms != null ? ` · ${property.bedrooms} bed` : ""}
          </p>
        </div>
        <p className="text-sm font-semibold text-sky-200">
          {formatCurrency(property.listing_price)}
        </p>
      </div>
    </div>
  );
}

function AssistantPanel({
  phase,
  discovery,
  candidates,
  error,
}: {
  phase: Phase;
  discovery: ListingSearchResponse | null;
  candidates: PropertyListing[];
  error: string | null;
}) {
  const copy = phaseCopy[phase];

  return (
    <aside className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-neutral-950">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">HomePilot assistant</p>
          <p className="text-xs text-neutral-500">Search, analyze, explain</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-medium text-white">{copy.title}</p>
        <p className="mt-2 text-sm leading-6 text-neutral-400">{copy.body}</p>
        {error ? <p className="mt-3 text-sm leading-6 text-rose-300">{error}</p> : null}
      </div>

      <div className="mt-5 space-y-3">
        {assistantSteps.map((label) => {
          const done =
            (label === "Brief" && phase !== "brief") ||
            (label === "Search" && Boolean(discovery)) ||
            (label === "Analyze" && phase === "results");

          return (
          <div key={String(label)} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                done ? "bg-emerald-400/10 text-emerald-300" : "bg-white/10 text-neutral-500"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className={done ? "text-neutral-200" : "text-neutral-500"}>{label}</span>
          </div>
          );
        })}
      </div>

      {phase === "searching" ? (
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching for matching homes...
        </div>
      ) : null}

      {discovery ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            Discovery
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-300">{discovery.summary}</p>
          <p className="mt-2 text-xs text-neutral-500">
            Source: {discovery.source === "demo" ? "demo search contract" : "live search"}
          </p>
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            Candidate homes
          </p>
          {candidates.slice(0, 4).map((property) => (
            <CandidateCard key={property.id} property={property} />
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export default function SearchWorkspace() {
  const [brief, setBrief] = useState<SearchBrief>(defaultSearchBrief);
  const [phase, setPhase] = useState<Phase>("brief");
  const [discovery, setDiscovery] = useState<ListingSearchResponse | null>(null);
  const [candidates, setCandidates] = useState<PropertyListing[]>([]);
  const [progress, setProgress] = useState(initialAnalysisProgressState());
  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formattedBudget = useMemo(() => {
    const budget = parseCurrency(brief.budget);
    return Number.isFinite(budget) && budget > 0 ? formatCurrency(budget) : "your budget";
  }, [brief.budget]);

  const runSearch = useCallback(async (nextBrief: SearchBrief = brief, useDemo = false) => {
    setError(null);
    setPhase("searching");
    setDiscovery(null);
    setCandidates([]);
    setResults(null);
    setProgress(initialAnalysisProgressState());

    try {
      const buyer = searchBriefToBuyerProfile(nextBrief);
      if (!Number.isFinite(buyer.budget) || buyer.budget <= 0) {
        throw new Error("Enter a valid budget before searching.");
      }

      const listingUrls = parseListingUrls(nextBrief.listingUrls);
      const searchResponse =
        listingUrls.length > 0
          ? ({
              properties: [],
              source: "live",
              summary: `Using ${listingUrls.length} pasted listing URL${
                listingUrls.length === 1 ? "" : "s"
              }. HomePilot will fetch the listing details during analysis.`,
            } satisfies ListingSearchResponse)
          : await searchListings({
              ...searchBriefToListingSearchRequest(nextBrief),
              useDemo,
            });

      setDiscovery(searchResponse);
      setCandidates(searchResponse.properties);

      const properties = searchResponse.properties;
      if (properties.length === 0 && listingUrls.length === 0) {
        throw new Error("No candidate homes found. Try broadening the location or budget.");
      }

      setPhase("analyzing");
      const response = await fetchRecommendationsWithProgress(
        {
          buyer,
          properties,
          listing_urls: listingUrls,
        },
        setProgress,
      );

      saveRecommendations(response);
      setResults(response);
      setPhase("results");

      setTimeout(() => {
        document.getElementById("ranked-results")?.scrollIntoView({ behavior: "smooth" });
      }, 250);
    } catch (submitError) {
      setPhase("error");
      if (submitError instanceof ApiError || submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("HomePilot could not finish this search.");
      }
    }
  }, [brief]);

  const useDemoSearch = useCallback(() => {
    setBrief(defaultSearchBrief);
    void runSearch(defaultSearchBrief, true);
  }, [runSearch]);

  const resetSearch = () => {
    setPhase("brief");
    setDiscovery(null);
    setCandidates([]);
    setResults(null);
    setError(null);
    setProgress(initialAnalysisProgressState());
  };

  return (
    <main className="min-h-screen bg-[#07080d] text-white">
      {phase === "analyzing" ? <AgentPipeline progress={progress} /> : null}

      <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_34%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-neutral-950">
              H
            </span>
            <span className="text-sm font-semibold">HomePilot</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-neutral-400 transition hover:text-white"
          >
            Landing
          </Link>
        </header>

        <section className="pt-12 lg:pt-16">
          <div className="mb-8 max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-neutral-300">
              <Search className="h-3.5 w-3.5 text-sky-300" />
              Searching around {formattedBudget}
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
              Your AI home search workspace.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-400">
              Start with a natural buyer brief. HomePilot finds candidate homes, runs specialist
              analysis, and turns the mess into a ranked shortlist you can actually act on.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
            <SearchBriefForm
              values={brief}
              onChange={setBrief}
              onSubmit={() => void runSearch()}
              onUseDemo={useDemoSearch}
              loading={phase === "searching" || phase === "analyzing"}
            />
            <AssistantPanel
              phase={phase}
              discovery={discovery}
              candidates={candidates}
              error={error}
            />
          </div>
        </section>

        {results ? (
          <section id="ranked-results" className="py-16">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-300">
                  Ranked dashboard
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">
                  {results.recommendations.length} homes ranked for your brief.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
                  Expand the agent sections to see the reasoning, assumptions, and formulas behind
                  each recommendation.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resetSearch}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                  Adjust brief
                </button>
                <Link
                  href="/results"
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
                >
                  Open report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="space-y-6">
              {results.recommendations.map((recommendation, index) => (
                <PropertyReport
                  key={recommendation.property.id}
                  recommendation={recommendation}
                  index={index}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="py-14">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
              <Home className="mx-auto h-8 w-8 text-neutral-500" />
              <h2 className="mt-4 text-xl font-semibold">Ranked homes will appear here.</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">
                Run a search to see the full HomePilot product flow: discovery, agent analysis, and
                explainable recommendations in one workspace.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
