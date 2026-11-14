import type { Metadata } from "next";
import VendorHero from "@/components/marketing/vendor-hero";
import VendorFeatures from "@/components/marketing/vendor-features";
import VendorPricing from "@/components/marketing/vendor-pricing";
import HowItWorks from "@/components/marketing/how-it-works";
import CtaBand from "@/components/marketing/cta-band";

export const metadata: Metadata = {
  title: "For Vendors — Traffik",
  description:
    "Set up your store, manage products, and grow sales on the Traffik vendor platform.",
};

export default function VendorsPage() {
  return (
    <>
      <VendorHero />
      <VendorFeatures />
      <VendorPricing />
      <HowItWorks audience="vendors" />
      <CtaBand />
    </>
  );
}
