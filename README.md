# Flort Chat (Vite + Supabase)

Bu sürümde **mail / Supabase Auth bağımlılığı tamamen kaldırıldı**.

## Giriş Mantığı
- Admin girişinde kullanıcı adı boş bırakılır, sadece şifre girilir.
- Admin şifresi: `.env` içindeki `VITE_ADMIN_PASSWORD`
- Üye giriş/kayıt: sadece kullanıcı adı + şifre (mail yok).

## Kurulum
1. `.env` içindeki değişkenleri girin:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`
2. `supabase/schema.sql` dosyasını SQL Editor'de çalıştırın.
3. Yerelde çalıştırın:
   - `npm install`
   - `npm run dev`

## Vercel Deploy
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ADMIN_PASSWORD`
