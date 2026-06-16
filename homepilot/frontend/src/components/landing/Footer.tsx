import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-950 text-xs font-bold text-white">
            H
          </span>
          <span className="text-sm font-medium text-neutral-900">HomePilot</span>
        </div>

        <nav className="flex flex-wrap justify-center gap-6 text-sm text-neutral-500">
          <Link href="/search" className="transition hover:text-neutral-900">
            Product
          </Link>
          <Link href="#start" className="transition hover:text-neutral-900">
            Start
          </Link>
          <a href="#how-it-works" className="transition hover:text-neutral-900">
            How it works
          </a>
          <a href="#agents" className="transition hover:text-neutral-900">
            Agents
          </a>
        </nav>

        <p className="text-xs text-neutral-400">
          © {new Date().getFullYear()} HomePilot. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
