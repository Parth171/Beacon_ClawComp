import { CountUp } from "@/components/ui/count-up";
import { StaggerGroup, StaggerItem } from "@/components/ui/reveal";
import { STATS } from "@/lib/content";

export default function Stats() {
  return (
    <section className="bg-sand px-5 py-20 sm:px-8 sm:py-24">
      <StaggerGroup className="mx-auto grid max-w-6xl gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <StaggerItem key={s.label}>
            <div className="border-t border-line-strong pt-5">
              <div className="font-serif text-5xl font-normal tracking-tight text-ink lg:text-6xl">
                <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{s.label}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
