import { Suspense } from "react";
import ShopperSignUpContent from "./shopper-sign-up-content";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <ShopperSignUpContent />
    </Suspense>
  );
}
