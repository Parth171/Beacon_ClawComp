"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

const EXAMPLE =
  "https://www.realtor.ca/real-estate/29867678/18-535-windflower-crescent-kitchener";

export function PasteForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (url: string) => void;
  submitting: boolean;
}) {
  const [url, setUrl] = useState("");
  const trimmed = url.trim();
  const valid = /^https?:\/\//i.test(trimmed);

  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow className="justify-center">Live underwrite</Eyebrow>

      <h1 className="mt-6 font-serif text-[2.75rem] font-normal leading-[1.05] tracking-[-0.015em] text-ink sm:text-6xl">
        Paste a listing. Watch it get inspected.
      </h1>

      <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
        Beacon scrapes the listing and runs a local vision model over every photo. You&apos;ll
        see each agent work in real time — and exactly where every number comes from.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !submitting) onSubmit(trimmed);
        }}
        className="mx-auto mt-9 flex max-w-xl flex-col gap-3 sm:flex-row"
      >
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a realtor.ca, realtor.com, or Redfin URL"
          disabled={submitting}
          className="h-12 flex-1 rounded-md border border-line bg-canvas px-4 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!valid || submitting}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-sm font-medium transition-colors",
            "bg-ink text-canvas hover:bg-ink/88",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {submitting ? "Running…" : "Run inspection"}
          {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setUrl(EXAMPLE)}
        disabled={submitting}
        className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint underline-offset-4 transition-colors hover:text-accent disabled:opacity-50"
      >
        Use an example listing
      </button>

      <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-ink-faint">
        Supports realtor.ca, realtor.com, and Redfin listing URLs. Municipal records are
        richest for NYC addresses. One analysis runs at a time on local hardware.
      </p>
    </div>
  );
}
