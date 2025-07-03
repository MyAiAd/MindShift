/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['kdxwfaynzemmdonkmttf.supabase.co'],
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
}

module.exports = nextConfig 