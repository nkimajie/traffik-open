import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CtaBandProps = {
  title?: string;
  description?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  variant?: "gradient" | "dark";
};

export default function CtaBand({
  title = "Ready to sell on Traffik?",
  description = "Join vendors building their business on the marketplace. Sign up today and set up your store in minutes.",
  primaryLabel = "Create account",
  primaryHref = "/auth/sign-up",
  secondaryLabel = "Sign in",
  secondaryHref = "/auth/sign-in",
  variant = "gradient",
}: CtaBandProps) {
  return (
    <section
      className={cn(
        "py-16 sm:py-20",
        variant === "gradient"
          ? "bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green"
          : "bg-gray-900",
      )}
    >
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">{title}</h2>
        <p className="mt-4 text-lg text-white/90">{description}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="w-full bg-white text-[#030803] hover:bg-white/90 sm:w-auto"
          >
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="w-full border-white bg-transparent text-white hover:bg-white/10 sm:w-auto"
          >
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
