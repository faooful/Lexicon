/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/Lexicon' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Lexicon/' : '',
}

module.exports = nextConfig 