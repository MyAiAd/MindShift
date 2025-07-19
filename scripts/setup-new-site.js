#!/usr/bin/env node

/**
 * ===============================================
 * REUSABLE MINDSHIFTING TEMPLATE - SETUP SCRIPT
 * ===============================================
 * 
 * This script helps you set up a new site using the MindShifting template
 * Usage: node scripts/setup-new-site.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function generateRandomString(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

function updatePackageJson(siteName, siteDescription) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.name = siteName.toLowerCase().replace(/\s+/g, '-');
  packageJson.description = siteDescription;
  packageJson.version = '1.0.0';
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json');
}

function createEnvironmentFile(config) {
  const envTemplate = fs.readFileSync(path.join(process.cwd(), 'config/environment.template.txt'), 'utf8');
  
  let envContent = envTemplate
    .replace('NEXT_PUBLIC_SITE_NAME="MyAi"', `NEXT_PUBLIC_SITE_NAME="${config.siteName}"`)
    .replace('NEXT_PUBLIC_SITE_URL="http://localhost:3000"', `NEXT_PUBLIC_SITE_URL="${config.siteUrl}"`)
    .replace('NEXT_PUBLIC_SITE_DESCRIPTION="A revolutionary AI-powered platform for mindset transformation"', `NEXT_PUBLIC_SITE_DESCRIPTION="${config.siteDescription}"`)
    .replace('NEXT_PUBLIC_BRAND_PRIMARY_COLOR="#4F46E5"', `NEXT_PUBLIC_BRAND_PRIMARY_COLOR="${config.primaryColor}"`)
    .replace('NEXT_PUBLIC_BRAND_SECONDARY_COLOR="#10B981"', `NEXT_PUBLIC_BRAND_SECONDARY_COLOR="${config.secondaryColor}"`)
    .replace('NEXTAUTH_SECRET="your_nextauth_secret"', `NEXTAUTH_SECRET="${generateRandomString(32)}"`)
    .replace('NEXTAUTH_URL="http://localhost:3000"', `NEXTAUTH_URL="${config.siteUrl}"`);
  
  // Set feature flags based on user selections
  const features = {
    'NEXT_PUBLIC_FEATURE_TREATMENT_SESSIONS': config.features.treatmentSessions,
    'NEXT_PUBLIC_FEATURE_COMMUNITY_POSTS': config.features.communityPosts,
    'NEXT_PUBLIC_FEATURE_GAMIFICATION': config.features.gamification,
    'NEXT_PUBLIC_FEATURE_NOTIFICATIONS': config.features.notifications,
    'NEXT_PUBLIC_FEATURE_TEAM_MANAGEMENT': config.features.teamManagement,
    'NEXT_PUBLIC_FEATURE_DATA_MANAGEMENT': config.features.dataManagement,
    'NEXT_PUBLIC_FEATURE_ANALYTICS': config.features.analytics
  };
  
  Object.entries(features).forEach(([key, value]) => {
    envContent = envContent.replace(`${key}="true"`, `${key}="${value}"`);
  });
  
  fs.writeFileSync(path.join(process.cwd(), '.env.local'), envContent);
  console.log('✅ Created .env.local file');
}

function updateSupabaseConfig(projectName) {
  const configPath = path.join(process.cwd(), 'supabase/config.toml');
  if (fs.existsSync(configPath)) {
    let configContent = fs.readFileSync(configPath, 'utf8');
    configContent = configContent.replace('project_id = "MyAi"', `project_id = "${projectName}"`);
    fs.writeFileSync(configPath, configContent);
    console.log('✅ Updated Supabase config');
  }
}

function updateReadme(config) {
  const readmePath = path.join(process.cwd(), 'README.md');
  let readmeContent = `# ${config.siteName}

${config.siteDescription}

## 🚀 Features

This application is built on the **Reusable MindShifting Template** and includes:

### Core Features
- 🏢 **Complete Multi-tenancy** - Full tenant isolation with RLS
- 👤 **Super Admin System** - Admin with full access to all areas
- 🔐 **Authentication System** - Sign up, sign in, logout with 2FA support
- 📊 **User Profiles** - Complete user management
- 🎯 **Dashboard** - Central hub for all activities
- ⚙️ **Settings Area** - User preferences and configuration

### Advanced Features
${config.features.treatmentSessions ? '- 🧠 **Treatment Sessions** - AI-powered mind shifting protocols' : ''}
${config.features.communityPosts ? '- 💬 **Community Posts** - User-generated content and discussions' : ''}
${config.features.gamification ? '- 🎮 **Gamification** - Achievement system and progress tracking' : ''}
${config.features.notifications ? '- 🔔 **Notifications** - Real-time push notifications' : ''}
${config.features.teamManagement ? '- 👥 **Team Management** - Client and team collaboration tools' : ''}
${config.features.dataManagement ? '- 📁 **Data Management** - Tenant selection and client uploads' : ''}
${config.features.analytics ? '- 📈 **Analytics** - Progress tracking and insights' : ''}

### Technical Features
- 🗄️ **Supabase Integration** - PostgreSQL with RLS
- 💳 **Stripe Integration** - Subscription management
- 🤖 **OpenAI Integration** - AI-powered features
- 🎨 **Tailwind CSS** - Modern, responsive design
- 🔄 **Feature Flags** - Enable/disable features per deployment

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Styling**: Tailwind CSS
- **Payment**: Stripe
- **AI**: OpenAI
- **Deployment**: Vercel

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account (optional)
- OpenAI account (optional)

### Installation

1. **Clone and install dependencies**
\`\`\`bash
git clone <your-repo-url>
cd ${config.siteName.toLowerCase().replace(/\s+/g, '-')}
npm install
\`\`\`

2. **Set up environment variables**
\`\`\`bash
# Copy the environment template
cp config/environment.template.txt .env.local

# Fill in your actual values in .env.local
\`\`\`

3. **Set up Supabase**
\`\`\`bash
# Initialize Supabase
supabase init

# Run migrations
supabase db reset

# Generate types
npm run db:generate
\`\`\`

4. **Start development server**
\`\`\`bash
npm run dev
\`\`\`

## 🔧 Configuration

### Environment Variables

See \`config/environment.template.txt\` for all available configuration options.

### Feature Flags

You can enable/disable features using environment variables:

\`\`\`bash
NEXT_PUBLIC_FEATURE_TREATMENT_SESSIONS="${config.features.treatmentSessions}"
NEXT_PUBLIC_FEATURE_COMMUNITY_POSTS="${config.features.communityPosts}"
NEXT_PUBLIC_FEATURE_GAMIFICATION="${config.features.gamification}"
NEXT_PUBLIC_FEATURE_NOTIFICATIONS="${config.features.notifications}"
NEXT_PUBLIC_FEATURE_TEAM_MANAGEMENT="${config.features.teamManagement}"
NEXT_PUBLIC_FEATURE_DATA_MANAGEMENT="${config.features.dataManagement}"
NEXT_PUBLIC_FEATURE_ANALYTICS="${config.features.analytics}"
\`\`\`

### Branding

Customize your site's appearance:

\`\`\`bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR="${config.primaryColor}"
NEXT_PUBLIC_BRAND_SECONDARY_COLOR="${config.secondaryColor}"
NEXT_PUBLIC_BRAND_LOGO_URL="/logo.png"
NEXT_PUBLIC_BRAND_FAVICON_URL="/favicon.svg"
\`\`\`

## 🚢 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The application can be deployed to any platform that supports Next.js.

## 📖 Documentation

- [Setup Guide](./docs/setup.md)
- [Feature Configuration](./docs/features.md)
- [Database Schema](./docs/database.md)
- [API Documentation](./docs/api.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please contact: support@${config.siteName.toLowerCase().replace(/\s+/g, '')}.com

---

*Built with the Reusable MindShifting Template - A complete multi-tenant application framework*
`;

  fs.writeFileSync(readmePath, readmeContent);
  console.log('✅ Updated README.md');
}

async function main() {
  console.log('🚀 Welcome to the MindShifting Template Setup');
  console.log('==========================================');
  console.log();
  
  try {
    // Collect basic information
    const siteName = await askQuestion('What is your site name? (e.g., "MyApp"): ');
    const siteDescription = await askQuestion('Site description: ');
    const siteUrl = await askQuestion('Site URL (e.g., "https://myapp.com"): ');
    const primaryColor = await askQuestion('Primary color (hex, e.g., "#4F46E5"): ') || '#4F46E5';
    const secondaryColor = await askQuestion('Secondary color (hex, e.g., "#10B981"): ') || '#10B981';
    
    console.log();
    console.log('🎛️ Feature Selection');
    console.log('Enable the features you want for your site:');
    
    const features = {
      treatmentSessions: (await askQuestion('Enable Treatment Sessions? (y/n): ')).toLowerCase() === 'y',
      communityPosts: (await askQuestion('Enable Community Posts? (y/n): ')).toLowerCase() === 'y',
      gamification: (await askQuestion('Enable Gamification? (y/n): ')).toLowerCase() === 'y',
      notifications: (await askQuestion('Enable Notifications? (y/n): ')).toLowerCase() === 'y',
      teamManagement: (await askQuestion('Enable Team Management? (y/n): ')).toLowerCase() === 'y',
      dataManagement: (await askQuestion('Enable Data Management? (y/n): ')).toLowerCase() === 'y',
      analytics: (await askQuestion('Enable Analytics? (y/n): ')).toLowerCase() === 'y'
    };
    
    const config = {
      siteName,
      siteDescription,
      siteUrl,
      primaryColor,
      secondaryColor,
      features
    };
    
    console.log();
    console.log('⚙️ Setting up your site...');
    
    // Update files
    updatePackageJson(siteName, siteDescription);
    createEnvironmentFile(config);
    updateSupabaseConfig(siteName.replace(/\s+/g, ''));
    updateReadme(config);
    
    console.log();
    console.log('✅ Setup complete!');
    console.log();
    console.log('📋 Next steps:');
    console.log('1. Edit .env.local with your actual API keys');
    console.log('2. Set up your Supabase project');
    console.log('3. Run: npm run dev');
    console.log('4. Visit: http://localhost:3000');
    console.log();
    console.log('🎉 Your new site is ready!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
} 