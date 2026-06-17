require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static site (root is project folder parent)
app.use('/', express.static(path.join(__dirname, '..')));

// Create transporter. If SMTP creds are not provided (or left as placeholders),
// fall back to a Nodemailer test account (Ethereal) so you can test sending.
let transporter;
async function createTransporter(){
  const host = process.env.SMTP_HOST || '';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  const usingPlaceholder = host.includes('example.com') || !user || !pass;
  if(usingPlaceholder){
    console.log('SMTP credentials missing or placeholder detected — creating Ethereal test account for local testing.');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    transporter.__isEthereal = true;
    transporter.__testAccount = testAccount;
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: (process.env.SMTP_SECURE === 'true'),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
}

// initialize transporter before starting server
createTransporter().catch(err=>{
  console.error('Failed to create transporter', err);
  process.exit(1);
});

// Simple health
app.get('/api/health', (req, res)=> res.json({ ok: true }));

// Helper: send via Mailgun HTTP API (no extra deps)
function mailgunSend(domain, apiKey, formObj){
  return new Promise((resolve, reject)=>{
    const data = new URLSearchParams(formObj).toString();
    const options = {
      hostname: 'api.mailgun.net',
      path: `/v3/${domain}/messages`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res)=>{
      let body = '';
      res.on('data', chunk=> body += chunk);
      res.on('end', ()=>{
        if(res.statusCode >= 200 && res.statusCode < 300){
          try{ resolve(JSON.parse(body)); }catch(e){ resolve({ raw: body }); }
        } else {
          reject(new Error(`Mailgun API error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Subscribe endpoint
app.post('/api/subscribe', async (req, res) => {
  const { email, name } = req.body || {};
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
  }

  // Send admin notification
  const adminMail = {
    from: process.env.FROM_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: `Yeni bülten kaydı: ${email}`,
    html: `<p>Yeni abone kaydı alındı.</p><ul><li>E-mail: ${email}</li><li>İsim: ${name || '-'} </li></ul>`
  };

  // Send confirmation to subscriber
  const userMail = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Orionis — E-bülten kaydınız onaylandı',
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0b1220">
        <h2>Merhaba ${name || ''}</h2>
        <p>Orionis e-bültenine kayıt olduğunuz için teşekkürler. Size özel kampanyalardan ve yeni turlardan ilk siz haberdar olacaksınız.</p>
        <p style="font-size:.9rem;color:#6b7280">Bu e-postayı almayı istemiyorsanız reply ile bize bildirin veya aboneliğinizi iptal edin.</p>
        <hr />
        <p style="font-size:.85rem;color:#6b7280">Orionis Tours</p>
      </div>
    `
  };

  try{
    const mgKey = process.env.MAILGUN_API_KEY;
    const mgDomain = process.env.MAILGUN_DOMAIN;
    const result = { message: 'Kayıt başarılı. Onay e-postası gönderildi.' };

    if(mgKey && mgDomain){
      // send via Mailgun HTTP API
      const adminForm = { from: adminMail.from, to: adminMail.to, subject: adminMail.subject, html: adminMail.html };
      const userForm = { from: userMail.from, to: userMail.to, subject: userMail.subject, html: userMail.html };
      const infoAdmin = await mailgunSend(mgDomain, mgKey, adminForm);
      const infoUser = await mailgunSend(mgDomain, mgKey, userForm);
      // Mailgun returns id and message; include for debugging
      result.mailgun = { admin: infoAdmin, user: infoUser };
      return res.json(result);
    }

    // fallback to transporter (SMTP or Ethereal)
    const infoAdmin = await transporter.sendMail(adminMail);
    const infoUser = await transporter.sendMail(userMail);
    if(transporter.__isEthereal){
      result.adminPreview = nodemailer.getTestMessageUrl(infoAdmin);
      result.userPreview = nodemailer.getTestMessageUrl(infoUser);
      console.log('Ethereal preview URLs:', result.adminPreview, result.userPreview);
    }
    return res.json(result);
  }catch(err){
    console.error('Mail send error', err);
    return res.status(500).json({ error: 'E-posta gönderilirken hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
});

app.listen(PORT, ()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});
