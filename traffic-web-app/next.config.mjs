/**
 * Single source of truth for the backend origin, inlined via `env` below so the
 * browser bundle and server-rendered code can never resolve different values.
 * Required rather than defaulted: a silent fallback turns a missing variable into
 * confusing runtime 404s instead of a build failure.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

if (!API_BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Add it to .env for local development " +
      "(see .env.example) or to the environment variables of your deployment.",
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: API_BASE_URL,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${API_BASE_URL}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
