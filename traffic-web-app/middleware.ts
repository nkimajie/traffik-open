import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function getVendorRedirect(
  isVerified: boolean,
  signupComplete: boolean,
  approved: boolean,
): string {
  if (!isVerified) return "/create-business/step0";
  if (!signupComplete) return "/create-business/step1";
  if (!approved) return "/create-business/step2";
  return "/dashboard";
}

function getRoleRedirect(
  role: string | undefined,
  isVerified: boolean,
  onboardingComplete: boolean,
  signupComplete: boolean,
  approved: boolean,
): string {
  if (role === "user" || role === "shopper") return "/account";
  if (role === "admin") return "/admin";
  if (onboardingComplete) return "/dashboard";
  return getVendorRedirect(isVerified, signupComplete, approved);
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const role = request.cookies.get("role")?.value;
  const isVerified = request.cookies.get("isVerified")?.value === "1";
  const onboardingComplete =
    request.cookies.get("onboardingComplete")?.value === "1";
  const signupComplete =
    request.cookies.get("vendorSignupComplete")?.value === "1";
  const approved = request.cookies.get("vendorApproved")?.value === "1";
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/sign-in") {
    const url = new URL("/admin/login", request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    return NextResponse.redirect(url);
  }

  const isAdminLogin = pathname === "/admin/login";
  const isAdminConsole = pathname.startsWith("/admin") && !isAdminLogin;
  const isDashboard = pathname.startsWith("/dashboard");
  const isCreateBusiness = pathname.startsWith("/create-business");
  const isAccount = pathname.startsWith("/account");
  const isProtectedRoute =
    isDashboard || isAdminConsole || isCreateBusiness || isAccount;

  if (isProtectedRoute && !token) {
    const signInPath = isAccount
      ? "/sign-in"
      : isAdminConsole
        ? "/admin/login"
        : "/vendors/sign-in";
    const url = new URL(signInPath, request.url);
    url.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(url);
  }

  if (
    token &&
    role === "vendor" &&
    onboardingComplete &&
    isCreateBusiness
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    token &&
    role === "vendor" &&
    !isVerified &&
    (isDashboard ||
      (isCreateBusiness && !pathname.startsWith("/create-business/step0")))
  ) {
    return NextResponse.redirect(
      new URL("/create-business/step0", request.url),
    );
  }

  if (isAccount && token && role && role !== "user" && role !== "shopper") {
    return NextResponse.redirect(
      new URL(
        getRoleRedirect(
          role,
          isVerified,
          onboardingComplete,
          signupComplete,
          approved,
        ),
        request.url,
      ),
    );
  }

  if (isAdminConsole && token && role && role !== "admin") {
    return NextResponse.redirect(
      new URL(
        getRoleRedirect(
          role,
          isVerified,
          onboardingComplete,
          signupComplete,
          approved,
        ),
        request.url,
      ),
    );
  }

  if (isDashboard && token && role && role !== "vendor") {
    return NextResponse.redirect(
      new URL(
        getRoleRedirect(
          role,
          isVerified,
          onboardingComplete,
          signupComplete,
          approved,
        ),
        request.url,
      ),
    );
  }

  if (isCreateBusiness && token && role === "user") {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (isCreateBusiness && token && role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const isLegacyAuth = pathname.startsWith("/auth");
  const isShopperAuth =
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password";
  const isVendorAuth =
    pathname.startsWith("/vendors/sign-in") ||
    pathname.startsWith("/vendors/sign-up");

  if (token && (isLegacyAuth || isShopperAuth || isVendorAuth || isAdminLogin)) {
    if (isVendorAuth) {
      return NextResponse.redirect(
        new URL(
          getRoleRedirect(
            role,
            isVerified,
            onboardingComplete,
            signupComplete,
            approved,
          ),
          request.url,
        ),
      );
    }
    if (isAdminLogin && role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (isShopperAuth && (role === "user" || role === "shopper")) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
    if (isLegacyAuth) {
      return NextResponse.redirect(
        new URL(
          getRoleRedirect(
            role,
            isVerified,
            onboardingComplete,
            signupComplete,
            approved,
          ),
          request.url,
        ),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin",
    "/admin/login",
    "/admin/sign-in",
    "/admin/:path*",
    "/create-business/:path*",
    "/account/:path*",
    "/auth/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/vendors/sign-in",
    "/vendors/sign-up",
  ],
};
