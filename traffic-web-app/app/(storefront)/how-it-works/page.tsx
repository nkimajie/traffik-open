import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import PageBanner from "@/components/storefront/page-banner";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How It Works — Traffik",
  description:
    "Learn how Traffik connects you with market stores across Nigeria — store-tied orders, escrow protection, and nationwide delivery.",
};

const shopperSteps = [
  {
    icon: Store,
    title: "Pick a market store",
    description:
      "Browse verified vendors from Balogun, Ariaria, Kurmi, Onitsha, and more. Every product is tied to a real store.",
  },
  {
    icon: Wallet,
    title: "Pay into escrow",
    description:
      "Your payment goes to Kashia Vault — not directly to the vendor. Funds are held safely until you receive your order.",
  },
  {
    icon: Truck,
    title: "Get it delivered",
    description:
      "Single-store orders ship direct from the vendor. Multi-store orders? Traffik consolidates for a small surcharge.",
  },
  {
    icon: ShieldCheck,
    title: "Confirm & release",
    description:
      "When your order arrives, confirm delivery. Escrow releases to the vendor. Not happy? Open a dispute.",
  },
];

const vendorSteps = [
  {
    icon: Store,
    title: "Create your store",
    description: "Sign up, verify your business, and list products from your market stall or shop.",
  },
  {
    icon: Package,
    title: "Receive orders",
    description: "Get notified when shoppers buy. Prepare and ship — or hand off for consolidation.",
  },
  {
    icon: Wallet,
    title: "Get paid on delivery",
    description: "Escrow releases when the shopper confirms. No chasing payments or chargebacks.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageBanner
        variant="gradient"
        eyebrow="How it works"
        title="Shop major markets with confidence"
        description="Traffik is built like Glovo for goods — every purchase tied to a store, every payment protected by escrow."
        breadcrumbs={[{ label: "How it works" }]}
      />

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-traffik-pink">
            For shoppers
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#030803] sm:text-3xl">
            Four steps to market goods at your door
          </h2>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shopperSteps.map((step, index) => (
              <article
                key={step.title}
                className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80"
              >
                <span className="text-4xl font-bold text-traffik-pink/15">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-traffik-pink/10">
                  <step.icon className="h-5 w-5 text-traffik-pink" aria-hidden />
                </div>
                <h3 className="mt-4 font-bold text-[#030803]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#484848]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-gray-100 bg-[#fafafa] py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-traffik-green">
            For vendors
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#030803] sm:text-3xl">
            Sell to shoppers nationwide
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {vendorSteps.map((step) => (
              <article
                key={step.title}
                className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-traffik-green/10">
                  <step.icon className="h-5 w-5 text-traffik-green" aria-hidden />
                </div>
                <h3 className="mt-4 font-bold text-[#030803]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#484848]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button variant="signIn" size="lg" asChild className="rounded-xl">
              <Link href="/vendors/sign-up">
                Start selling
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <ShieldCheck className="mx-auto h-12 w-12 text-traffik-green" aria-hidden />
          <h2 className="mt-4 text-2xl font-bold text-[#030803]">
            Powered by Kashia Vault escrow
          </h2>
          <p className="mt-4 leading-relaxed text-[#484848]">
            Every Traffik order goes through Kashia Vault. Your money is held securely until
            you confirm you received what you ordered. Vendors get paid fairly. Everyone wins.
          </p>
          <Link
            href="/stores"
            className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-traffik-pink hover:underline"
          >
            Browse market stores
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
