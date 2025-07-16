# 🚀 Reusable MyAi Template

A complete, production-ready multi-tenant application framework with authentication, subscriptions, notifications, AI integration, and more.

## ✨ What This Template Provides

This is a **complete system** that you can use to build any multi-tenant SaaS application. It includes:

### 🏗️ **Architecture Features**
- **Complete Multi-tenancy** with Row Level Security (RLS)
- **Super Admin System** with full access to all areas
- **Separation of Concerns** with service layers
- **Feature Flags** to enable/disable functionality
- **Environment-based Configuration**
- **Secure by Default** with no hardcoded secrets

### 🔧 **Core Features**
- 🔐 **Authentication System** - Sign up, sign in, logout with 2FA support
- 👤 **User Profiles** - Complete user management with roles
- 🎯 **Dashboard** - Central hub for all activities
- ⚙️ **Settings Area** - User preferences and configuration
- 💳 **Subscription Management** - Stripe integration for payments
- 🔔 **Notifications** - Real-time push notifications
- 📁 **Data Management** - Tenant selection and client uploads
- 👥 **Team Management** - Client and team collaboration tools

### 🎯 **Advanced Features**
- 🧠 **Treatment Sessions** - AI-powered mind shifting protocols
- 💬 **Community Posts** - User-generated content and discussions
- 🎮 **Gamification** - Achievement system and progress tracking
- 📈 **Analytics** - Progress tracking and insights
- 🤖 **AI Integration** - OpenAI for intelligent features

### 🛠️ **Technical Stack**
- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Styling**: Tailwind CSS
- **Payment**: Stripe
- **AI**: OpenAI
- **Deployment**: Vercel

## 🚀 Quick Start

### 1. **Clone the Template**
```bash
git clone <your-repo-url>
cd your-new-project
npm install
```

### 2. **Run the Setup Script**
```bash
node scripts/setup-new-site.js
```

This interactive script will:
- Configure your site name and branding
- Set up environment variables
- Enable/disable features based on your needs
- Generate a custom README
- Update configuration files

### 3. **Set Up Your Services**

#### **Supabase Setup**
1. Create a new Supabase project
2. Copy your project URL and keys to `.env.local`
3. Run the migrations:
```bash
supabase db reset
npm run db:generate
```

#### **Stripe Setup** (Optional)
1. Create a Stripe account
2. Copy your keys to `.env.local`
3. Set up webhooks pointing to `/api/webhooks/stripe`

#### **OpenAI Setup** (Optional)
1. Create an OpenAI account
2. Copy your API key to `.env.local`

### 4. **Start Development**
```bash
npm run dev
```

Visit `http://localhost:3000` to see your new site!

## 📋 Configuration

### Environment Variables

The template uses a comprehensive configuration system. See `config/environment.template.txt` for all available options.

### Feature Flags

Enable/disable features using environment variables:

```bash
# Core Features (always available)
NEXT_PUBLIC_FEATURE_NOTIFICATIONS="true"
NEXT_PUBLIC_FEATURE_TEAM_MANAGEMENT="true"
NEXT_PUBLIC_FEATURE_DATA_MANAGEMENT="true"

# Advanced Features (optional)
NEXT_PUBLIC_FEATURE_TREATMENT_SESSIONS="true"
NEXT_PUBLIC_FEATURE_COMMUNITY_POSTS="true"
NEXT_PUBLIC_FEATURE_GAMIFICATION="true"
NEXT_PUBLIC_FEATURE_ANALYTICS="true"
```

### Branding

Customize your site's appearance:

```bash
NEXT_PUBLIC_SITE_NAME="Your App Name"
NEXT_PUBLIC_BRAND_PRIMARY_COLOR="#4F46E5"
NEXT_PUBLIC_BRAND_SECONDARY_COLOR="#10B981"
NEXT_PUBLIC_BRAND_LOGO_URL="/logo.png"
```

## 🏗️ Architecture

### Service Layer Architecture

The template uses a service layer pattern for separation of concerns:

```
services/
├── auth/          # Authentication logic
├── database/      # Database connections
├── notification/  # Push notifications
├── payment/       # Stripe integration
├── ai/           # OpenAI integration
└── tenant/       # Multi-tenant logic
```

### Configuration System

All configuration is centralized in `lib/config.ts`:

```typescript
import config, { isFeatureEnabled } from '@/lib/config';

// Check if a feature is enabled
if (isFeatureEnabled('treatmentSessions')) {
  // Feature-specific code
}

// Access configuration
const stripeKey = config.stripe.publishableKey;
```

### Database Service

Use the database service instead of direct Supabase clients:

```typescript
import { createClient, createServerClient } from '@/services/database/supabase.service';

// Client-side
const supabase = createClient();

// Server-side
const supabase = createServerClient();
```

## 🗄️ Database Schema

The template includes a complete database schema with:

- **Multi-tenant architecture** with RLS policies
- **User management** with roles and permissions
- **Subscription system** with Stripe integration
- **Notification system** with preferences
- **Community features** with posts, comments, events
- **Gamification** with achievements and streaks
- **Treatment system** for AI-powered sessions

### Key Tables

- `tenants` - Multi-tenant isolation
- `profiles` - User profiles with roles
- `user_subscriptions` - Stripe subscription management
- `notification_preferences` - User notification settings
- `community_posts` - User-generated content
- `user_achievements` - Gamification system
- `treatment_sessions` - AI-powered sessions

## 🔐 Security

### Built-in Security Features

- **Row Level Security (RLS)** on all tables
- **Super Admin** bypass for management
- **Tenant isolation** at the database level
- **Environment-based secrets** (no hardcoded keys)
- **API rate limiting** and validation
- **Secure authentication** with 2FA support

### Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - API routes include validation
3. **Use RLS policies** - Database enforces tenant isolation
4. **Audit sensitive actions** - Built-in audit logging
5. **Regular security updates** - Keep dependencies updated

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Optional (based on enabled features)
STRIPE_SECRET_KEY
OPENAI_API_KEY
VAPID_PRIVATE_KEY
```

## 📖 Documentation

### Guides

- [Setup Guide](./docs/setup.md) - Detailed setup instructions
- [Feature Configuration](./docs/features.md) - How to configure features
- [Database Schema](./docs/database.md) - Complete database documentation
- [API Documentation](./docs/api.md) - API endpoints and usage

### Examples

- [Custom Feature](./docs/examples/custom-feature.md) - Adding a new feature
- [Custom Theme](./docs/examples/custom-theme.md) - Customizing the appearance
- [Custom Auth](./docs/examples/custom-auth.md) - Custom authentication flow

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Set up your environment variables
5. Run the development server: `npm run dev`

### Making Changes

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes
3. Test thoroughly
4. Submit a pull request

### Guidelines

- Follow the existing code style
- Add tests for new features
- Update documentation
- Ensure security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

1. Check the [documentation](./docs/)
2. Search existing [issues](https://github.com/your-repo/issues)
3. Create a new issue if needed
4. Join our [Discord community](https://discord.gg/myaicommunity)

### Professional Support

For professional support, custom development, or enterprise features:

- Email: support@myaicompany.com
- Website: https://myaicompany.com

## 🎉 What's Next?

### Extending the Template

1. **Add Custom Features** - Use the service layer pattern
2. **Customize Branding** - Update colors, logos, and styling
3. **Add Integrations** - Connect to external services
4. **Scale Up** - Deploy to production with confidence

### Community

- ⭐ **Star the repository** if you find it useful
- 🐛 **Report bugs** to help improve the template
- 💡 **Suggest features** for future versions
- 🤝 **Contribute** to make it even better

---

**Built with ❤️ by the MyAi Team**

*Transform your ideas into production-ready applications with the Reusable MyAi Template.* 