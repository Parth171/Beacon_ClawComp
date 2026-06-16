const steps = [
  {
    number: "01",
    title: "Collect",
    subtitle: "Drop in the homes you are considering",
    description:
      "Add listing links and the few constraints that matter: budget, commute, schools, pets, and timing.",
  },
  {
    number: "02",
    title: "Inspect",
    subtitle: "Agents review each home in parallel",
    description:
      "Specialists evaluate condition, monthly cost, family fit, fair value, and neighborhood trajectory.",
  },
  {
    number: "03",
    title: "Decide",
    subtitle: "Get the shortlist worth touring",
    description:
      "A single recommendation layer explains the tradeoffs and shows the numbers behind each score.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-neutral-50 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-sky-600">
              How it works
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-neutral-950 sm:text-5xl">
              The entire home search workflow.{" "}
              <span className="font-serif italic text-neutral-500">Automated.</span>
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-neutral-600 lg:justify-self-end">
            HomePilot connects buyer context, multi-agent analysis, and ranked recommendations in
            one flow. It replaces the late-night browser tabs with a clear, inspectable decision
            system.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="group relative overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-neutral-200/80"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 opacity-0 transition group-hover:opacity-100" />
              <span className="font-mono text-xs font-medium text-neutral-400">{step.number}</span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950">
                {step.title}
              </h3>
              <p className="mt-2 text-sm font-medium text-sky-600">{step.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed text-neutral-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
