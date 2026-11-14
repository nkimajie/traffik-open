"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  defaultValue?: string;
  placeholder?: string;
  size?: "default" | "large";
  className?: string;
};

export default function SearchForm({
  defaultValue = "",
  placeholder = "Search products, stores, or markets…",
  size = "default",
  className,
}: SearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center gap-2 rounded-2xl bg-white ring-1 ring-gray-200/80",
        size === "large" ? "p-1.5 shadow-md shadow-gray-200/50" : "p-1 shadow-sm",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
        <Search className="h-5 w-5 flex-shrink-0 text-traffik-pink" aria-hidden />
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#030803] placeholder:text-[#484848]/55 outline-none sm:text-base"
          aria-label="Search marketplace"
        />
      </div>
      <Button
        type="submit"
        variant="signIn"
        size={size === "large" ? "sm" : "sm"}
        className="shrink-0 rounded-xl px-5"
      >
        Search
      </Button>
    </form>
  );
}
