# Flort Chat (Vite + Supabase)

Bu sürümde admin ve üyeler profil fotoğrafı yükleyebilir.

## Özellikler
- Kullanıcı kaydı/girişi: sadece kullanıcı adı + şifre
- Admin girişi: sadece şifre
- Admin sanal profil oluştururken: ad, yaş, cinsiyet, hobiler + **fotoğraf**
- Üye giriş yaptıktan sonra kendi profilini düzenler: yaş, hobiler, şehir + **fotoğraf**
- Üye -> sadece sanal profillere mesaj atabilir
- Admin paneli: tek cevap penceresi + konuşma geçmişini görme

## Kurulum
1. Proje kökündeki `.env` dosyasında şu değişkenleri güncelle:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`
2. `supabase/schema.sql` dosyasını SQL Editor'de çalıştır. (Eski şemalardan migration + storage bucket/policy kurulumu yapar, tekrar çalıştırılabilir)
3. Uygulamayı başlat:
   - `npm install`
   - `npm run dev`

> Eğer `Could not find the 'photo_url' column of 'virtual_profiles'` hatası alırsan, `supabase/schema.sql` scriptini tekrar çalıştır.

## Yeni Migration İçeriği
- `member_profiles` tablosu
- `virtual_profiles.photo_url` kolonu
- `profile-images` storage bucket + policy'ler

## Önemli Not (Güvenlik)
Bu yapı demo/prototip içindir. `members.password` düz metin tutulur ve anon erişim açıktır.

## Vercel Deploy
- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ADMIN_PASSWORD`
