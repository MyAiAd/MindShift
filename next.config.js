/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
            domains: ['YOUR_PROJECT_ID.supabase.co'],
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
}

module.exports = nextConfig 