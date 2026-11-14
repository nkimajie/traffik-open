import { MapPin, ShieldCheck, Store, Truck } from "lucide-react";

const stats = [
  { icon: MapPin, label: "8+ major markets", color: "text-traffik-pink" },
  { icon: Store, label: "500+ verified stores", color: "text-traffik-green" },
  { icon: ShieldCheck, label: "Escrow on every order", color: "text-traffik-amber" },
  { icon: Truck, label: "Nationwide delivery", color: "text-traffik-pink" },
];

export default function HeroStatsBar() {
  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-4 sm:divide-y-0 lg:px-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-center gap-2.5 px-4 py-4 sm:py-5"
          >
            <stat.icon className={`h-4 w-4 shrink-0 ${stat.color}`} aria-hidden />
            <span className="text-xs font-semibold text-[#030803] sm:text-sm">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
