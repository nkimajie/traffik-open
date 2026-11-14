import Link from "next/link";
import { Package, ShieldCheck, Store, Truck } from "lucide-react";

const steps = [
  {
    icon: Store,
    title: "Pick a market store",
    description:
      "Browse vendors from Balogun, Ariaria, Kurmi, Onitsha, and other major markets. Every product belongs to a specific stall.",
    accent: "bg-traffik-pink",
  },
  {
    icon: Truck,
    title: "One store or several",
    description:
      "Order from one store and it ships direct. Order from several and Traffik collects everything together for a small fee.",
    accent: "bg-traffik-amber",
  },
  {
    icon: ShieldCheck,
    title: "Pay with escrow",
    description:
      "Your payment is held securely. Money is released to the store only after handover or delivery is confirmed.",
    accent: "bg-traffik-green",
  },
];

export default function DeliveryExplainer() {
  return (
    <section aria-labelledby="delivery-heading" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2
            id="delivery-heading"
            className="text-2xl font-bold text-[#030803] sm:text-3xl"
          >
            How delivery works
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[#484848] sm:text-base">
            Simple when you shop one store. Transparent when you shop several.
          </p>
        </div>

        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <span className="absolute -top-3 left-6 rounded-full bg-[#030803] px-2.5 py-0.5 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div
                className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${step.accent} text-white`}
              >
                <step.icon className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-bold text-[#030803]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#484848]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-[#484848]">
          <Package className="h-4 w-4 text-traffik-pink" aria-hidden />
          <span>
            Multi-store orders?{" "}
            <Link href="/how-it-works" className="font-semibold text-traffik-pink hover:underline">
              Learn how consolidation works
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
}
