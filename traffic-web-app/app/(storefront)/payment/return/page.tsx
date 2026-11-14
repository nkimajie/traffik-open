import { Suspense } from "react";
import PaymentReturnContent from "./payment-return-content";

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturnContent />
    </Suspense>
  );
}
