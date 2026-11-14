import StorefrontHero from "@/components/storefront/storefront-hero";
import HeroStatsBar from "@/components/storefront/hero-stats-bar";
import CategoryRail from "@/components/storefront/category-rail";
import StoreGrid from "@/components/storefront/store-grid";
import DealsRail from "@/components/storefront/deals-rail";
import WhyTraffik from "@/components/storefront/why-traffik";
import AudiencePaths from "@/components/storefront/audience-paths";
import CtaBand from "@/components/marketing/cta-band";

export default function StorefrontHomePage() {
  return (
    <>
      <StorefrontHero />
      <HeroStatsBar />
      <CategoryRail />
      <StoreGrid />
      <DealsRail />
      <WhyTraffik />
      <AudiencePaths />
      <CtaBand
        title="Ready to grow your store?"
        description="Join market vendors from Balogun to Ariaria selling on Traffik. Set up your store in minutes and reach buyers across Nigeria."
        primaryLabel="Start selling free"
        primaryHref="/vendors/sign-up"
        secondaryLabel="Learn more"
        secondaryHref="/vendors"
      />
    </>
  );
}
