"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FormContainer from "@/components/layout/auth-layout";
import FormFooter from "@/components/auth-ui/form-footer";
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

export default function VendorSignUpPage() {
  const router = useRouter();
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
        role: "vendor",
      };

      const response = await registerApi(payload);
      handleSuccessToast({ description: "Registration successful!" });

      if (response.data.token) {
        const userData = {
          _id: response.data._id,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          email: response.data.email,
          role: response.data.role,
          isVerified: response.data.isVerified,
        };
        authLogin(response.data.token, userData);
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
    <FormContainer pageHeading="Create vendor account">
      <p className="mb-6 text-center text-sm text-[#484848]">
        Start selling from Nigeria&apos;s major markets on Traffik.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="md:p-9 md:pb-0 md:pt-0">
        <div className="mb-2">
          <Input
            label="First Name"
            type="text"
            className={`border-[#9F9F9F] py-6 text-black ${errors.firstName ? "border-red-500" : ""}`}
            placeholder="Enter your first name"
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-500">{errors.firstName.message}</p>
          )}
        </div>

        <div className="mb-2">
          <Input
            label="Last Name"
            type="text"
            className={`border-[#9F9F9F] py-6 text-black ${errors.lastName ? "border-red-500" : ""}`}
            placeholder="Enter your last name"
            {...register("lastName")}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-500">{errors.lastName.message}</p>
          )}
        </div>

        <div className="mb-2">
          <Input
            label="Email"
            type="email"
            className={`border-[#9F9F9F] py-6 text-black ${errors.email ? "border-red-500" : ""}`}
            placeholder="Enter your email"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="mb-2">
          <div className="flex gap-2">
            <div className="w-32">
              <Input
                label="Country Code"
                type="text"
                className={`border-[#9F9F9F] py-6 text-black ${errors.countryCode ? "border-red-500" : ""}`}
                placeholder="+234"
                {...register("countryCode")}
              />
            </div>
            <div className="flex-1">
              <Input
                label="Phone Number"
                type="tel"
                className={`border-[#9F9F9F] py-6 text-black ${errors.phone ? "border-red-500" : ""}`}
                placeholder="Enter your phone number"
                {...register("phone")}
              />
            </div>
          </div>
        </div>

        <div className="mb-2">
          <Input
            label="Password"
            type="password"
            className={`border-[#9F9F9F] py-6 text-black ${errors.password ? "border-red-500" : ""}`}
            placeholder="Create a password (min 8 characters)"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        <div className="mb-4">
          <Input
            label="Confirm Password"
            type="password"
            className={`border-[#9F9F9F] py-6 text-black ${errors.confirmPassword ? "border-red-500" : ""}`}
            placeholder="Confirm your password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-500">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          className="w-full font-semibold text-white"
          variant="signIn"
          size="lg"
          disabled={isPending}
        >
          {isPending ? "Creating account..." : "Create vendor account"}
        </Button>

        <FormFooter
          message1="Already have a vendor account?"
          message2="Sign in"
          authUrl="/vendors/sign-in"
        />

        <p className="mt-6 text-center text-xs text-[#484848]">
          Shopping instead?{" "}
          <Link href="/sign-up" className="font-medium text-traffik-pink hover:underline">
            Create shopper account
          </Link>
        </p>
      </form>
    </FormContainer>
  );
}
