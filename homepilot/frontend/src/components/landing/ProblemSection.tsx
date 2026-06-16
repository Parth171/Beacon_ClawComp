const painPoints = [
  "Listing photos hide repair risk and deferred maintenance",
  "Asking price does not explain the real monthly cost",
  "School ratings rarely match your commute and household needs",
  "Comparable sales are buried across too many tabs",
  "Neighborhood upside is hard to reason about under pressure",
];

export default function ProblemSection() {
  return (
    <section id="why" className="relative overflow-hidden bg-[#080a0f] py-24 text-white sm:py-28">
      <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
              The overhead problem
            </p>
            <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Every listing has hidden overhead.{" "}
              <span className="font-serif italic text-neutral-400">None of it is obvious.</span>
            </h2>
            <p className="mt-6 max-w-xl leading-8 text-neutral-400">
              Buyers spend hours cross-referencing tax records, school districts, and repair
              estimates, then still make offers based on gut feel. HomePilot eliminates that
              manual assembly with AI agents built for how families actually buy homes.
            </p>
          </div>

          <ul className="space-y-4">
            {painPoints.map((point) => (
              <li
                key={point}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-2xl shadow-black/10 backdrop-blur"
              >
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/10 ring-1 ring-sky-400/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                </span>
                <span className="text-sm leading-6 text-neutral-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
