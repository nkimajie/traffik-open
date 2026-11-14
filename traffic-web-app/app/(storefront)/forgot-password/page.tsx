import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-traffik-pink/10">
          <Mail className="h-7 w-7 text-traffik-pink" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-[#030803]">Reset your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#484848]">
          Enter the email on your Traffik account and we&apos;ll send you a link to
          reset your password. This feature is coming soon.
        </p>
        <Button variant="signIn" size="lg" className="mt-8 w-full rounded-xl" disabled>
          Send reset link — coming soon
        </Button>
        <Button variant="outline" size="lg" asChild className="mt-3 w-full rounded-xl">
          <Link href="/sign-in">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}
