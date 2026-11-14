import Link from "next/link";
import {
  ArrowRight,
  Headphones,
  Package,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import SectionHeader from "@/components/storefront/section-header";

const steps = [
  {
    icon: Store,
    step: "01",
    title: "Pick a market store",
    description: "Every product belongs to a real vendor — Balogun, Ariaria, Kurmi, and more.",
    color: "text-traffik-pink",
    bg: "bg-traffik-pink/10",
  },
  {
    icon: Truck,
    step: "02",
    title: "One store or several",
    description: "Single-store orders ship direct. Multi-store? Traffik consolidates for a small fee.",
    color: "text-traffik-amber",
    bg: "bg-traffik-amber/15",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Pay with escrow",
    description: "Kashia Vault holds your money until you confirm delivery. Vendors get paid fairly.",
    color: "text-traffik-green",
    bg: "bg-traffik-green/10",
  },
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "Escrow protected",
    description: "Every order, no exceptions.",
  },
  {
    icon: Store,
    title: "Verified vendors",
    description: "KYC before they can sell.",
  },
  {
    icon: Package,
    title: "Per-store tracking",
    description: "See progress for each store.",
  },
  {
    icon: Headphones,
    title: "Human support",
    description: "Real people handle disputes.",
  },
];

export default function WhyTraffik() {
  return (
    <section aria-labelledby="why-heading" className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Why Traffik"
          eyebrowColor="green"
          title="Built for market shopping, not food delivery"
          description="Store-tied orders, transparent delivery, and escrow on every purchase — that's the Traffik difference."
          align="center"
        />

        {/* How it works steps */}
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-gray-100 bg-[#fafafa] p-6 transition-shadow hover:shadow-md"
            >
              <span className={`text-3xl font-black ${step.color} opacity-30`}>
                {step.step}
              </span>
              <div
                className={`mt-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${step.bg}`}
              >
                <step.icon className={`h-5 w-5 ${step.color}`} aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#030803]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#484848]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        {/* Trust strip */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-traffik-pink/5 via-traffik-amber/5 to-traffik-green/5 p-6 ring-1 ring-gray-100 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((point) => (
              <div key={point.title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                  <point.icon className="h-4 w-4 text-traffik-pink" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#030803]">{point.title}</p>
                  <p className="text-xs text-[#484848]">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-traffik-pink transition-colors hover:text-traffik-pink/80"
          >
            Full breakdown of how Traffik works
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
