import Image from "next/image";
import chevronMark from "@/public/image/login-vector.png";

export default function AboutHero() {
  return (
    <section className="relative overflow-hidden bg-black py-20 text-white sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-traffik-amber/15 blur-[100px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Image
          src={chevronMark}
          alt=""
          width={48}
          height={36}
          className="mx-auto mb-8"
          aria-hidden
        />
        <h1 className="text-4xl font-bold sm:text-5xl">
          Building the marketplace where{" "}
          <span className="bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green bg-clip-text text-transparent">
            local commerce moves forward
          </span>
        </h1>
        <p className="mt-6 text-lg text-gray-400">
          Traffik connects shoppers with verified local vendors — making it
          easier to discover, buy, and sell in one trusted platform.
        </p>
      </div>
    </section>
  );
}
