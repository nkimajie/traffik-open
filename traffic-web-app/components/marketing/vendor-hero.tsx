import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import authVisual from "@/public/image/auth-bg.png";

const benefits = [
  "Guided onboarding in under 10 minutes",
  "Product catalog with images and inventory",
  "Order management and sales dashboard",
  "Secure file uploads for logos and products",
  "KYC verification for trusted stores",
];

export default function VendorHero() {
  return (
    <section className="overflow-hidden bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-traffik-green">
              For Vendors
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-[#030803] sm:text-5xl">
              Your store.
              <br />
              <span className="bg-gradient-to-r from-traffik-amber to-traffik-green bg-clip-text text-transparent">
                Your growth.
              </span>
            </h1>
            <p className="mt-6 text-lg text-[#484848]">
              Traffik gives store owners everything to list products, manage
              orders, and reach customers — without the complexity of building
              your own platform.
            </p>

            <ul className="mt-8 space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-traffik-green/15">
                    <Check className="h-3 w-3 text-traffik-green" />
                  </span>
                  <span className="text-[#484848]">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button variant="signIn" size="lg" asChild>
                <Link href="/auth/sign-up">Create vendor account</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-2xl shadow-gray-300/50">
              <Image
                src={authVisual}
                alt="Traffik vendor dashboard"
                width={640}
                height={480}
                className="w-full"
                priority
              />
            </div>
            <div className="absolute -bottom-4 -left-4 rounded-xl border border-gray-200 bg-white p-4 shadow-lg sm:-bottom-6 sm:-left-6">
              <p className="text-2xl font-bold text-traffik-green">Free</p>
              <p className="text-sm text-[#484848]">to get started</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
