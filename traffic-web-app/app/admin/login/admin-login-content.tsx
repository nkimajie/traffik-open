"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import FormContainer from "@/components/layout/auth-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import adminLogin from "@/lib/services/api/auth/admin-login.api";
import { useAuth } from "@/lib/context/providers/auth-provider";
import useToastAlert from "@/lib/hooks/use-toast-alert";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginContent() {
  const { login: authLogin } = useAuth();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? undefined;
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
      const response = await adminLogin({
        email: values.email,
        password: values.password,
      });

      if (response.data.token) {
        const { token, ...userData } = response.data;
        authLogin(token, { ...userData, isVerified: true }, returnTo);
        handleSuccessToast({ description: "Admin login successful!" });
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
    <FormContainer pageHeading="Admin login">
      <p className="mb-6 text-center text-sm text-[#484848]">
        Sign in to manage stores, KYC approvals, and platform orders.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="md:p-9 md:pb-0 md:pt-0">
        <div className="mb-3">
          <Input
            label="Email"
            type="email"
            className={`border-[#9F9F9F] py-6 text-black ${errors.email ? "border-red-500" : ""}`}
            placeholder="Enter your admin email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="mb-2">
          <Input
            label="Password"
            type="password"
            className={`border-[#9F9F9F] py-6 text-black ${errors.password ? "border-red-500" : ""}`}
            placeholder="Enter your password"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <Button
          className="w-full font-semibold text-white"
          variant="signIn"
          size="lg"
          disabled={isPending}
        >
          {isPending ? "Signing in..." : "Sign in as admin"}
        </Button>

        <p className="mt-6 text-center text-xs text-[#484848]">
          Vendor instead?{" "}
          <Link
            href="/vendors/sign-in"
            className="font-medium text-traffik-pink hover:underline"
          >
            Vendor sign-in
          </Link>
        </p>
      </form>
    </FormContainer>
  );
}
