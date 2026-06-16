import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "default",
}: {
  className?: string;
  tone?: "ink" | "cream";
  size?: "default" | "lg";
}) {
  return (
    <Link href="#hero" className={cn("inline-flex shrink-0", className)}>
      <Image
        src="/beacon-logo.png"
        alt="beacon"
        width={554}
        height={451}
        priority
        className={cn("w-auto", size === "lg" ? "h-12 sm:h-14" : "h-10")}
      />
    </Link>
  );
}
