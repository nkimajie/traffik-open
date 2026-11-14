"use client";

import Link from "next/link";
import { Package, Users } from "lucide-react";
import { formatNaira } from "@/lib/utils/format-price";
import { formatOrderDate } from "@/lib/utils/order";
import VendorProductCard from "@/components/dashboard/vendor-product-card";
import { DashboardEmpty, DashboardPanel } from "@/components/dashboard/dashboard-panel";

type TopPerformer = {
  productId: string;
  name: string;
  image?: string;
  category?: string;
  subcategory?: string;
  soldCount: number;
  likeCount?: number;
};

type RecentCustomer = {
  userId: string;
  name: string;
  amount: number;
  lastTransaction?: string;
};

type DashboardHomeSectionsProps = {
  topPerformers: TopPerformer[];
  recentCustomers: RecentCustomer[];
  canCreateProducts: boolean;
};

export default function DashboardHomeSections({
  topPerformers,
  recentCustomers,
  canCreateProducts,
}: DashboardHomeSectionsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <DashboardPanel
        title="Top performers"
        viewAllHref="/dashboard/products"
        className="xl:col-span-7"
      >
        {topPerformers.length === 0 ? (
          <DashboardEmpty
            icon={Package}
            title="No sales yet"
            description="Your best-selling products will appear here once orders start coming in."
            actionHref={canCreateProducts ? "/dashboard/products/new" : undefined}
            actionLabel={canCreateProducts ? "List a product" : undefined}
          />
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto pb-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
            {topPerformers.slice(0, 3).map((item) => (
              <div key={item.productId} className="w-[160px] shrink-0 snap-start sm:w-auto">
                <VendorProductCard
                  product={{
                    id: item.productId,
                    name: item.name,
                    image: item.image,
                    categoryLabel: [item.category, item.subcategory]
                      .filter(Boolean)
                      .join(" / "),
                    price: 0,
                    soldCount: item.soldCount,
                    likeCount: item.likeCount,
                    href: `/dashboard/products/${item.productId}`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel
        title="Recent customers"
        viewAllHref="/dashboard/customers"
        className="xl:col-span-5"
      >
        {recentCustomers.length === 0 ? (
          <DashboardEmpty
            icon={Users}
            title="No customers yet"
            description="Shoppers who buy from your store will show up here."
          />
        ) : (
          <ul className="space-y-1">
            {recentCustomers.map((customer) => (
              <li key={customer.userId}>
                <Link
                  href="/dashboard/customers"
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-traffik-pink/15 to-traffik-green/15 text-sm font-bold text-[#030803]">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#030803]">
                        {customer.name}
                      </p>
                      {customer.lastTransaction ? (
                        <p className="text-xs text-[#484848]">
                          {formatOrderDate(customer.lastTransaction)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#030803]">
                    {formatNaira(customer.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
