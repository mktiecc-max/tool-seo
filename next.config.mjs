/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'sharp'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
