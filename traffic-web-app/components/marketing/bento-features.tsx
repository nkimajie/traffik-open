import Image from "next/image";
import { Zap, Globe, BarChart3, Shield } from "lucide-react";
import chevronMark from "@/public/image/login-vector.png";

const features = [
  {
    icon: Zap,
    title: "Fast onboarding",
    description: "Vendors go live in minutes with a guided setup flow.",
    span: "lg:col-span-4",
  },
  {
    icon: Globe,
    title: "Local discovery",
    description: "Shoppers find stores and products near them.",
    span: "lg:col-span-4",
  },
  {
    icon: BarChart3,
    title: "Sales insights",
    description: "Track revenue, orders, and product performance.",
    span: "lg:col-span-4",
  },
  {
    icon: Shield,
    title: "Secure payments",
    description: "Checkout and vendor payouts you can trust.",
    span: "lg:col-span-6",
    large: true,
  },
];

export default function BentoFeatures() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-traffik-pink">
            Platform features
          </p>
          <h2 className="mt-2 text-3xl font-bold text-[#030803] sm:text-4xl">
            Everything you need to move forward
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative overflow-hidden rounded-2xl bg-black p-8 sm:col-span-2 lg:col-span-6 lg:row-span-2">
            <Image
              src={chevronMark}
              alt=""
              width={64}
              height={48}
              className="mb-6 opacity-80"
              aria-hidden
            />
            <h3 className="text-2xl font-bold text-white">
              One marketplace.
              <br />
              <span className="bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green bg-clip-text text-transparent">
                Infinite possibilities.
              </span>
            </h3>
            <p className="mt-4 max-w-sm text-gray-400">
              From first browse to first sale, Traffik keeps both sides of the
              marketplace connected and moving.
            </p>
            <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-traffik-pink/20 blur-3xl" />
          </div>

          {features.map((feature) => (
            <div
              key={feature.title}
              className={`rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md ${feature.span} ${feature.large ? "lg:col-span-6" : ""}`}
            >
              <feature.icon className="mb-4 h-6 w-6 text-traffik-amber" />
              <h3 className="font-semibold text-[#030803]">{feature.title}</h3>
              <p className="mt-2 text-sm text-[#484848]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
