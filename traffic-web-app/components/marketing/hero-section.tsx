import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import chevronMark from "@/public/image/login-vector.png";
import authVisual from "@/public/image/auth-bg.png";

const bentoCards = [
  {
    title: "Discover",
    description: "Browse trending stores and categories",
    accent: "from-traffik-pink/20 to-traffik-pink/5",
    border: "border-traffik-pink/20",
    icon: ShoppingBag,
  },
  {
    title: "Manage",
    description: "Products, orders, and inventory in one place",
    accent: "from-traffik-amber/20 to-traffik-amber/5",
    border: "border-traffik-amber/20",
    icon: Store,
  },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 top-0 h-[500px] w-[500px] rounded-full bg-traffik-pink/20 blur-[120px]" />
        <div className="absolute -left-24 bottom-0 h-[400px] w-[400px] rounded-full bg-traffik-green/15 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <Image
            src={chevronMark}
            alt=""
            width={48}
            height={36}
            className="mx-auto mb-8"
            aria-hidden
          />
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-traffik-amber">
            Marketplace for local commerce
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Shop smart.{" "}
            <span className="bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green bg-clip-text text-transparent">
              Sell easy.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400 sm:text-xl">
            Traffik connects shoppers with verified local vendors — discover
            products, checkout securely, and grow your store from one platform.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button variant="signIn" size="lg" asChild className="w-full sm:w-auto">
              <Link href="/shoppers">
                Explore marketplace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
            >
              <Link href="/vendors">Become a vendor</Link>
            </Button>
          </div>
        </div>

        {/* Bento preview — inspired by interactive marketplace landings */}
        <div className="mt-16 grid gap-4 lg:grid-cols-12 lg:gap-5">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm lg:col-span-7 lg:row-span-2">
            <div className="overflow-hidden rounded-xl bg-black/40">
              <Image
                src={authVisual}
                alt="Traffik marketplace preview"
                width={800}
                height={500}
                className="w-full object-cover opacity-90"
                priority
              />
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/10 bg-black/60 p-4 backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-traffik-green">
                Live preview
              </p>
              <p className="mt-1 text-sm text-gray-300">
                Vendor dashboard, product management, and order tracking — all in
                one place.
              </p>
            </div>
          </div>

          {bentoCards.map((card) => (
            <div
              key={card.title}
              className={`rounded-2xl border bg-gradient-to-br p-6 lg:col-span-5 ${card.accent} ${card.border}`}
            >
              <card.icon className="mb-4 h-8 w-8 text-white" />
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{card.description}</p>
            </div>
          ))}

          <div className="rounded-2xl border border-traffik-green/20 bg-gradient-to-r from-traffik-pink/10 via-traffik-amber/10 to-traffik-green/10 p-6 lg:col-span-12">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Trusted by vendors building local businesses
                </p>
                <p className="mt-1 text-2xl font-bold">
                  One platform. Two audiences. Zero friction.
                </p>
              </div>
              <Button variant="signIn" asChild>
                <Link href="/auth/sign-up">Get started free</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
