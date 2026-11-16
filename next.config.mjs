/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return ["/models/journey/optimized/:path*","/models/showroom/optimized/:path*"].map(source=>({source,
      headers:[{key:"Cache-Control",value:"public, max-age=31536000, immutable"}]}));
  },
};

export default nextConfig;
