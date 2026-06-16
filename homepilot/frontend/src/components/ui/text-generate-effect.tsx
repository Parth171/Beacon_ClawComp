"use client";

import { motion, stagger, useAnimate } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function TextGenerateEffect({
  words,
  className,
  filter = true,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}) {
  const [scope, animate] = useAnimate();
  const wordArray = words.split(" ");

  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration,
        delay: stagger(0.08),
      },
    );
  }, [animate, duration, filter]);

  return (
    <motion.div ref={scope}>
      <div className={cn("text-2xl font-bold leading-snug tracking-wide", className)}>
        {wordArray.map((word, idx) => (
          <motion.span
            key={`${word}-${idx}`}
            className="inline-block opacity-0"
            style={{ filter: filter ? "blur(10px)" : "none" }}
          >
            {word}{" "}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
