import { ShieldCheck, Truck, Star, Users } from "lucide-react";

const stats = [
  { icon: Users, label: "Verified vendors", value: "500+" },
  { icon: Star, label: "Average rating", value: "4.8★" },
  { icon: ShieldCheck, label: "Secure checkout", value: "100%" },
  { icon: Truck, label: "Order tracking", value: "Live" },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-gray-200 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                <stat.icon className="h-5 w-5 text-traffik-pink" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#030803]">{stat.value}</p>
                <p className="text-sm text-[#484848]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
