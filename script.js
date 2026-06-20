document.addEventListener('DOMContentLoaded', ()=>{
  // Header scroll behavior: add a class when the page is scrolled
  const header = document.querySelector('.site-header');
  function onScrollHeader(){
    if(window.scrollY > 20) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }

  // Header search (filters tour cards by title or category)
  const searchForm = document.getElementById('tourSearch');
  if(searchForm){
    searchForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const q = (new FormData(searchForm).get('q')||'').trim().toLowerCase();
      const currentTours = getTours();
      if(!currentTours || currentTours.length===0){
        // if no tour cards on this page, navigate to home with anchor
        if(q) window.location.href = `./index.html#tours`; else window.location.href = `./index.html`;
        return;
      }
      currentTours.forEach(t => {
        const title = (t.querySelector('.tour-title')?.textContent||'').toLowerCase();
        const cat = (t.dataset.category||'').toLowerCase();
        if(!q || title.includes(q) || cat.includes(q)) t.style.display = '';
        else t.style.display = 'none';
      });
    });
  }

  // Footer newsletter removed — using main newsletter section instead

  // Lightbox: attach to gallery, timeline and card images
  function openLightbox(src, alt){
    let lb = document.getElementById('lightbox');
    if(!lb) return;
    const img = lb.querySelector('img');
    const cap = lb.querySelector('.lightbox-caption');
    img.src = src; img.alt = alt || '';
    cap.textContent = alt || '';
    lb.setAttribute('aria-hidden','false');
    document.body.classList.add('lightbox-open');
  }
  function closeLightbox(){
    const lb = document.getElementById('lightbox'); if(!lb) return;
    lb.setAttribute('aria-hidden','true');
    const img = lb.querySelector('img'); img.src = '';
    document.body.classList.remove('lightbox-open');
  }
  // Global click handler: handle lightbox close first, backdrop click, then image clicks
  document.addEventListener('click', (e)=>{
    // Close when clicking close button
    if(e.target.closest && e.target.closest('.lightbox-close')){ closeLightbox(); return; }

    // Close when clicking on backdrop (outside inner)
    const lb = document.getElementById('lightbox');
    if(lb && (e.target === lb || e.target.closest && e.target.closest('.lightbox') === lb && !e.target.closest('.lightbox-inner'))){
      closeLightbox(); return;
    }

    // Open lightbox for images inside our components
    const img = e.target.closest && e.target.closest('img');
    if(!img) return;
    if(img.closest('.gallery') || img.closest('.timeline-img') || img.closest('.tour-card')){
      e.preventDefault(); openLightbox(img.src, img.alt || '');
    }
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeLightbox(); });
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, {passive:true});

  // Fetch dynamic tours from server (if any) and render them into .tours-grid
  async function fetchAndRenderTours(){
    try{
      const res = await fetch('/api/tours');
      if(!res.ok) return;
      const data = await res.json();
      const list = data.tours || [];
      if(list.length===0) return;
      const grid = document.querySelector('.tours-grid');
      if(!grid) return;
      list.forEach(t=>{
        const a = document.createElement('article'); a.className='tour-card';
        a.dataset.category = t.yurtdisi ? 'yurtdisi' : (t.duration && t.duration.includes('1 gün') ? 'gunubirlik' : 'yurtici');
        a.innerHTML = `
          <img src="${t.hero || 'https://picsum.photos/1200/800'}" alt="${t.title||''}">
          <div class="card-body">
            <h3 class="tour-title">${t.title||''}</h3>
            <p class="muted">${t.duration||''}</p>
            <p class="tour-desc">${t.description||''}</p>
            <div class="card-footer">
              <strong class="price">${t.price||''}</strong>
              <div style="display:flex;gap:.5rem">
                <a class="btn ghost" href="/tour.html?id=${t.id||''}">Detay</a>
                <button class="btn book-btn" data-title="${t.title||''}" data-price="${t.price||''}">Rezervasyon</button>
              </div>
            </div>
          </div>`;
        // prepend so existing static cards remain visible
        grid.insertBefore(a, grid.firstChild);
      });
      // rebind tours variable and book buttons
      bindDynamicTours();
    }catch(err){ console.warn('No dynamic tours', err); }
  }

  function bindDynamicTours(){
    // update tours NodeList used by search and filters
    const newTours = document.querySelectorAll('.tour-card');
    // re-run current filter
    // replace local reference by reassigning variable (note: original 'tours' declared later)
    // Attach booking handlers
    document.querySelectorAll('.book-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{ openModal(btn.dataset.title || 'Tur', btn.dataset.price || ''); });
    });
  }

  fetchAndRenderTours().then(()=>{
    // after potential dynamic load, refresh the 'tours' NodeList used earlier
    // Note: re-query the NodeList so filtering/search use the dynamic content
    // This simple approach assumes static filters applied after load
  });

  const modal = document.getElementById('bookingModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalPrice = document.getElementById('modalPrice');
  const closeBtn = document.querySelector('.modal-close');
  const form = document.getElementById('bookingForm');

  // Category filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  function getTours(){ return document.querySelectorAll('.tour-card'); }

  function applyFilter(filter){
    getTours().forEach(t => {
      const cat = t.dataset.category || '';
      if(filter === 'all' || filter === cat) t.style.display = '';
      else t.style.display = 'none';
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', ()=>{
      const filter = btn.dataset.filter;
      filterBtns.forEach(b=>{ b.classList.toggle('active', b===btn); b.setAttribute('aria-pressed', b===btn); });
      applyFilter(filter);
    });
  });

  // Newsletter subscription handling
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterMsg = document.getElementById('newsletterMsg');
  if(newsletterForm){
    newsletterForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(newsletterForm);
      const payload = { name: fd.get('name') || '', email: fd.get('email') };
      newsletterMsg.textContent = 'Gönderiliyor...';
      try{
        const res = await fetch('/api/subscribe', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        // Try to parse JSON safely; if response is HTML (error page) handle gracefully
        let json;
        try { json = await res.json(); } catch(err) { json = null; }
        if(res.ok){
          // Show success message and any preview URLs (Ethereal) returned by server
          let msg = (json && json.message) ? json.message : 'Kayıt başarılı. Teşekkürler!';
          if(json.userPreview || json.adminPreview){
            msg += ' Önizleme bağlantıları:';
            if(json.userPreview) msg += ` <a href="${json.userPreview}" target="_blank" rel="noopener">Abone e-postası</a>`;
            if(json.adminPreview) msg += ` <a href="${json.adminPreview}" target="_blank" rel="noopener">Yönetici bildirimi</a>`;
          } else {
            msg += ' (E-posta gerçek posta kutunuza ulaşmadıysa spam klasörünü kontrol edin veya SMTP ayarlarınızı doğrulayın.)';
          }
          newsletterMsg.innerHTML = msg;
          newsletterForm.reset();
        } else {
          // If the server returned non-JSON (html error page), include status text
          if(json && json.error){
            newsletterMsg.textContent = json.error;
          } else {
            newsletterMsg.textContent = `Bir hata oluştu (${res.status} ${res.statusText}). Lütfen tekrar deneyin.`;
          }
        }
      }catch(err){
        console.error(err);
        newsletterMsg.textContent = 'Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.';
      }
    });
  }


  function openModal(title, price){
    modalTitle.textContent = title;
    modalPrice.textContent = price;
    modal.setAttribute('aria-hidden','false');
  }
  function closeModal(){
    modal.setAttribute('aria-hidden','true');
  }

  document.querySelectorAll('.book-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const title = btn.dataset.title || 'Tur';
      const price = btn.dataset.price || '';
      openModal(title, price);
    })
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
      tour: modalTitle.textContent,
      pax: data.get('pax'),
      notes: data.get('notes')
    };
    // show inline status instead of alert
    const statusEl = document.getElementById('bookingStatus');
    if(statusEl) statusEl.textContent = 'Gönderiliyor...';
    fetch('/api/book', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      .then(async (r)=>{
        // attempt to parse JSON, but handle HTML error pages gracefully
        let body = null;
        try { body = await r.json(); } catch(e) { body = null; }
        return { ok: r.ok, status: r.status, statusText: r.statusText, body };
      })
      .then(({ok, status, statusText, body})=>{
        if(ok){
          if(statusEl) statusEl.innerHTML = 'Rezervasyon talebiniz alındı. Danışmanlarımız en kısa sürede sizinle iletişime geçecektir.';
          form.reset(); closeModal();
        } else {
          if(body && body.error) statusEl.textContent = body.error;
          else statusEl.textContent = `Bir hata oluştu (${status} ${statusText}). Lütfen daha sonra tekrar deneyin.`;
        }
      }).catch(err=>{
        console.error(err);
        if(statusEl) statusEl.textContent = 'Sunucuya bağlanılamadı. Lütfen daha sonra tekrar deneyin.';
      });
  });
});
