import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";

export default function Statement() {
  return (
    <section className="px-5 py-24 sm:px-8 sm:py-32">
      <Reveal className="mx-auto max-w-5xl">
        <h2 className="font-serif text-4xl font-normal leading-[1.08] tracking-[-0.01em] text-ink sm:text-6xl lg:text-[3.9rem]">
          One pipeline. Every signal weighted.{" "}
          <span className="text-ink-faint">A decision you can defend.</span>
        </h2>
        <div className="mt-12 grid gap-8 border-t border-line pt-8 sm:grid-cols-[1fr_1.3fr] sm:items-start">
          <Eyebrow>Why it matters</Eyebrow>
          <p className="max-w-xl text-lg leading-relaxed text-ink-muted">
            Most tools hand you a number. DealSense hands you the reasoning — corroborating
            evidence, conflicts named in the open, and a citation behind every claim — so your
            committee sees exactly how the verdict was reached.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
