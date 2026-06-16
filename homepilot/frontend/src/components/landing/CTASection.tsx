import { MovingBorderButton } from "@/components/ui/moving-border";

export default function CTASection() {
  return (
    <section id="start" className="border-t border-neutral-200 bg-neutral-50 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-2xl shadow-neutral-200/80 sm:p-12">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-600">
          Start searching
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-5xl">
          Bring the Telegram brief into a real workspace.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-600">
          Enter budget, location, family needs, pets, commute, and preferences. HomePilot finds
          candidate homes, runs the agents, and gives you an explainable ranked shortlist.
        </p>

        <div className="mt-8 flex justify-center">
          <MovingBorderButton
            href="/search"
            className="h-12 bg-neutral-950 px-7 text-white"
          >
            Open HomePilot
          </MovingBorderButton>
        </div>
      </div>
    </section>
  );
}
