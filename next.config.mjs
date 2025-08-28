/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] }
};
export default nextConfig;
