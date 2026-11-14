"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { Mail } from "lucide-react";
import verifyEmailImg from "@/public/image/object-verify-email.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { requestOtp, verifyOtp } from "@/lib/services/api/auth/otp.api";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import { cn } from "@/lib/utils";

const RESEND_DELAY_SECONDS = 60;

const schema = z.object({
  token: z
    .string()
    .min(4, "Enter the 4-digit code")
    .max(4, "Enter the 4-digit code")
    .regex(/^\d{4}$/, "Code must be 4 digits"),
});

type FormValues = z.infer<typeof schema>;

function otpRequestStorageKey(userId: string) {
  return `vendor-otp-requested-at:${userId}`;
}

function readRequestedAt(userId?: string): number | null {
  if (!userId || typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(otpRequestStorageKey(userId));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function writeRequestedAt(userId: string) {
  sessionStorage.setItem(otpRequestStorageKey(userId), String(Date.now()));
}

function getRemainingCooldown(requestedAt: number | null): number {
  if (!requestedAt) return 0;
  const elapsed = Math.floor((Date.now() - requestedAt) / 1000);
  return Math.max(0, RESEND_DELAY_SECONDS - elapsed);
}

export default function VerifyEmailForm() {
  const router = useRouter();
  const { user, markEmailVerified } = useAuth();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();

  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const hasRequestedOtp = requestedAt !== null;

  const syncFromStorage = useCallback(() => {
    const stored = readRequestedAt(user?._id);
    setRequestedAt(stored);
    setResendCooldown(getRemainingCooldown(stored));
  }, [user?._id]);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const verifyMutation = useMutation({
    mutationFn: (values: FormValues) => verifyOtp(values.token),
    onSuccess: () => {
      if (user?._id) {
        sessionStorage.removeItem(otpRequestStorageKey(user._id));
      }
      markEmailVerified();
      handleSuccessToast({ description: "Email verified successfully." });
      router.push("/create-business/step1");
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  const requestMutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: () => {
      if (!user?._id) return;
      const now = Date.now();
      writeRequestedAt(user._id);
      setRequestedAt(now);
      setResendCooldown(RESEND_DELAY_SECONDS);
      handleSuccessToast({
        description: `Verification code sent to ${user.email}.`,
      });
    },
    onError: (err: Error) => {
      handleErrorToast({ description: err.message });
    },
  });

  const handleRequestOtp = () => {
    requestMutation.mutate();
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-8">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-gray-100 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-traffik-pink/10 text-traffik-pink">
            <Mail className="h-5 w-5" aria-hidden />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#030803] sm:text-[1.75rem]">
              Email verification
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#484848]">
              {hasRequestedOtp ? (
                <>
                  Enter the 4-digit code sent to{" "}
                  <span className="font-medium text-[#030803]">{user?.email}</span>
                </>
              ) : (
                <>
                  We&apos;ll send a verification code to{" "}
                  <span className="font-medium text-[#030803]">{user?.email}</span>{" "}
                  when you&apos;re ready.
                </>
              )}
            </p>
          </div>

          <Image
            src={verifyEmailImg}
            height={180}
            width={220}
            alt=""
            className="mx-auto my-8"
          />

          {!hasRequestedOtp ? (
            <div className="space-y-4 text-center">
              <Button
                type="button"
                className="w-full"
                disabled={requestMutation.isPending}
                onClick={handleRequestOtp}
              >
                {requestMutation.isPending ? "Sending code…" : "Request OTP"}
              </Button>
              <p className="text-xs text-[#484848]">
                Codes are not sent automatically. Tap above when you want one.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit((values) => verifyMutation.mutate(values))}
              className="space-y-4"
            >
              <div>
                <Input
                  label="Verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="0000"
                  className="h-12 text-center text-xl tracking-[0.5em]"
                  {...register("token")}
                />
                {errors.token ? (
                  <p className="mt-1 text-sm text-red-500">{errors.token.message}</p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? "Verifying…" : "Verify email"}
              </Button>

              <div className="pt-2 text-center text-sm text-[#484848]">
                <p>Didn&apos;t get the code? Check your spam folder.</p>
                {resendCooldown > 0 ? (
                  <p className="mt-2 font-medium text-traffik-pink">
                    Resend OTP in {resendCooldown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "mt-2 font-medium text-traffik-pink hover:underline",
                      requestMutation.isPending && "opacity-50",
                    )}
                    disabled={requestMutation.isPending}
                    onClick={handleRequestOtp}
                  >
                    {requestMutation.isPending ? "Sending…" : "Resend OTP"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
