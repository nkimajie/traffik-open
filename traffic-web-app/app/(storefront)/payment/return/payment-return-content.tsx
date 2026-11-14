"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyOrderPaymentReturn } from "@/lib/services/api/shopper/shopper.api";
import type { PaymentReturnSummary } from "@/lib/types/api";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { shopperOrderKeys } from "@/lib/services/api/shopper/use-orders.api";

type PaymentCheckState =
  | "idle"
  | "checking"
  | "confirmed"
  | "pending"
  | "failed"
  | "error";

export default function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") ?? "";
  const { isAuthenticated, isShopper } = useAuth();
  const queryClient = useQueryClient();

  const [checkState, setCheckState] = useState<PaymentCheckState>("idle");
  const [summary, setSummary] = useState<PaymentReturnSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authRef = useRef({ isAuthenticated, isShopper });

  authRef.current = { isAuthenticated, isShopper };

  useEffect(() => {
    if (!orderId) {
      return;
    }

    setCheckState("checking");
    setSummary(null);
    setErrorMessage(null);

    let attempts = 0;
    const maxAttempts = 6;
    let cancelled = false;

    async function runVerification() {
      if (cancelled) return;

      setCheckState("checking");
      attempts += 1;

      try {
        const result = await verifyOrderPaymentReturn(orderId);
        if (cancelled) return;

        setSummary(result);

        if (
          result.paymentStatus === "confirmed" ||
          result.paymentStatus === "already_confirmed"
        ) {
          setCheckState("confirmed");
          const { isAuthenticated: authed, isShopper: shopper } = authRef.current;
          if (authed && shopper) {
            void queryClient.invalidateQueries({
              queryKey: shopperOrderKeys.detail(orderId),
            });
            void queryClient.invalidateQueries({
              queryKey: shopperOrderKeys.all,
            });
            void queryClient.invalidateQueries({ queryKey: [QueryKeys.CART] });
          }
          return;
        }

        if (result.paymentStatus === "failed") {
          setCheckState("failed");
          return;
        }

        if (attempts < maxAttempts) {
          window.setTimeout(runVerification, 2000);
          return;
        }

        setCheckState("pending");
      } catch (error) {
        if (cancelled) return;

        if (attempts < maxAttempts) {
          window.setTimeout(runVerification, 2000);
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Could not verify your payment right now.";
        setErrorMessage(message);
        setCheckState("error");
      }
    }

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [orderId, queryClient]);

  const orderPath = orderId ? `/account/orders/${orderId}` : "/account/orders";
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(orderPath)}`;
  const showLoggedInCta = isAuthenticated && isShopper;

  if (!orderId) {
    return (
      <PaymentReturnShell>
        <StatusIcon variant="error">
          <XCircle className="h-10 w-10 text-red-500" aria-hidden />
        </StatusIcon>
        <h1 className="text-2xl font-bold text-[#030803]">Invalid payment link</h1>
        <p className="mt-2 text-sm text-[#484848]">
          This page is missing an order reference. Return to the store and try
          checkout again.
        </p>
        <div className="mt-8">
          <Button asChild className="rounded-xl">
            <Link href="/">Continue shopping</Link>
          </Button>
        </div>
      </PaymentReturnShell>
    );
  }

  if (checkState === "idle" || checkState === "checking") {
    return (
      <PaymentReturnShell>
        <StatusIcon variant="neutral">
          <Loader2
            className="h-10 w-10 animate-spin text-traffik-pink"
            aria-hidden
          />
        </StatusIcon>
        <h1 className="text-2xl font-bold text-[#030803]">Confirming payment</h1>
        <p className="mt-2 text-sm text-[#484848]">
          We&apos;re verifying your payment with Kashia. This usually takes a few
          seconds.
        </p>
      </PaymentReturnShell>
    );
  }

  if (checkState === "confirmed") {
    return (
      <PaymentReturnShell>
        <StatusIcon variant="success">
          <CheckCircle2 className="h-10 w-10 text-traffik-green" aria-hidden />
        </StatusIcon>
        <h1 className="text-2xl font-bold text-[#030803]">Payment successful</h1>
        <p className="mt-2 text-sm text-[#484848]">
          Your payment is confirmed
          {summary?.orderRef ? ` for order ${summary.orderRef}` : ""}. The
          store has been notified and your order is escrow protected.
        </p>
        <ActionButtons
          showLoggedInCta={showLoggedInCta}
          orderPath={orderPath}
          signInHref={signInHref}
        />
      </PaymentReturnShell>
    );
  }

  if (checkState === "failed") {
    return (
      <PaymentReturnShell>
        <StatusIcon variant="error">
          <XCircle className="h-10 w-10 text-red-500" aria-hidden />
        </StatusIcon>
        <h1 className="text-2xl font-bold text-[#030803]">Payment not completed</h1>
        <p className="mt-2 text-sm text-[#484848]">
          Your payment was not completed or was cancelled. No charge was captured
          for this order.
        </p>
        <ActionButtons
          showLoggedInCta={showLoggedInCta}
          orderPath={orderPath}
          signInHref={signInHref}
          secondaryLabel="Continue shopping"
          secondaryHref="/"
        />
      </PaymentReturnShell>
    );
  }

  if (checkState === "pending") {
    return (
      <PaymentReturnShell>
        <StatusIcon variant="warning">
          <Clock className="h-10 w-10 text-traffik-amber" aria-hidden />
        </StatusIcon>
        <h1 className="text-2xl font-bold text-[#030803]">Payment processing</h1>
        <p className="mt-2 text-sm text-[#484848]">
          Kashia is still processing your payment. If you were charged, your order
          will update shortly — check back in a few minutes.
        </p>
        <ActionButtons
          showLoggedInCta={showLoggedInCta}
          orderPath={orderPath}
          signInHref={signInHref}
        />
      </PaymentReturnShell>
    );
  }

  return (
    <PaymentReturnShell>
      <StatusIcon variant="error">
        <XCircle className="h-10 w-10 text-red-500" aria-hidden />
      </StatusIcon>
      <h1 className="text-2xl font-bold text-[#030803]">Could not verify payment</h1>
      <p className="mt-2 text-sm text-[#484848]">
        {errorMessage ??
          "We couldn't confirm your payment status. If you completed checkout, your order may still update automatically."}
      </p>
      <ActionButtons
        showLoggedInCta={showLoggedInCta}
        orderPath={orderPath}
        signInHref={signInHref}
      />
    </PaymentReturnShell>
  );
}

function PaymentReturnShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
        {children}
        <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-[#484848]">
          <ShieldCheck className="h-3.5 w-3.5 text-traffik-green" aria-hidden />
          Every order is escrow protected
        </p>
      </div>
    </div>
  );
}

function StatusIcon({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "success" | "error" | "warning" | "neutral";
}) {
  const bg =
    variant === "success"
      ? "bg-traffik-green/10"
      : variant === "error"
        ? "bg-red-50"
        : variant === "warning"
          ? "bg-amber-50"
          : "bg-traffik-pink/5";

  return (
    <div
      className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${bg}`}
    >
      {children}
    </div>
  );
}

function ActionButtons({
  showLoggedInCta,
  orderPath,
  signInHref,
  secondaryLabel,
  secondaryHref,
}: {
  showLoggedInCta: boolean;
  orderPath: string;
  signInHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3">
      {showLoggedInCta ? (
        <Button
          asChild
          className="w-full rounded-xl bg-traffik-pink hover:bg-traffik-pink/90"
        >
          <Link href={orderPath}>Go to order</Link>
        </Button>
      ) : (
        <Button
          asChild
          className="w-full rounded-xl bg-traffik-pink hover:bg-traffik-pink/90"
        >
          <Link href={signInHref}>Log in to access account</Link>
        </Button>
      )}
      {secondaryHref ? (
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href={secondaryHref}>{secondaryLabel ?? "Continue shopping"}</Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/">Continue shopping</Link>
        </Button>
      )}
    </div>
  );
}
