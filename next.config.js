/** @type {import('next').NextConfig} */
// Force rebuild - Oct 11 2025
const nextConfig = {
  images: {
            domains: ['YOUR_PROJECT_ID.supabase.co'],
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
}

module.exports = nextConfig 