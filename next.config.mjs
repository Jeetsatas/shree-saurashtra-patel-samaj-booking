/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    outputFileTracingIncludes: {
      "/**/*": ["./prisma/**/*"],
    },
  },
};

export default nextConfig;
