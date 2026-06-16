import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/ui/reveal";
import { TESTIMONIALS } from "@/lib/content";

export default function Testimonials() {
  const [featured, ...rest] = TESTIMONIALS;

  return (
    <section id="customers" className="bg-sand px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow>Customers</Eyebrow>
          <figure className="mt-8 max-w-4xl">
            <blockquote className="font-serif text-3xl font-normal leading-[1.28] tracking-[-0.01em] text-ink sm:text-4xl lg:text-[2.55rem] lg:leading-[1.24]">
              “{featured.quote}”
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-line-strong text-xs font-medium text-ink">
                {featured.initials}
              </span>
              <span className="text-sm text-ink-muted">
                <span className="font-medium text-ink">{featured.name}</span> — {featured.role},{" "}
                {featured.company}
              </span>
            </figcaption>
          </figure>
        </Reveal>

        <StaggerGroup className="mt-16 grid gap-5 border-t border-line pt-12 sm:grid-cols-2">
          {rest.map((t) => (
            <StaggerItem key={t.name}>
              <figure className="flex h-full flex-col rounded-xl border border-line bg-canvas p-7">
                <blockquote className="flex-1 text-[15px] leading-7 text-ink">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5 text-sm text-ink-muted">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-line-strong text-xs font-medium text-ink">
                    {t.initials}
                  </span>
                  <span>
                    <span className="font-medium text-ink">{t.name}</span> — {t.role}, {t.company}
                  </span>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
