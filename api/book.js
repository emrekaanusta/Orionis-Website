const nodemailer = require('nodemailer');

async function mailgunSend(domain, apiKey, formObj){
  const params = new URLSearchParams(formObj).toString();
  const https = require('https');
  return new Promise((resolve, reject)=>{
    const options = {
      hostname: 'api.mailgun.net',
      path: `/v3/${domain}/messages`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params)
      }
    };
    const req = https.request(options, (res)=>{
      let body = '';
      res.on('data', c=> body += c);
      res.on('end', ()=>{
        if(res.statusCode >= 200 && res.statusCode < 300){
          try{ resolve(JSON.parse(body)); }catch(e){ resolve({ raw: body }); }
        } else reject(new Error(`Mailgun ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(params);
    req.end();
  });
}

async function createTransporter(){
  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const usingPlaceholder = host.includes('example.com') || !user || !pass;
  if(usingPlaceholder){
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    transporter.__isEthereal = true; transporter.__testAccount = testAccount;
    return transporter;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT||587),
    secure: (process.env.SMTP_SECURE==='true'), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });
  const { name, email, phone, tour, date, pax, notes } = req.body || {};
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Geçerli bir e-posta giriniz.' });
  if(!tour) return res.status(400).json({ error: 'Tur bilgisi eksik.' });

  if(!process.env.FROM_EMAIL || !process.env.ADMIN_EMAIL) return res.status(500).json({ error: 'Sunucu yapılandırması eksik (FROM_EMAIL veya ADMIN_EMAIL).' });

  const adminMail = {
    from: process.env.FROM_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: `Yeni rezervasyon talebi — ${tour}`,
    html: `<h3>Yeni rezervasyon talebi</h3><ul><li>İsim: ${name || '-'}</li><li>E-posta: ${email}</li><li>Tel: ${phone || '-'}</li><li>Tur: ${tour}</li><li>Tarih: ${date || '-'}</li><li>Kişi sayısı: ${pax || '-'}</li><li>Notlar: ${notes || '-'}</li></ul>`
  };

  const userMail = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: `Rezervasyon talebiniz alındı — ${tour}`,
    html: `
      <div style="font-family:Inter, Arial, Helvetica, sans-serif; max-width:640px;margin:0 auto;color:#0b1220;">
        <div style="background:#0b1220;color:#fff;padding:20px;border-radius:8px;text-align:center;">
          <h2 style="margin:0">Rezervasyon Talebiniz Alındı</h2>
        </div>
        <div style="background:#fff;border:1px solid #eef2f7;padding:18px;border-radius:0 0 8px 8px;">
          <p>Merhaba ${name || ''},</p>
          <p>Rezervasyon talebiniz başarıyla alındı. Aşağıda gönderdiğiniz bilgiler yer almaktadır. Danışmanlarımız en kısa sürede sizinle iletişime geçecek.</p>
          <ul style="color:#374151"><li><strong>Tur:</strong> ${tour}</li><li><strong>Tarih:</strong> ${date || '-'}</li><li><strong>Kişi sayısı:</strong> ${pax || '-'}</li><li><strong>İletişim:</strong> ${phone || '-'} / ${email}</li></ul>
          <p>Herhangi bir değişiklik yapmak isterseniz lütfen bu e-postaya cevap verin veya bizi arayın.</p>
          <p style="color:#6b7280;font-size:13px;">Orionis — Size güvenli ve unutulmaz bir seyahat planlamak için buradayız.</p>
        </div>
      </div>
    `
  };

  try{
    const mgKey = process.env.MAILGUN_API_KEY; const mgDomain = process.env.MAILGUN_DOMAIN;
    const result = { message: 'Rezervasyon talebiniz alındı.' };
    if(mgKey && mgDomain){
      const infoAdmin = await mailgunSend(mgDomain, mgKey, { from: adminMail.from, to: adminMail.to, subject: adminMail.subject, html: adminMail.html });
      const infoUser = await mailgunSend(mgDomain, mgKey, { from: userMail.from, to: userMail.to, subject: userMail.subject, html: userMail.html });
      result.mailgun = { admin: infoAdmin, user: infoUser };
      return res.json(result);
    }

    const transporter = await createTransporter();
    const infoAdmin = await transporter.sendMail(adminMail);
    const infoUser = await transporter.sendMail(userMail);
    if(transporter.__isEthereal){ result.adminPreview = nodemailer.getTestMessageUrl(infoAdmin); result.userPreview = nodemailer.getTestMessageUrl(infoUser); }
    return res.json(result);
  }catch(err){ console.error('Booking mail error', err); return res.status(500).json({ error: 'E-posta gönderilirken hata oluştu.' }); }
};
