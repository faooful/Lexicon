/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: process.env.NODE_ENV === 'production' ? '/Lexicon' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/Lexicon/' : '',
}

module.exports = nextConfig 