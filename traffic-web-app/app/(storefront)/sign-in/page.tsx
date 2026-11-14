import { Suspense } from "react";
import ShopperSignInPage from "./shopper-sign-in-content";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <ShopperSignInPage />
    </Suspense>
  );
}
