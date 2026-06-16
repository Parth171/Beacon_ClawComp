import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "primaryOnDark" | "secondaryOnDark";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-canvas hover:bg-ink/88",
  secondary: "border border-line-strong text-ink hover:bg-sand",
  primaryOnDark: "bg-cream text-night hover:bg-white",
  secondaryOnDark: "border border-line-cream text-cream hover:bg-white/[0.06]",
};

export function Button({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-medium transition-colors",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
