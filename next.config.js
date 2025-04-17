/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/Lexicon',
  assetPrefix: '/Lexicon/',
  trailingSlash: true,
}

module.exports = nextConfig 