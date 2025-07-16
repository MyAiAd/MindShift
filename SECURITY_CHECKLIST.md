# 🔒 SECURITY CHECKLIST - MANDATORY

## ⚠️ CRITICAL: Run This Before EVERY Git Operation

### 📋 PRE-COMMIT SECURITY CHECKLIST

**NEVER commit without completing ALL items below:**

- [ ] **Run security scan script**: `./pre-commit-security-scan.sh`
- [ ] **Verify scan passes**: Script exits with "✅ SUCCESS" 
- [ ] **Check git status**: `git status` - no unexpected files
- [ ] **Review all staged files**: `git diff --cached`
- [ ] **Confirm no .env files**: `find . -name "*.env*" -not -path "./node_modules/*"`
- [ ] **Check for .yoyo directory**: `ls -la | grep yoyo` (should be empty)
- [ ] **Verify templates only**: Only template/example files should contain placeholder keys

### 🚨 WHAT TO NEVER COMMIT

**Files:**
- `.env`, `.env.local`, `.env.production`
- `vercel-environment-variables.txt`
- Any file with real API keys, passwords, or secrets
- Backup files from `.yoyo` directory
- Service account keys (*.json)
- SSL certificates (*.pem, *.key)

**Patterns to avoid:**
- Real Supabase project IDs
- JWT tokens starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
- Live API keys (`sk_live_`, `pk_live_`)
- Real email addresses
- Hardcoded passwords
- Database connection strings with real credentials

### 🛡️ SAFEGUARDS IN PLACE

1. **Enhanced .gitignore** - Comprehensive exclusion patterns
2. **Pre-commit security scan** - Automated secret detection
3. **Template files only** - All secrets replaced with placeholders
4. **Clean git history** - Started fresh without compromised commits

### 🚀 SAFE COMMIT PROCESS

1. **Stage your changes**: `git add .`
2. **Run security scan**: `./pre-commit-security-scan.sh`
3. **Wait for ✅ SUCCESS**: If it fails, fix issues and re-run
4. **Review what you're committing**: `git diff --cached`
5. **Commit only after scan passes**: `git commit -m "your message"`
6. **Push only after local verification**: `git push`

### 🔍 EMERGENCY PROCEDURES

**If secrets are accidentally committed:**
1. **IMMEDIATELY stop all operations**
2. **Delete the repository** on GitHub
3. **Regenerate ALL compromised secrets**
4. **Start fresh with clean git history**
5. **Do not attempt to "fix" the history**

### 📞 CONTACT

If you're unsure about any file or pattern, **DO NOT COMMIT**.
It's better to be safe than to cause another security breach.

---

**Remember: The 4 previous breaches happened because this checklist wasn't followed.** 