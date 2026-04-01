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
