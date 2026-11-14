"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import login from "@/lib/services/api/auth/login.api";
import type { LoginPayload } from "@/lib/services/api/auth/login.api";
import { useAuth } from "@/lib/context/providers/auth-provider";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function ShopperSignInPage() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? undefined;
  const { login: authLogin } = useAuth();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsPending(true);
    try {
      const payload: LoginPayload = {
        email: values.email,
        password: values.password,
        deviceId: "12345",
        role: "user",
      };

      const response = await login(payload);

      if (response.data.token) {
        const { token, ...userData } = response.data;
        authLogin(token, userData, returnTo);
        handleSuccessToast({ description: "Welcome back!" });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to login. Please try again.";
      handleErrorToast({ description: message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#030803]">Welcome back</h1>
          <p className="mt-2 text-sm text-[#484848]">
            Sign in to track orders and shop with Kashia escrow protection.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div>
            <Input
              label="Email"
              type="email"
              className={`border-gray-200 py-5 text-black ${errors.email ? "border-red-500" : ""}`}
              placeholder="Enter your email"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Input
              label="Password"
              type="password"
              className={`border-gray-200 py-5 text-black ${errors.password ? "border-red-500" : ""}`}
              placeholder="Enter your password"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-traffik-pink hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            className="w-full rounded-xl font-semibold text-white"
            variant="signIn"
            size="lg"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#484848]">
          <ShieldCheck className="h-3.5 w-3.5 text-traffik-green" aria-hidden />
          Every order is escrow protected
        </p>

        <p className="mt-6 text-center text-sm text-[#484848]">
          New to Traffik?{" "}
          <Link
            href={
              returnTo
                ? `/sign-up?returnTo=${encodeURIComponent(returnTo)}`
                : "/sign-up"
            }
            className="font-semibold text-traffik-pink hover:underline"
          >
            Create an account
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[#484848]">
          Selling on Traffik?{" "}
          <Link href="/vendors/sign-in" className="font-medium hover:underline">
            Vendor sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}
