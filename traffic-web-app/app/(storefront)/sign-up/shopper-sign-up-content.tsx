"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import registerApi from "@/lib/services/api/auth/register.api";
import type { RegisterPayload } from "@/lib/services/api/auth/register.api";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import { useAuth } from "@/lib/context/providers/auth-provider";

const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    countryCode: z.string().min(1, "Country code is required"),
    phone: z.string().min(1, "Phone number is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function ShopperSignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? undefined;
  const { login: authLogin } = useAuth();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { countryCode: "+234" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setIsPending(true);
    try {
      const payload: RegisterPayload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: {
          countryCode: values.countryCode,
          number: values.phone,
        },
        password: values.password,
        role: "user",
      };

      const response = await registerApi(payload);
      handleSuccessToast({ description: "Account created!" });

      if (response.data.token) {
        const userData = {
          _id: response.data._id,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          email: response.data.email,
          role: response.data.role,
          isVerified: response.data.isVerified,
        };
        authLogin(response.data.token, userData, returnTo);
      } else {
        setTimeout(() => router.push("/auth/verify-email"), 1500);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to register. Please try again.";
      handleErrorToast({ description: message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#030803]">Create your account</h1>
          <p className="mt-2 text-sm text-[#484848]">
            Shop from Nigeria&apos;s major markets with escrow protection.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Input
                label="First name"
                type="text"
                className={`border-gray-200 py-5 text-black ${errors.firstName ? "border-red-500" : ""}`}
                placeholder="First name"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Input
                label="Last name"
                type="text"
                className={`border-gray-200 py-5 text-black ${errors.lastName ? "border-red-500" : ""}`}
                placeholder="Last name"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

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

          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div>
              <Input
                label="Code"
                type="text"
                className={`border-gray-200 py-5 text-black ${errors.countryCode ? "border-red-500" : ""}`}
                placeholder="+234"
                {...register("countryCode")}
              />
            </div>
            <div>
              <Input
                label="Phone"
                type="tel"
                className={`border-gray-200 py-5 text-black ${errors.phone ? "border-red-500" : ""}`}
                placeholder="Phone number"
                {...register("phone")}
              />
            </div>
          </div>

          <div>
            <Input
              label="Password"
              type="password"
              className={`border-gray-200 py-5 text-black ${errors.password ? "border-red-500" : ""}`}
              placeholder="Min 8 characters"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div>
            <Input
              label="Confirm password"
              type="password"
              className={`border-gray-200 py-5 text-black ${errors.confirmPassword ? "border-red-500" : ""}`}
              placeholder="Confirm password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            className="mt-2 w-full rounded-xl font-semibold text-white"
            variant="signIn"
            size="lg"
            disabled={isPending}
          >
            {isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[#484848]">
          Already have an account?{" "}
          <Link
            href={
              returnTo
                ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}`
                : "/sign-in"
            }
            className="font-semibold text-traffik-pink hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[#484848]">
          Selling on Traffik?{" "}
          <Link href="/vendors/sign-up" className="font-medium hover:underline">
            Create vendor account
          </Link>
        </p>
      </div>
    </div>
  );
}
