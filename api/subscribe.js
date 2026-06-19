const nodemailer = require('nodemailer');

// Helper to send using Mailgun HTTP API via fetch
async function mailgunSend(domain, apiKey, formObj){
  const params = new URLSearchParams(formObj);
  const url = `https://api.mailgun.net/v3/${domain}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString(),
  });
  const text = await res.text();
  if(res.ok){
    try{ return JSON.parse(text); }catch(e){ return { raw: text }; }
  }
  throw new Error(`Mailgun error ${res.status}: ${text}`);
}

// Create transporter on demand (works in serverless)
async function createTransporter(){
  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const usingPlaceholder = host.includes('example.com') || !user || !pass;
  if(usingPlaceholder){
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    transporter.__isEthereal = true;
    transporter.__testAccount = testAccount;
    return transporter;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: (process.env.SMTP_SECURE === 'true'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const handler = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });
  const { email, name } = req.body || {};
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
  }

  if(!process.env.FROM_EMAIL){
    return res.status(500).json({ error: 'Sunucu yapılandırması hatası: FROM_EMAIL ayarlı değil.' });
  }
  if(!process.env.ADMIN_EMAIL){
    return res.status(500).json({ error: 'Sunucu yapılandırması hatası: ADMIN_EMAIL ayarlı değil.' });
  }

  const adminMail = {
    from: process.env.FROM_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: `Yeni bülten kaydı: ${email}`,
    html: `<p>Yeni abone kaydı alındı.</p><ul><li>E-mail: ${email}</li><li>İsim: ${name || '-'} </li></ul>`
  };

  const userMail = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Orionis — E-bülten kaydınız onaylandı',
    html: `
      <div style="font-family:Inter, Arial, Helvetica, sans-serif; color:#0b1220; max-width:680px; margin:0 auto;">
        <div style="background:#0b1220;padding:28px 20px;border-radius:8px 8px 0 0;color:#fff;text-align:center;">
          <h1 style="margin:0;font-size:24px;letter-spacing:0.2px">Orionis'e Hoş Geldiniz</h1>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85)">Seyahat haberleri ve özel kampanyalar için başarıyla kaydoldunuz.</p>
        </div>
        <div style="background:#fff;padding:22px;border:1px solid #eef2f7;border-top:0;border-radius:0 0 8px 8px;">
          <p style="font-size:16px;margin:0 0 12px">Merhaba ${name || ''},</p>
          <p style="color:#374151;margin:0 0 12px">Orionis e-bültenine kayıt olduğunuz için teşekkür ederiz. Artık en yeni turlarımız, erken rezervasyon fırsatları ve özel indirimler hakkında ilk siz bilgilendirileceksiniz.</p>
          <div style="margin:14px 0;text-align:center">
            <a href="https://orionis-website-sage.vercel.app" style="display:inline-block;padding:10px 18px;background:#0b1220;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Keşfetmeye Başla</a>
          </div>
          <p style="font-size:13px;color:#6b7280;margin:14px 0 0">Bu e-postayı almak istemiyorsanız, lütfen cevap verin ya da aboneliğinizi iptal edin.</p>
          <hr style="border:none;border-top:1px solid #eef2f7;margin:18px 0" />
          <p style="font-size:12px;color:#9ca3af;margin:0">Orionis Tours • Güvenli seyahat planları</p>
        </div>
      </div>
    `
  };

  try{
    const mgKey = process.env.MAILGUN_API_KEY;
    const mgDomain = process.env.MAILGUN_DOMAIN;
    const result = { message: 'Kayıt başarılı. Onay e-postası gönderildi.' };

    if(mgKey && mgDomain){
      const adminForm = { from: adminMail.from, to: adminMail.to, subject: adminMail.subject, html: adminMail.html };
      const userForm = { from: userMail.from, to: userMail.to, subject: userMail.subject, html: userMail.html };
      const infoAdmin = await mailgunSend(mgDomain, mgKey, adminForm);
      const infoUser = await mailgunSend(mgDomain, mgKey, userForm);
      result.mailgun = { admin: infoAdmin, user: infoUser };
      return res.status(200).json(result);
    }

    const transporter = await createTransporter();
    const infoAdmin = await transporter.sendMail(adminMail);
    const infoUser = await transporter.sendMail(userMail);
    if(transporter.__isEthereal){
      result.adminPreview = nodemailer.getTestMessageUrl(infoAdmin);
      result.userPreview = nodemailer.getTestMessageUrl(infoUser);
      console.log('Ethereal preview URLs:', result.adminPreview, result.userPreview);
    }
    return res.status(200).json(result);
  }catch(err){
    console.error('Mail send error', err);
    return res.status(500).json({ error: 'E-posta gönderilirken hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
};

module.exports = handler;
