import { Accordion } from "@/components/ui/accordion";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { FAQS } from "@/lib/content";

export default function Faq() {
  return (
    <section id="faq" className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl font-normal leading-[1.1] tracking-[-0.01em] text-ink sm:text-5xl">
            Questions, answered.
          </h2>
        </Reveal>
        <Reveal className="mt-12">
          <Accordion items={FAQS} />
        </Reveal>
      </div>
    </section>
  );
}
