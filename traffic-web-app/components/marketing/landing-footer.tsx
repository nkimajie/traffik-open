import Image from "next/image";
import Link from "next/link";
import logoLight from "@/public/image/traffik__logo.png";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Browse stores", href: "/#stores" },
      { label: "For Vendors", href: "/vendors" },
      { label: "Pricing", href: "/vendors#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Sign In", href: "/auth/sign-in" },
      { label: "Sign Up", href: "/auth/sign-up" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Image
              src={logoLight}
              alt="Traffik"
              width={160}
              height={32}
              className="h-8 w-auto"
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              Shop smart. Sell easy. Traffik is the marketplace connecting
              shoppers with verified local vendors.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title} className="lg:col-span-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
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

          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <span className="text-sm">Privacy</span>
              </li>
              <li>
                <span className="text-sm">Terms</span>
              </li>
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
