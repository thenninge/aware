# 🚀 Vercel Deployment Guide

## 📋 **Før du starter - samle info:**

### 1. **Email Credentials**
```bash
EMAIL_USER=din-email@gmail.com
EMAIL_PASS=din-app-password  # IKKE vanlig passord!
```

### 2. **Google OAuth Setup**
- Gå til [Google Cloud Console](https://console.cloud.google.com/)
- Velg ditt prosjekt
- Gå til "Credentials" → "OAuth 2.0 Client IDs"
- Legg til ny redirect URI: `https://your-app-name.vercel.app/api/auth/callback/google`

### 3. **Vercel App Navn**
Velg et navn for appen (f.eks. `aware-team-sync`)

---

## 🚀 **Deployment Steps:**

### **Step 1: Push kode til GitHub**
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

### **Step 2: Connect til Vercel**
1. Gå til [vercel.com](https://vercel.com)
2. "Import Project" → Velg GitHub repo
3. Velg "Next.js" som framework
4. Sett app navn

### **Step 3: Environment Variables**
I Vercel dashboard, legg til:

```bash
# OAuth
GOOGLE_CLIENT_ID=din_google_client_id
GOOGLE_CLIENT_SECRET=din_google_client_secret
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=generer_med: openssl rand -base64 32

# Supabase (allerede konfigurert)
NEXT_PUBLIC_SUPABASE_URL=https://pbhutrjrzvscsquwnpaq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=din_anon_key
SUPABASE_SERVICE_ROLE_KEY=din_service_role_key

# Email
EMAIL_USER=din-email@gmail.com
EMAIL_PASS=din-app-password
```

### **Step 4: Deploy**
- Klikk "Deploy"
- Vent på build
- Test appen

---

## ✅ **Test Checklist:**

- [ ] OAuth login fungerer
- [ ] Team creation fungerer
- [ ] Team invitations sendes via email
- [ ] Sync fungerer mellom team members
- [ ] Map data synkroniseres

---

## 🆘 **Troubleshooting:**

**OAuth ikke fungerer:**
- Sjekk at redirect URI er riktig i Google Console
- Sjekk at NEXTAUTH_URL matcher Vercel URL

**Email ikke fungerer:**
- Sjekk at EMAIL_PASS er app password, ikke vanlig passord
- For Gmail: Aktiver 2FA og generer app password

**Database errors:**
- Sjekk at SUPABASE_SERVICE_ROLE_KEY er riktig
- Sjekk at alle SQL scripts er kjørt i Supabase
