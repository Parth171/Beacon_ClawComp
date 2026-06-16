"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import PropertyReport from "@/components/home/PropertyReport";
import { loadRecommendations } from "@/lib/session";
import type { RecommendationResponse } from "@/types/api";

function subscribeToSessionStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
}

function getStoredRecommendations(): RecommendationResponse | null {
  return loadRecommendations();
}

function getServerRecommendations(): RecommendationResponse | null {
  return null;
}

export default function ResultsPage() {
  const response = useSyncExternalStore(
    subscribeToSessionStorage,
    getStoredRecommendations,
    getServerRecommendations,
  );

  if (!response?.recommendations.length) {
    return (
      <main className="min-h-screen bg-[#030712] px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-white">No results yet</h1>
        <p className="mt-3 text-slate-400">Run a search to generate a ranked HomePilot report.</p>
        <Link
          href="/search"
          className="mt-8 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-950 hover:bg-slate-200"
        >
          Start search
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030712] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-white">Saved results</h1>
          <p className="mt-2 text-slate-400">
            {response.recommendations.length} ranked propert
            {response.recommendations.length === 1 ? "y" : "ies"}
          </p>
          <Link
            href="/search"
            className="mt-4 inline-block text-sm text-sky-300 hover:text-sky-200"
          >
            Back to search
          </Link>
        </header>
        <div className="space-y-6">
          {response.recommendations.map((rec, i) => (
            <PropertyReport key={rec.property.id} recommendation={rec} index={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
