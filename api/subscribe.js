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
      <div style=\"font-family:Arial,Helvetica,sans-serif;color:#0b1220\">\n        <h2>Merhaba ${name || ''}</h2>\n        <p>Orionis e-bültenine kayıt olduğunuz için teşekkürler. Size özel kampanyalardan ve yeni turlardan ilk siz haberdar olacaksınız.</p>\n        <p style=\"font-size:.9rem;color:#6b7280\">Bu e-postayı almayı istemiyorsanız reply ile bize bildirin veya aboneliğinizi iptal edin.</p>\n        <hr />\n        <p style=\"font-size:.85rem;color:#6b7280\">Orionis Tours</p>\n      </div>\n    `
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
