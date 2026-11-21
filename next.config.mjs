/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: "/journey", destination: "/", permanent: false }];
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    return [
      { source: "/:path*", headers: security },
      ...["/models/journey/optimized/:path*","/models/showroom/optimized/:path*"].map(source=>({source,
        headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]})),
    ];
  },
};

export default nextConfig;
