const stats = [
  { value: "5", label: "specialist agents review every serious listing" },
  { value: "0", label: "spreadsheets needed to compare tradeoffs" },
  { value: "1", label: "ranked shortlist for the homes worth touring" },
];

export default function StatsSection() {
  return (
    <section className="relative border-y border-neutral-200 bg-white py-16">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-3 sm:px-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-6 transition hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-neutral-200/60"
          >
            <p className="text-5xl font-semibold tracking-[-0.05em] text-neutral-950">
              {stat.value}
            </p>
            <p className="mt-3 max-w-60 text-sm leading-6 text-neutral-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
