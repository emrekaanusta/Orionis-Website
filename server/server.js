const path = require('path');
const dotenv = require('dotenv');
// Load root .env first (if present), then fallback to `server/.env` for local dev convenience.
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
const express = require('express');
const nodemailer = require('nodemailer');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase limits to allow large base64 image uploads from admin UI
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// helper: simple cookie parser
function parseCookies(req){
  const header = req.headers.cookie || '';
  return header.split(';').map(s=>s.trim()).filter(Boolean).reduce((acc,c)=>{
    const [k,v] = c.split('='); acc[k]=decodeURIComponent(v); return acc;
  }, {});
}

function requireAdmin(req,res,next){
  try{
    const cookies = parseCookies(req);
    const user = cookies.admin_user;
    const sig = cookies.admin_sig;
    const secret = process.env.ADMIN_SECRET || 'orionis_dev_secret';
    if(!user || !sig){ return res.status(401).json({ error: 'Unauthorized' }); }
    const expected = crypto.createHmac('sha256', secret).update(user).digest('hex');
    if(!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))){
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.adminUser = user;
    return next();
  }catch(e){
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Ensure data folders exist
const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if(!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const TOURS_FILE = path.join(DATA_DIR, 'tours.json');
if(!fs.existsSync(TOURS_FILE)) fs.writeFileSync(TOURS_FILE, JSON.stringify([]));

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

// Admin login (sets an HttpOnly cookie)
app.post('/api/admin/login', (req,res)=>{
  const { user, pass } = req.body || {};
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin';
  const secret = process.env.ADMIN_SECRET || 'orionis_dev_secret';
  if(user === adminUser && pass === adminPass){
    const sig = crypto.createHmac('sha256', secret).update(user).digest('hex');
    // Set cookies: admin_user (plain), admin_sig (HMAC) — HttpOnly for sig
    res.setHeader('Set-Cookie', [
      `admin_user=${encodeURIComponent(user)}; Path=/; SameSite=Lax`,
      `admin_sig=${sig}; Path=/; HttpOnly; SameSite=Lax`
    ]);
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/admin/logout', (req,res)=>{
  res.setHeader('Set-Cookie', [
    `admin_user=; Path=/; Max-Age=0; SameSite=Lax`,
    `admin_sig=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  ]);
  return res.json({ ok: true });
});

// Tours CRUD
app.get('/api/admin/tours', requireAdmin, (req,res)=>{
  try{
    const raw = fs.readFileSync(TOURS_FILE, 'utf8');
    const tours = JSON.parse(raw || '[]');
    return res.json({ tours });
  }catch(e){
    console.error('Failed to read tours', e);
    return res.status(500).json({ error: 'Failed to read tours' });
  }
});

app.post('/api/admin/tours', requireAdmin, (req,res)=>{
  try{
    const payload = req.body || {};
    const raw = fs.readFileSync(TOURS_FILE, 'utf8');
    const tours = JSON.parse(raw || '[]');
    if(payload.id){
      // update
      const idx = tours.findIndex(t=>t.id === payload.id);
      if(idx === -1) return res.status(404).json({ error: 'Tour not found' });
      tours[idx] = Object.assign({}, tours[idx], payload);
    } else {
      // create
      const id = 't_' + Date.now().toString(36);
      tours.push(Object.assign({ id }, payload));
    }
    fs.writeFileSync(TOURS_FILE, JSON.stringify(tours, null, 2));
    return res.json({ ok: true, tours });
  }catch(e){
    console.error('Failed to write tours', e);
    return res.status(500).json({ error: 'Failed to save tour' });
  }
});

// Delete a tour
app.delete('/api/admin/tours/:id', requireAdmin, (req,res)=>{
  try{
    const id = req.params.id;
    const raw = fs.readFileSync(TOURS_FILE, 'utf8');
    let tours = JSON.parse(raw || '[]');
    const idx = tours.findIndex(t=>t.id === id);
    if(idx === -1) return res.status(404).json({ error: 'Tour not found' });
    tours.splice(idx,1);
    fs.writeFileSync(TOURS_FILE, JSON.stringify(tours, null, 2));
    return res.json({ ok: true, tours });
  }catch(e){
    console.error('Failed to delete tour', e);
    return res.status(500).json({ error: 'Failed to delete tour' });
  }
});

// Upload image as base64 JSON { filename, data }
app.post('/api/admin/upload', requireAdmin, express.json({limit: '50mb'}), (req,res)=>{
  try{
    const { filename, data } = req.body || {};
    if(!filename || !data) return res.status(400).json({ error: 'filename and data required' });
    // data may be data:<mime>;base64,xxxx or plain base64
    const comma = data.indexOf(',');
    const base64 = (comma >=0) ? data.slice(comma+1) : data;
    const buf = Buffer.from(base64, 'base64');
    const safeName = Date.now() + '_' + filename.replace(/[^a-zA-Z0-9.\-_]/g,'_');
    const outPath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(outPath, buf);
    // return public URL path
    const publicUrl = `/uploads/${safeName}`;
    return res.json({ ok: true, url: publicUrl });
  }catch(e){
    console.error('Upload error', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// Public endpoint: list tours (used by homepage)
app.get('/api/tours', (req,res)=>{
  try{
    const raw = fs.readFileSync(TOURS_FILE, 'utf8');
    const tours = JSON.parse(raw || '[]');
    return res.json({ tours });
  }catch(e){
    console.error('Failed to read tours', e);
    return res.status(500).json({ error: 'Failed to read tours' });
  }
});

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
    // validate required env vars early to avoid Nodemailer EENVELOPE
    if(!process.env.FROM_EMAIL || !process.env.ADMIN_EMAIL){
      console.error('Email configuration missing: FROM_EMAIL or ADMIN_EMAIL not set');
      return res.status(500).json({ error: 'Sunucu yapılandırması eksik: FROM_EMAIL veya ADMIN_EMAIL ayarlı değil.' });
    }
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
    console.log('Sending subscribe emails', { adminMail, userMail });
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

// Booking endpoint (local fallback for testing)
app.post('/api/book', async (req, res) => {
  const { name, email, phone, tour, date, pax, notes } = req.body || {};
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name){
    return res.status(400).json({ error: 'Lütfen isim ve geçerli bir e-posta adresi sağlayın.' });
  }

  const adminMail = {
    from: process.env.FROM_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: `Yeni rezervasyon: ${tour} — ${name}`,
    html: `<h3>Yeni rezervasyon talebi</h3>
      <ul>
        <li>İsim: ${name}</li>
        <li>E-posta: ${email}</li>
        <li>Telefon: ${phone || '-'} </li>
        <li>Tur: ${tour || '-'} </li>
        <li>Tarih: ${date || '-'} </li>
        <li>Kişi sayısı: ${pax || '-'} </li>
        <li>Notlar: ${notes || '-'}</li>
      </ul>`
  };

  const userMail = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: `Rezervasyon talebiniz alındı — ${tour}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#0b1220">
        <h3>Teşekkürler, ${name}</h3>
        <p>Rezervasyon talebiniz alındı. Aşağıdaki bilgilerle kaydınız oluşturuldu:</p>
        <ul>
          <li>Tur: ${tour || '-'}</li>
          <li>Tarih: ${date || '-'}</li>
          <li>Kişi sayısı: ${pax || '-'}</li>
        </ul>
        <p>Danışmanlarımız en kısa sürede sizinle iletişime geçecektir.</p>
        <p style="font-size:.9rem;color:#6b7280">İyi yolculuklar — Orionis</p>
      </div>
    `
  };

  try{
    // validate required env vars early to avoid Nodemailer EENVELOPE
    if(!process.env.FROM_EMAIL || !process.env.ADMIN_EMAIL){
      console.error('Email configuration missing: FROM_EMAIL or ADMIN_EMAIL not set');
      return res.status(500).json({ error: 'Sunucu yapılandırması eksik: FROM_EMAIL veya ADMIN_EMAIL ayarlı değil.' });
    }

    const mgKey = process.env.MAILGUN_API_KEY;
    const mgDomain = process.env.MAILGUN_DOMAIN;
    const result = { message: 'Rezervasyon talebiniz alındı.' };

    if(mgKey && mgDomain){
      const adminForm = { from: adminMail.from, to: adminMail.to, subject: adminMail.subject, html: adminMail.html };
      const userForm = { from: userMail.from, to: userMail.to, subject: userMail.subject, html: userMail.html };
      const infoAdmin = await mailgunSend(mgDomain, mgKey, adminForm);
      const infoUser = await mailgunSend(mgDomain, mgKey, userForm);
      result.mailgun = { admin: infoAdmin, user: infoUser };
      return res.json(result);
    }

    console.log('Sending booking emails', { adminMail, userMail });
    const infoAdmin = await transporter.sendMail(adminMail);
    const infoUser = await transporter.sendMail(userMail);
    if(transporter.__isEthereal){
      result.adminPreview = nodemailer.getTestMessageUrl(infoAdmin);
      result.userPreview = nodemailer.getTestMessageUrl(infoUser);
      console.log('Ethereal preview URLs:', result.adminPreview, result.userPreview);
    }
    return res.json(result);
  }catch(err){
    console.error('Booking send error', err);
    return res.status(500).json({ error: 'Rezervasyon gönderilirken hata oluştu. Lütfen daha sonra tekrar deneyin.' });
  }
});

app.listen(PORT, ()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});
// Debug: print whether required env vars are present (don't print secrets)
console.log('Env check — FROM_EMAIL set?', !!process.env.FROM_EMAIL, 'ADMIN_EMAIL set?', !!process.env.ADMIN_EMAIL);
