import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/reveal";
import { PIPELINE_STAGES } from "@/lib/content";

export default function Pipeline() {
  return (
    <section id="pipeline" className="bg-night px-5 py-24 text-cream sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow tone="cream">The workflow</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] sm:text-5xl">
            From listing link to signed LOI.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream-muted">
            Six steps run on every property — sequentially, locally, each agent handing its evidence
            to the next.
          </p>
        </Reveal>

        {/* Desktop: horizontal graph */}
        <div className="relative mt-16 hidden lg:block">
          <div className="absolute inset-x-0 top-6 border-t border-dashed border-[rgba(192,87,59,0.4)]" />
          <StaggerGroup className="grid grid-cols-6 gap-4">
            {PIPELINE_STAGES.map((s) => (
              <StaggerItem key={s.step} className="text-center">
                <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line-cream bg-night text-cream">
                  <s.icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="mt-4 block font-mono text-[11px] text-cream-muted">{s.step}</span>
                <h3 className="mt-1 text-sm font-medium text-cream">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-[20ch] text-xs leading-5 text-cream-muted">
                  {s.description}
                </p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>

        {/* Mobile / tablet: vertical timeline */}
        <StaggerGroup className="relative mt-12 space-y-7 lg:hidden">
          <div className="absolute bottom-4 left-6 top-4 border-l border-dashed border-[rgba(192,87,59,0.4)]" />
          {PIPELINE_STAGES.map((s) => (
            <StaggerItem key={s.step} className="relative flex gap-4">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-cream bg-night text-cream">
                <s.icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <div className="pt-1">
                <span className="font-mono text-[11px] text-cream-muted">{s.step}</span>
                <h3 className="text-sm font-medium text-cream">{s.title}</h3>
                <p className="mt-1 text-sm leading-6 text-cream-muted">{s.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
