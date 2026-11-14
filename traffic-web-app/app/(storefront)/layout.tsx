import StorefrontHeader from "@/components/storefront/storefront-header";
import StorefrontFooter from "@/components/storefront/storefront-footer";
import { CartProvider } from "@/lib/context/providers/cart-provider";
import CartConflictHost from "@/components/storefront/cart-conflict-host";

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CartConflictHost />
      <div className="flex min-h-screen flex-col bg-white">
        <StorefrontHeader />
        <main className="flex-1">{children}</main>
        <StorefrontFooter />
      </div>
    </CartProvider>
  );
}
