import { Target, Heart, Zap } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Our mission",
    description:
      "Empower local businesses to reach customers online while giving shoppers a trusted way to discover and buy from vendors in their community.",
  },
  {
    icon: Heart,
    title: "Our values",
    description:
      "Trust, transparency, and simplicity guide every decision — from vendor verification to checkout and order tracking.",
  },
  {
    icon: Zap,
    title: "Our vision",
    description:
      "A marketplace where every local store can compete on equal footing, and every shopper can find what they need without friction.",
  },
];

export default function AboutMission() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-2xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-traffik-pink/10 via-traffik-amber/10 to-traffik-green/10">
                <value.icon className="h-6 w-6 text-traffik-pink" />
              </div>
              <h2 className="text-xl font-bold text-[#030803]">{value.title}</h2>
              <p className="mt-3 text-[#484848] leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
