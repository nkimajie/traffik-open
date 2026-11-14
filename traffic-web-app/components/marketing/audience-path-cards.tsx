import Link from "next/link";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";

const paths = [
  {
    title: "For Shoppers",
    description:
      "Discover local stores, compare products, checkout with vouchers, and track every order until delivery.",
    href: "/shoppers",
    icon: ShoppingBag,
    accent: "group-hover:border-traffik-pink/40",
    iconBg: "bg-traffik-pink/10 text-traffik-pink",
    cta: "Explore shopping",
  },
  {
    title: "For Vendors",
    description:
      "Set up your store in minutes, manage your catalog, fulfill orders, and grow with built-in vendor tools.",
    href: "/vendors",
    icon: Store,
    accent: "group-hover:border-traffik-green/40",
    iconBg: "bg-traffik-green/10 text-traffik-green",
    cta: "Start selling",
  },
];

export default function AudiencePathCards() {
  return (
    <section className="bg-[#f2f2f2] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#030803] sm:text-4xl">
            Built for everyone in the marketplace
          </h2>
          <p className="mt-4 text-lg text-[#484848]">
            Whether you&apos;re buying or selling, Traffik has a dedicated
            experience designed for you.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {paths.map((path) => (
            <Link
              key={path.href}
              href={path.href}
              className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg ${path.accent}`}
            >
              <div
                className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${path.iconBg}`}
              >
                <path.icon className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold text-[#030803]">{path.title}</h3>
              <p className="mt-3 text-[#484848] leading-relaxed">
                {path.description}
              </p>
              <span className="mt-6 inline-flex items-center text-sm font-semibold text-traffik-pink group-hover:gap-2 transition-all">
                {path.cta}
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
