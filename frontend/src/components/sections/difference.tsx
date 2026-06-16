import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/reveal";
import { DIFFERENCE } from "@/lib/content";

export default function Difference() {
  return (
    <section className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>The foundation</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-ink sm:text-5xl">
            What makes a verdict trustworthy.
          </h2>
        </Reveal>

        <StaggerGroup className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {DIFFERENCE.map((d) => (
            <StaggerItem key={d.title} className="bg-canvas">
              <div className="h-full p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink">
                  <d.icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <h3 className="mt-5 text-lg font-medium text-ink">{d.title}</h3>
                <p className="mt-2.5 text-[15px] leading-7 text-ink-muted">{d.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
