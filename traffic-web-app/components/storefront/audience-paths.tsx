import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Store, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const paths = [
  {
    icon: ShoppingBag,
    tag: "Shoppers",
    title: "Browse markets from anywhere",
    description:
      "Shop Ankara, hair, fabrics, shoes, and beauty from Nigeria's biggest markets — with escrow protecting every order.",
    cta: { label: "Start browsing", href: "/stores" },
    image:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=80&auto=format&fit=crop",
    accent: "from-traffik-pink/80 to-traffik-pink/40",
    border: "border-traffik-pink/20",
  },
  {
    icon: Store,
    tag: "Vendors",
    title: "Put your stall online",
    description:
      "Reach buyers nationwide from your market stall. List products, get orders, and receive payment through escrow when delivered.",
    cta: { label: "Open your store", href: "/vendors/sign-up" },
    secondary: { label: "See benefits", href: "/vendors", icon: TrendingUp },
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80&auto=format&fit=crop",
    accent: "from-traffik-green/80 to-traffik-green/40",
    border: "border-traffik-green/20",
  },
];

export default function AudiencePaths() {
  return (
    <section
      aria-labelledby="audience-heading"
      className="bg-[#fafafa] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-traffik-pink">
            For everyone
          </p>
          <h2
            id="audience-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-[#030803] sm:text-3xl lg:text-4xl"
          >
            Whether you shop or sell
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {paths.map((path) => (
            <article
              key={path.tag}
              className={`group relative overflow-hidden rounded-3xl border bg-white ${path.border} shadow-sm transition-shadow hover:shadow-xl`}
            >
              <div className="grid sm:grid-cols-2">
                <div className="relative h-48 sm:h-auto sm:min-h-[260px]">
                  <Image
                    src={path.image}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 400px"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${path.accent} sm:bg-gradient-to-r`} />
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#030803] backdrop-blur-sm">
                    {path.tag}
                  </div>
                </div>

                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                    <path.icon className="h-5 w-5 text-[#030803]" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-[#030803]">{path.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#484848]">
                    {path.description}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button variant="signIn" size="sm" asChild className="rounded-xl">
                      <Link href={path.cta.href}>
                        {path.cta.label}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </Button>
                    {path.secondary && (
                      <Link
                        href={path.secondary.href}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[#484848] transition-colors hover:text-[#030803]"
                      >
                        {path.secondary.icon && (
                          <path.secondary.icon className="h-4 w-4" aria-hidden />
                        )}
                        {path.secondary.label}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
