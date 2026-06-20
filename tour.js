function qs(name){
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function renderTour(){
  const id = qs('id');
  const titleEl = document.getElementById('title');
  const metaEl = document.getElementById('meta');
  const descEl = document.getElementById('desc');
  const heroEl = document.getElementById('hero');
  const galleryEl = document.getElementById('gallery');
  const timelineEl = document.getElementById('timeline');
  const bookBtn = document.getElementById('bookBtn');

  if(!id){ titleEl.textContent = 'Tur bulunamadı'; return; }
  try{
    const res = await fetch('/api/tours');
    const data = await res.json();
    const tours = data.tours || [];
    const t = tours.find(x=>x.id === id);
    if(!t){ titleEl.textContent = 'Tur bulunamadı'; return; }
    titleEl.textContent = t.title || '';
    metaEl.textContent = (t.duration||'') + (t.price?(' · '+t.price):'');
    descEl.innerHTML = t.description ? t.description.split('\n').map(s=>'<p>'+s+'</p>').join('') : '';
    if(t.hero){ heroEl.style.backgroundImage = `url('${t.hero}')`; }

    // gallery
    galleryEl.innerHTML = '';
    (t.gallery||[]).forEach(u=>{
      const img = document.createElement('img'); img.src = u; img.alt = t.title || ''; img.style.width='220px'; img.style.height='140px'; img.style.objectFit='cover'; img.style.marginRight='8px'; img.style.borderRadius='6px'; img.style.cursor='pointer';
      galleryEl.appendChild(img);
    });

    // timeline
    timelineEl.innerHTML = '';
    (t.timeline||[]).forEach((it, idx)=>{
      const wrap = document.createElement('div'); wrap.className='timeline-item';
      const dot = document.createElement('span'); dot.className='timeline-dot';
      const h = document.createElement('h4'); h.textContent = it.title || ('Gün '+(idx+1));
      const p = document.createElement('p'); p.textContent = it.desc || '';
      wrap.appendChild(dot); wrap.appendChild(h); wrap.appendChild(p);
      if(it.img){ const div = document.createElement('div'); div.className='timeline-img'; const im = document.createElement('img'); im.src = it.img; im.alt = it.title || ''; div.appendChild(im); wrap.appendChild(div); }
      timelineEl.appendChild(wrap);
    });

    // populate aside info and let main site's script handle .book-btn clicks
    const priceEl = document.getElementById('price');
    const priceMeta = document.getElementById('priceMeta');
    const includesEl = document.getElementById('includes');
    const meetingEl = document.getElementById('meetingPoint');
    priceEl.textContent = t.price || '₺0';
    priceMeta.textContent = (t.price ? ('Kişi başı · ' + (t.duration||'')) : (t.duration||''));
    includesEl.innerHTML = '';
    (t.includes||[]).forEach(itm=>{ const li = document.createElement('li'); li.textContent = itm; includesEl.appendChild(li); });
    meetingEl.textContent = t.meeting || '';
    if(bookBtn){ bookBtn.dataset.title = t.title || ''; bookBtn.dataset.price = t.price || ''; }

  }catch(err){ console.error('Failed to load tour', err); titleEl.textContent='Yüklenirken hata oluştu'; }
}

function openLightbox(url, cap){
  const lb = document.getElementById('lightbox'); const img = document.getElementById('lb-img'); const capEl = document.getElementById('lb-cap');
  img.src = url; capEl.textContent = cap || '';
  lb.style.display = 'flex';
}

function closeLightbox(){ const lb = document.getElementById('lightbox'); lb.style.display='none'; }

document.addEventListener('DOMContentLoaded', ()=>{
  renderTour();
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', (e)=>{ if(e.target.id==='lightbox') closeLightbox(); });
});
