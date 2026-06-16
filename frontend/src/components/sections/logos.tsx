import { Reveal } from "@/components/ui/reveal";
import { LOGOS } from "@/lib/content";

export default function Logos() {
  return (
    <section className="px-5 pb-10 sm:px-8">
      <Reveal className="mx-auto max-w-6xl">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          Built for the way modern acquisition teams underwrite
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {LOGOS.map((l) => (
            <span key={l} className="text-base font-medium tracking-tight text-ink-faint">
              {l}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
