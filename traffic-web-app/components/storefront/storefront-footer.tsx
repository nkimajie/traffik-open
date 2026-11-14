import Image from "next/image";
import Link from "next/link";
import { Instagram, Mail, MapPin, Twitter } from "lucide-react";
import logoLight from "@/public/image/traffik__logo.png";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { serverApiGet } from "@/lib/services/server/api-client";
import type { Category } from "@/lib/types/api";
import { slugify } from "@/lib/utils/slug";

const footerSections = [
  {
    title: "Shop",
    links: [
      { label: "Browse stores", href: "/stores" },
      { label: "Today's deals", href: "/deals" },
      { label: "Search", href: "/search" },
      { label: "How it works", href: "/how-it-works" },
    ],
  },
  {
    title: "Sell",
    links: [
      { label: "For vendors", href: "/vendors" },
      { label: "Start selling", href: "/vendors/sign-up" },
      { label: "Vendor pricing", href: "/vendors#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Traffik", href: "/about" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export default async function StorefrontFooter() {
  let categories: Category[] = [];
  try {
    categories = await serverApiGet<Category[]>(QueryKeys.CATEGORIES);
  } catch {
    categories = [];
  }

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="border-b border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 rounded-2xl bg-gray-800/50 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div>
              <p className="text-sm font-semibold text-white">
                Shop Nigeria&apos;s major markets from anywhere
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 text-traffik-pink" aria-hidden />
                Balogun · Ariaria · Kurmi · Onitsha · Gbagi · Wuse · Alaba
              </p>
            </div>
            <Link
              href="/stores"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-traffik-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-traffik-pink/90"
            >
              Browse market stores
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Image
              src={logoLight}
              alt="Traffik"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              Shop smart. Sell easy. Traffik connects you with verified market
              stores across Nigeria — every order protected by Kashia escrow.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 transition-colors hover:bg-gray-700 hover:text-white"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 transition-colors hover:bg-gray-700 hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="mailto:hello@traffik.ng"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 transition-colors hover:bg-gray-700 hover:text-white"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title} className="lg:col-span-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Categories
            </h3>
            <ul className="mt-4 space-y-3">
              {categories.slice(0, 6).map((cat) => (
                <li key={cat._id}>
                  <Link
                    href={`/categories/${slugify(cat.name)}`}
                    className="text-sm transition-colors hover:text-white"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 sm:flex-row">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Traffik. All rights reserved.
          </p>
          <div className="flex h-1 w-24 overflow-hidden rounded-full">
            <div className="flex-1 bg-traffik-pink" />
            <div className="flex-1 bg-traffik-amber" />
            <div className="flex-1 bg-traffik-green" />
          </div>
        </div>
      </div>
    </footer>
  );
}
