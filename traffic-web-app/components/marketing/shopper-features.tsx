import { Search, ShoppingBag, Package, Star, MapPin, Tag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Search,
    title: "Discover stores",
    description:
      "Browse trending vendors, explore categories, and find products from local businesses near you.",
  },
  {
    icon: Tag,
    title: "Apply vouchers",
    description:
      "Save on checkout with discount codes from your favorite stores.",
  },
  {
    icon: ShoppingBag,
    title: "Easy checkout",
    description:
      "Add items to your cart and complete orders with a smooth, secure checkout flow.",
  },
  {
    icon: Package,
    title: "Track orders",
    description:
      "Follow your purchases from confirmation to delivery in real time.",
  },
  {
    icon: Star,
    title: "Leave reviews",
    description:
      "Share feedback on products and help other shoppers make informed choices.",
  },
  {
    icon: MapPin,
    title: "Shop local",
    description:
      "Support businesses in your community and discover hidden gems nearby.",
  },
];

export default function ShopperFeatures() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#030803] sm:text-4xl">
            Everything you need to shop local
          </h2>
          <p className="mt-4 text-lg text-[#484848]">
            Find great products from verified vendors, checkout with confidence,
            and track every order until it arrives.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-gray-200 bg-white transition-all hover:border-traffik-pink/20 hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-traffik-pink/10 to-traffik-amber/10">
                  <feature.icon className="h-6 w-6 text-traffik-pink" />
                </div>
                <CardTitle className="text-[#030803]">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-[#484848]">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3">
          <Button variant="outline" size="lg" disabled className="relative">
            Get the App
            <span className="ml-2 rounded-full bg-traffik-amber/20 px-2 py-0.5 text-xs font-medium text-traffik-amber">
              Coming soon
            </span>
          </Button>
          <p className="text-sm text-[#484848]">
            Mobile app for iOS and Android is on the way.
          </p>
        </div>
      </div>
    </section>
  );
}
