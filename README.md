# Flort Chat (Vite + Supabase)

Bu proje, üyelerin yalnızca admin tarafından yaratılan **sanal profillerle** sohbet ettiği bir uygulamadır.

## Özellikler
- Kullanıcı kaydı/girişi (username + şifre + email)
- Ana sayfada küçük **Admin girişi** linki
- Üye -> sadece sanal profillere mesaj atabilir
- Üyeler birbirine mesaj atamaz (veri modelinde user-user kanal yok)
- Admin panelinde:
  - Sanal profil oluşturma (ad, yaş, cinsiyet, hobiler)
  - Mesajlara tek pencereden sırayla cevap verme
- **✨ Modernleştirilmiş UI** (v0.1.0):
  - Modern renk sistemi ve tasarım
  - Desktop-optimized responsive layout
  - Keyboard shortcuts (Enter için mesaj, Shift+Enter için yeni satır)
  - Geliştirilmiş empty states ve error handling
  - Professional emoji iconları

## Kurulum
1. `.env.example` dosyasını `.env` olarak kopyalayın.
2. Supabase URL ve Anon key bilgilerini girin.
3. `supabase/schema.sql` dosyasını SQL Editor'de çalıştırın.
4. Yerelde çalıştırın:
   - `npm install`
   - `npm run dev`

## Vercel Deploy
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## Not
Admin hesabı açarken giriş ekranını **Admin girişi** moduna alıp kayıt olun. Bu role, Supabase auth metadata içinde `role: admin` olarak yazılır.

## v0.1.0 - UI Modernizasyonu (2026-04-05)
- Kapsamlı CSS modernizasyonu (397 satır organized CSS)
- React render functions reorganized (renderAuthForm, renderAdminPanel, renderUserPanel)
- Renk sistemi eklendi (12+ CSS variables)
- Responsive breakpoints (desktop-optimized)
- Keyboard shortcuts desteği
- Better empty states
- Emoji icons
- Professional styling
