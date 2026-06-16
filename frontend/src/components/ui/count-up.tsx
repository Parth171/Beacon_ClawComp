"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/** Counts from 0 to `to` once it scrolls into view. */
export function CountUp({
  to,
  suffix = "",
  prefix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !started.current) {
          started.current = true;
          animate(0, to, {
            duration,
            ease: [0.22, 1, 0.36, 1],
            onUpdate: (v) => setValue(v),
          });
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration, reduce]);

  const shown = reduce ? to : value;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {Math.round(shown)}
      {suffix}
    </span>
  );
}
