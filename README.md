# Flort Chat (Vite + Supabase)

Bu sürümde **email / Supabase Auth bağımlılığı kaldırıldı**. Girişler tamamen kullanıcı adı + şifre üzerinden çalışır.

## Kurulum
1. `.env` içindeki değerleri girin:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`
2. Supabase SQL Editor'de `supabase/schema.sql` dosyasını çalıştırın.
3. `npm install`
4. `npm run dev`

## Giriş Kuralları
- **Admin girişi:** kullanıcı adı boş bırakılır, sadece `VITE_ADMIN_PASSWORD` ile giriş yapılır.
- **Kullanıcı girişi:** kullanıcı adı + şifre.
- **Kullanıcı kaydı:** kullanıcı adı + şifre.

## Önemli Not
Bu modelde auth email/JWT kullanılmadığı için erişim kontrolü frontend session + açık RLS policy ile yapılır. Üretim ortamı için ek güvenlik katmanı gerekir.
