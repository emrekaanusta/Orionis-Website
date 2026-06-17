# Orionis — Minimal Tour Site

Bu proje, `Orionis` adlı hayali bir tur şirketi için basit ve güzel bir açılış sayfası iskeleti sunar. `index.html`, `styles.css` ve `script.js` içerir.

Çalıştırma

- Dosyaları açmak için en kolay yol: `orionis-site/index.html` dosyasını tarayıcıda açın.
- Geliştirme sırasında canlı önizleme için VS Code'da *Live Server* eklentisini kullanabilirsiniz.

Geliştirme / Sonraki Adımlar

- Backend entegrasyonu: rezervasyon formunu bir API'ye bağlayın.
- Görseller: placeholder yerine kendi yüksek çözünürlü görsellerinizi ekleyin (`/assets` dizini).
- Deploy: Netlify veya Vercel ile hızlıca yayınlanabilir.

E-posta aboneliği (local test)

Projeye basit bir Node.js sunucusu ekledim (`server/server.js`) — bu sunucu hem statik dosyaları servis eder hem de `/api/subscribe` endpoint'i ile e-posta gönderimi yapar. Test etmek için:

1. Terminalde proje kök dizinine gidin:

```bash
cd /c/Users/My/Desktop/github/orionis-site/server
```

2. Bağımlılıkları yükleyin:

```bash
npm install
```

3. `.env.example` dosyasını kopyalayıp `.env` olarak ekleyin ve kendi SMTP bilgilerinizi girin:

```bash
cp .env.example .env
# edit .env and set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, ADMIN_EMAIL
```

4. Sunucuyu başlatın:

```bash
npm start
```

5. Tarayıcınızda `http://localhost:3000` açın; ana sayfadaki e-bülten formuna e-mail adresinizi girip deneyin. Başarılı olursa hem yöneticiye bildirim gönderilir hem de aboneye onay e-postası gider.

Notlar:
- Gerçek test için SMTP olarak Gmail kullanacaksanız, uygulama/parola veya App Password gerekecektir (Gmail güvenlik ayarlarına bakın). Alternatif olarak Mailgun, SendGrid veya başka bir SMTP sağlayıcı kullanabilirsiniz.
- Production için bu sunucu yerine Netlify Functions, Vercel Serverless veya bir gerçek backend öneririm; SMTP bilgilerini sunucuda güvenli şekilde saklayın.

Dosya yapısı

- `index.html` — Ana sayfa ve modal.
- `styles.css` — Temel stil ve responsive düzen.
- `script.js` — Modal kontrolü ve form işlemi.

İhtiyaç olursa turların sayısını artırıp içerikleri, fiyatları ve detay sayfalarını da ekleyebilirim.
