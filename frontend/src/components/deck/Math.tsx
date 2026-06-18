"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Render a LaTeX string with KaTeX. Synchronous (renderToString), so it works in
 * SSR and the print tree alike. Invalid TeX renders in red rather than throwing.
 */
export function Tex({
  children,
  display = false,
  className,
}: {
  children: string;
  display?: boolean;
  className?: string;
}) {
  const html = katex.renderToString(children, {
    throwOnError: false,
    displayMode: display,
    output: "html",
  });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
