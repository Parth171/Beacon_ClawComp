"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import type { InspectedPhoto } from "@/lib/analyze/events";
import { pct } from "@/lib/analyze/format";
import { cn } from "@/lib/utils";

function PhotoTile({ photo }: { photo: InspectedPhoto }) {
  const flagged = photo.status === "done" && photo.hasIssues;
  const topFlag = photo.flags?.length
    ? [...photo.flags].sort((a, b) => b.confidence - a.confidence)[0]
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-md border bg-sand",
        photo.status === "running" && "border-accent ring-2 ring-accent/30",
        flagged && "border-red-700/50 ring-2 ring-red-700/20",
        photo.status === "done" && !flagged && "border-line",
        photo.status === "error" && "border-line opacity-50",
      )}
    >
      {photo.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.imageUrl}
          alt={topFlag ? `Photo flagged: ${topFlag.issue}` : "Listing photo"}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-opacity",
            photo.status === "running" && "opacity-80 animate-pulse",
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-ink-faint">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {/* status chip */}
      <div className="absolute left-1.5 top-1.5">
        {photo.status === "running" ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-canvas/90 text-accent shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
          </span>
        ) : flagged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-700 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            <AlertTriangle className="h-3 w-3" />
            {photo.flags?.length}
          </span>
        ) : photo.status === "done" ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-canvas/90 text-ink-muted shadow-sm">
            <Check className="h-3 w-3" />
          </span>
        ) : null}
      </div>

      {topFlag ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent px-2 pb-1.5 pt-5">
          <p className="truncate text-[11px] font-medium text-cream">
            {topFlag.issue}
            <span className="ml-1 text-cream-muted">· {pct(topFlag.confidence)}</span>
          </p>
        </div>
      ) : null}
    </motion.div>
  );
}

export function PhotoGrid({ photos }: { photos: InspectedPhoto[] }) {
  if (photos.length === 0) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        Waiting for photos…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {photos.map((photo) => (
          <PhotoTile key={photo.imageIndex} photo={photo} />
        ))}
      </AnimatePresence>
    </div>
  );
}
