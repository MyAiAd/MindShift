#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

const PROJECT_REF = 'kdxwfaynzemmdonkmttf';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeHdmYXluemVtbWRvbmttdHRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTUyMDU1NywiZXhwIjoyMDY3MDk2NTU3fQ.CD90eDXVbm_6tA4lA4XZU5Vm60V9uR5y1qLv66gX-Po';

// Migrations in order
const migrations = [
  { file: 'supabase/migrations/030_community_media_support.sql', name: '030: Media Support' },
  { file: 'supabase/migrations/031_community_member_features.sql', name: '031: Member Features' },
  { file: 'supabase/migrations/032_fix_community_comments.sql', name: '032: Comment Fixes' },
  { file: 'supabase/migrations/033_fix_notification_preferences_rls.sql', name: '033: Notification Preferences Fix' },
];

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data, headers: res.headers });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function executeSQLViaAPI(sql) {
  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');
  
  const results = [];
  
  for (const statement of statements) {
    const fullStatement = statement.trim().endsWith(';') ? statement : statement + ';';
    
    // Try to execute via a serverless function or edge function
    // Since we don't have direct access, let's create a temp table approach
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: `/rest/v1/`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      }
    };
    
    try {
      // We can't execute arbitrary SQL via REST API
      // So let's output the SQL for manual execution
      results.push({ statement: fullStatement, status: 'pending' });
    } catch (error) {
      results.push({ statement: fullStatement, status: 'error', error: error.message });
    }
  }
  
  return results;
}

async function main() {
  console.log('🚀 Generating migration SQL...\n');
  console.log('================================================');
  console.log('NOTE: Due to network limitations (IPv6 only DNS),');
  console.log('      we cannot execute migrations automatically.');
  console.log('');
  console.log('Please copy and execute these SQL statements in');
  console.log('the Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql');
  console.log('================================================\n');
  
  for (let i = 0; i < migrations.length; i++) {
    const { file, name } = migrations[i];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Migration ${i + 1}/${migrations.length}: ${name}`);
    console.log(`File: ${file}`);
    console.log('='.repeat(60));
    
    if (!fs.existsSync(file)) {
      console.error(`❌ Error: File not found: ${file}\n`);
      continue;
    }
    
    const sql = fs.readFileSync(file, 'utf8');
    console.log('\n-- BEGIN MIGRATION SQL --\n');
    console.log(sql);
    console.log('\n-- END MIGRATION SQL --\n');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 INSTRUCTIONS:');
  console.log('='.repeat(60));
  console.log('1. Go to: https://supabase.com/dashboard/project/kdxwfaynzemmdonkmttf/sql');
  console.log('2. Copy each migration SQL above (between BEGIN and END)');
  console.log('3. Paste into the SQL Editor');
  console.log('4. Click "Run" for each migration in order');
  console.log('5. Migrations are idempotent - safe to run multiple times');
  console.log('='.repeat(60));
}

main().catch(console.error);

