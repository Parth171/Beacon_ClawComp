import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "What it does", href: "#pillars" },
      { label: "How it works", href: "#pipeline" },
      { label: "Customers", href: "#customers" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contact", href: "mailto:hello@dealsense.ai" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-7 text-ink-muted">
              Autonomous real estate underwriting that runs locally — from listing URL to a cited
              BUY or PASS in minutes.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                {col.title}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-faint">© {year} DealSense. All rights reserved.</p>
          <p className="text-xs text-ink-faint">
            Runs locally on Apple Silicon · No data leaves your network.
          </p>
        </div>
      </div>
    </footer>
  );
}
