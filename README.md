# MyAi

A revolutionary AI-powered platform for mindset transformation and personal growth.

## Overview

MyAi is designed to help users transform their mindset, overcome limiting beliefs, and achieve personal growth through AI-powered insights and personalized coaching.

## Features

- 🧠 AI-powered mindset analysis
- 📊 Personal growth tracking  
- 🎯 Goal setting and achievement
- 💡 Personalized recommendations
- 🔐 Secure user authentication
- 📱 Modern, responsive design

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MyAi/MyAi.git
cd MyAi
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

See `vercel-environment-variables.txt` for a complete list of environment variables needed for deployment.

### Required Variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@myai.com or join our Slack channel.

## Roadmap

- [ ] AI-powered mindset assessments
- [ ] Personalized coaching recommendations
- [ ] Progress tracking and analytics
- [ ] Community features
- [ ] Mobile app
- [ ] Advanced AI models integration

---

Built with ❤️ by [MyAiAd](https://github.com/MyAiAd) 