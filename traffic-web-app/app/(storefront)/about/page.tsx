import type { Metadata } from "next";
import AboutHero from "@/components/marketing/about-hero";
import AboutMission from "@/components/marketing/about-mission";
import TrustStrip from "@/components/marketing/trust-strip";
import CtaBand from "@/components/marketing/cta-band";

export const metadata: Metadata = {
  title: "About — Traffik",
  description:
    "Traffik is building the marketplace where local commerce moves forward — for shoppers and vendors alike.",
};

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutMission />
      <TrustStrip />
      <CtaBand
        title="Join the Traffik marketplace"
        description="Whether you're shopping or selling, Traffik is built for you."
        primaryLabel="Start selling"
        primaryHref="/vendors/sign-up"
        secondaryLabel="Browse market stores"
        secondaryHref="/stores"
      />
    </>
  );
}
