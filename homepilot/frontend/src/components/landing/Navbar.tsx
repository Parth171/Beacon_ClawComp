import Link from "next/link";

import { MovingBorderButton } from "@/components/ui/moving-border";

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07080d]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-neutral-950 shadow-lg shadow-sky-500/20">
            H
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">HomePilot</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-neutral-400 md:flex">
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
          <a href="#agents" className="transition hover:text-white">
            Agents
          </a>
          <a href="#why" className="transition hover:text-white">
            Problem
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="hidden text-sm text-neutral-400 transition hover:text-white sm:inline"
          >
            Product
          </Link>
          <MovingBorderButton
            href="/search"
            className="h-10 bg-white px-5 text-sm text-neutral-950"
          >
            Start search
          </MovingBorderButton>
        </div>
      </div>
    </header>
  );
}
