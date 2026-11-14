"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import logoVector from "@/public/image/login-vector.png";
import approvalImage from "@/public/image/approve-acct.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendorProfile } from "@/lib/hooks/use-vendor-profile";
import StoreVerificationNotice from "@/components/dashboard/store-verification-notice";
import { getStoreVerificationStatus } from "@/lib/constants/vendor-onboarding";

export default function ApproveAccount() {
  const router = useRouter();
  const { data: vendorProfile, isLoading } = useVendorProfile();

  const email = vendorProfile?.email ?? "your email address";
  const storeName = vendorProfile?.businessName;
  const status = getStoreVerificationStatus(vendorProfile);
  const isApproved = status === "approved";

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl min-w-0 py-4 sm:py-8">
        <Skeleton className="mb-8 h-10 w-64" />
        <Skeleton className="mx-auto mb-8 h-48 w-full max-w-md" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl min-w-0 py-4 sm:py-8">
      <div className="mb-8 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-black sm:text-3xl">
          {isApproved ? "Store verified" : "Verification pending"}
        </h2>
        <Image
          src={logoVector}
          width={50}
          height={30}
          alt=""
          className="h-8 w-10 shrink-0"
        />
      </div>

      <div className="mb-8 flex justify-center">
        <Image
          src={approvalImage}
          width={550}
          height={300}
          alt=""
          className="h-auto w-full max-w-md"
        />
      </div>

      <StoreVerificationNotice
        status={status}
        email={email}
        storeName={storeName}
        compact
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="signIn"
          size="lg"
          className="flex-1"
          onClick={() =>
            router.push(isApproved ? "/dashboard/products" : "/dashboard")
          }
        >
          <span className="text-lg text-black">
            {isApproved ? "Go to products" : "Go to dashboard"}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 rounded-xl"
          asChild
        >
          <Link href="/dashboard/settings">Review store settings</Link>
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-[#484848]">
        {isApproved
          ? "Your store is live on Traffik. List products whenever you're ready."
          : `We will email ${email} when your store is approved and ready to sell.`}
      </p>
    </div>
  );
}
