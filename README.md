# Flort Chat (Vite + Supabase)

Bu proje, üyelerin yalnızca admin tarafından yaratılan **sanal profillerle** sohbet ettiği bir uygulamadır.

## Özellikler
- Kullanıcı kaydı/girişi (yalnızca kullanıcı adı + şifre)
- Ana sayfada küçük **Admin girişi** linki
- Üye -> sadece sanal profillere mesaj atabilir
- Üyeler birbirine mesaj atamaz (veri modelinde user-user kanal yok)
- Admin panelinde:
  - Sanal profil oluşturma (ad, yaş, cinsiyet, hobiler)
  - Mesajlara tek pencereden sırayla cevap verme

## Kurulum
1. Proje kökünde `.env` dosyası hazır gelir. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ve `VITE_ADMIN_PASSWORD` değerlerini gerçek bilgilerinizle güncelleyin.
2. `supabase/schema.sql` içindeki `'admin'` ifadesini kendi admin kullanıcı adınızla değiştirin.
3. `supabase/schema.sql` dosyasını SQL Editor'de çalıştırın.
4. Admin hesabını Supabase Auth üzerinden manuel açın:
   - Email: `admin@flort.local`
   - Password: `.env` içindeki `VITE_ADMIN_PASSWORD`
   - User metadata: `{ "username": "admin" }`
   - İlk admin girişinde hesap yoksa uygulama `admin@flort.local` + `VITE_ADMIN_PASSWORD` ile admin hesabını otomatik oluşturmaya çalışır.
5. Yerelde çalıştırın:
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


## Invalid login credentials (Admin) - Kapsamlı Kontrol
Aşağıdaki maddeleri sırayla doğrulayın:
1. `.env` içindeki `VITE_ADMIN_PASSWORD`, admin giriş ekranına yazdığınız şifre ile birebir aynı olmalı.
2. Uygulama admin için daima `admin@flort.local` ile giriş dener. Supabase Auth içinde bu kullanıcı olmalı veya Sign Up açık olmalı ki otomatik oluşturulabilsin.
3. Supabase Dashboard -> Authentication -> Providers içinde **Email provider enabled** olmalı.
4. Supabase Dashboard -> Authentication -> Settings içinde **Confirm email** açıksa, yeni oluşan admin hesabı doğrulanmadan giriş yapamaz.
5. Supabase Dashboard -> Authentication -> Settings içinde **Disable new user signups** aktifse otomatik admin oluşturma başarısız olur.
6. `.env` değiştiyse Vite dev server'ı yeniden başlatın (`npm run dev`).

Not: Uygulama artık hata mesajında Supabase'in döndürdüğü asıl nedeni doğrudan gösterir.
