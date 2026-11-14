import Link from "next/link";
import { ArrowLeft, Home, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-6xl font-bold text-traffik-pink/30">404</p>
      <h1 className="mt-4 text-2xl font-bold text-[#030803] sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-[#484848]">
        This page doesn&apos;t exist or may have moved. Try browsing our market stores
        or search for what you need.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="signIn" asChild className="rounded-xl">
          <Link href="/">
            <Home className="mr-2 h-4 w-4" aria-hidden />
            Go home
          </Link>
        </Button>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href="/stores">
            <Store className="mr-2 h-4 w-4" aria-hidden />
            Browse stores
          </Link>
        </Button>
        <Button variant="outline" asChild className="rounded-xl">
          <Link href="/search">
            <Search className="mr-2 h-4 w-4" aria-hidden />
            Search
          </Link>
        </Button>
      </div>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-traffik-pink hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to homepage
      </Link>
    </div>
  );
}
