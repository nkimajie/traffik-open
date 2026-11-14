import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "to begin",
    description: "Everything you need to launch your store on Traffik.",
    features: [
      "Vendor account & onboarding",
      "Product catalog management",
      "Order notifications",
      "Basic dashboard analytics",
      "Logo & cover photo uploads",
    ],
    cta: "Get started",
    href: "/auth/sign-up",
    highlighted: true,
  },
  {
    name: "Growth",
    price: "Soon",
    period: "premium tools",
    description: "Advanced features for scaling vendors — coming later.",
    features: [
      "Priority store placement",
      "Advanced analytics",
      "Promotional tools",
      "Dedicated support",
      "Bulk product import",
    ],
    cta: "Join waitlist",
    href: "/about",
    highlighted: false,
  },
];

export default function VendorPricing() {
  return (
    <section id="pricing" className="bg-[#f2f2f2] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-traffik-amber">
            Pricing
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#030803] sm:text-4xl">
            Start free, grow when you&apos;re ready
          </h2>
          <p className="mt-4 text-lg text-[#484848]">
            No upfront cost to join Traffik. List products and start selling
            today.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-traffik-green/30 bg-white shadow-lg ring-1 ring-traffik-green/20"
                  : "border-gray-200 bg-white/80"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 inline-block rounded-full bg-traffik-green/10 px-3 py-1 text-xs font-semibold text-traffik-green">
                  Recommended
                </span>
              )}
              <h3 className="text-xl font-bold text-[#030803]">{plan.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#030803]">
                  {plan.price}
                </span>
                <span className="text-sm text-[#484848]">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-[#484848]">{plan.description}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 flex-shrink-0 text-traffik-green" />
                    <span className="text-[#484848]">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlighted ? "signIn" : "outline"}
                className="mt-8 w-full"
                size="lg"
                asChild
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
