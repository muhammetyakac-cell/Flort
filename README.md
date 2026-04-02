# Flort Chat (Vite + Supabase)

Bu sürümde **mail/auth bağımlılığı tamamen kaldırıldı**. Admin girişi sadece `VITE_ADMIN_PASSWORD` ile yapılır.

## Özellikler
- Kullanıcı kaydı/girişi: sadece kullanıcı adı + şifre
- Admin girişi: sadece şifre (kullanıcı adı/email yok)
- Üye -> sadece sanal profillere mesaj atabilir
- Admin paneli: sanal profil oluşturma + tek cevap penceresi

## Kurulum
1. Proje kökündeki `.env` dosyasında şu değişkenleri güncelle:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`
2. `supabase/schema.sql` dosyasını SQL Editor'de çalıştır. (Eski `created_by` ve `messages_member_id_fkey` yapısını otomatik migrate eder)
3. Uygulamayı başlat:
   - `npm install`
   - `npm run dev`

## Önemli Not (Güvenlik)
Bu sürümde e-mail/auth tamamen kaldırıldığı için `members.password` alanı düz metin olarak tutulur ve anon erişim açıktır. Bu yapı **sadece hızlı prototip/demo** içindir.

## Vercel Deploy
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ADMIN_PASSWORD`
