import Link from "next/link";
import { Store, Package, BarChart3, Upload, Shield, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Store,
    title: "Store setup",
    description:
      "Complete guided onboarding — business details, branding, and go live in minutes.",
    span: "md:col-span-2",
  },
  {
    icon: Package,
    title: "Product catalog",
    description: "Create, edit, and organize products with images, pricing, and stock.",
    span: "md:col-span-1",
  },
  {
    icon: BarChart3,
    title: "Sales dashboard",
    description: "Monitor orders, revenue, and performance at a glance.",
    span: "md:col-span-1",
  },
  {
    icon: Upload,
    title: "Media uploads",
    description: "Upload logos, cover photos, and product images via Cloudinary.",
    span: "md:col-span-1",
  },
  {
    icon: Shield,
    title: "KYC verification",
    description: "Build trust with verified vendor status and secure onboarding.",
    span: "md:col-span-1",
  },
  {
    icon: Headphones,
    title: "Order management",
    description: "Receive, fulfill, and update order status from your dashboard.",
    span: "md:col-span-2",
  },
];

export default function VendorFeatures() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#030803] sm:text-4xl">
            Tools built for vendor success
          </h2>
          <p className="mt-4 text-lg text-[#484848]">
            From first product to first sale, Traffik gives you everything to
            run and grow your store.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-traffik-green/30 hover:shadow-md ${feature.span}`}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-traffik-green/10 transition-colors group-hover:bg-traffik-green/15">
                <feature.icon className="h-6 w-6 text-traffik-green" />
              </div>
              <h3 className="font-semibold text-[#030803]">{feature.title}</h3>
              <p className="mt-2 text-sm text-[#484848] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button variant="signIn" size="lg" asChild>
            <Link href="/auth/sign-up">Create vendor account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
