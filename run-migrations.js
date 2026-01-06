#!/usr/bin/env node

const fs = require('fs');

const SUPABASE_URL = 'https://kdxwfaynzemmdonkmttf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeHdmYXluemVtbWRvbmttdHRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTUyMDU1NywiZXhwIjoyMDY3MDk2NTU3fQ.CD90eDXVbm_6tA4lA4XZU5Vm60V9uR5y1qLv66gX-Po';
const DB_PASSWORD = 'T3sla12e!';

// Migrations in order
const migrations = [
  { file: 'supabase/migrations/030_community_media_support.sql', name: '030: Media Support' },
  { file: 'supabase/migrations/031_community_member_features.sql', name: '031: Member Features' },
  { file: 'supabase/migrations/032_fix_community_comments.sql', name: '032: Comment Fixes' },
  { file: 'supabase/migrations/033_fix_notification_preferences_rls.sql', name: '033: Notification Preferences Fix' },
  { file: 'supabase/migrations/034_fix_notification_preferences_duplicate.sql', name: '034: Duplicate Key Fix' },
];

async function runMigration(sql, migrationName) {
  console.log(`📝 Running: ${migrationName}`);
  
  try {
    // Use pg node library to connect
    const { Client } = require('pg');
    
    const client = new Client({
      host: 'aws-0-us-east-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      options: '-c search_path=public,extensions'
    });
    
    await client.connect();
    
    // Execute the SQL
    await client.query(sql);
    
    await client.end();
    
    console.log(`✅ Success: ${migrationName}\n`);
    return true;
  } catch (error) {
    console.log(`⚠️  Note: ${error.message}`);
    console.log(`   (This may be expected if the migration was already applied)\n`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase migrations...\n');
  console.log('================================================');
  
  // Check if pg is installed
  try {
    require.resolve('pg');
  } catch (e) {
    console.error('❌ Error: pg module not found.');
    console.error('   Please install it: npm install pg');
    process.exit(1);
  }
  
  for (let i = 0; i < migrations.length; i++) {
    const { file, name } = migrations[i];
    
    console.log(`\nMigration ${i + 1}/${migrations.length}: ${name}`);
    console.log('================================================');
    
    if (!fs.existsSync(file)) {
      console.error(`❌ Error: File not found: ${file}`);
      continue;
    }
    
    const sql = fs.readFileSync(file, 'utf8');
    await runMigration(sql, name);
  }
  
  console.log('================================================');
  console.log('🎉 All migrations processed!');
  console.log('================================================');
}

main().catch(console.error);
