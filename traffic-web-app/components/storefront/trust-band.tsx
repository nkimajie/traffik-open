import { Headphones, ShieldCheck, Store, Truck } from "lucide-react";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Protected payment",
    description:
      "Your money is held in escrow and only released once your order is confirmed.",
    accent: "text-traffik-pink",
    bg: "bg-traffik-pink/10",
  },
  {
    icon: Store,
    title: "Verified stores",
    description:
      "Every store completes KYC before they can sell. No anonymous sellers.",
    accent: "text-traffik-green",
    bg: "bg-traffik-green/10",
  },
  {
    icon: Truck,
    title: "Track every order",
    description:
      "See progress per store — not one opaque status for a mixed basket.",
    accent: "text-traffik-amber",
    bg: "bg-traffik-amber/15",
  },
  {
    icon: Headphones,
    title: "Real support",
    description:
      "Disputes are handled by people, not bots. We step in when things go wrong.",
    accent: "text-traffik-pink",
    bg: "bg-traffik-pink/10",
  },
];

export default function TrustBand() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-traffik-pink/10 bg-gradient-to-r from-traffik-pink/5 via-traffik-amber/5 to-traffik-green/5 py-12 sm:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2
            id="trust-heading"
            className="text-2xl font-bold text-[#030803] sm:text-3xl"
          >
            Shop with confidence
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[#484848] sm:text-base">
            Every Traffik order is escrow-backed. That is not a marketing line —
            it is how the platform works.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/80 bg-white/70 p-5 backdrop-blur-sm"
            >
              <div
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}
              >
                <item.icon className={`h-5 w-5 ${item.accent}`} aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-bold text-[#030803]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#484848]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
