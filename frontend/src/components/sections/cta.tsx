import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

export default function Cta() {
  return (
    <section id="cta" className="px-5 py-24 sm:px-8 sm:py-32">
      <Reveal className="mx-auto max-w-4xl rounded-2xl border border-line bg-sand px-6 py-16 text-center sm:px-12 sm:py-20">
        <h2 className="mx-auto max-w-2xl font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-ink sm:text-5xl">
          Ready to underwrite smarter?
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-ink-muted">
          See Beacon run on one of your live listings — an evidence-backed BUY or PASS before the
          showing ends.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="mailto:hello@beacon.ai" variant="primary" className="px-6">
            Request a demo
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button href="#pipeline" variant="secondary" className="px-6">
            See how it works
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
