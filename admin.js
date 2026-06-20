async function postJson(url, body){
  const res = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  return res.json();
}

function el(q){return document.querySelector(q)}
function elAll(q){return Array.from(document.querySelectorAll(q))}

document.addEventListener('DOMContentLoaded', ()=>{
  const loginBox = el('#loginBox');
  const panel = el('#panel');
  const loginBtn = el('#loginBtn');
  const logoutBtn = el('#logoutBtn');
  const newBtn = el('#newBtn');
  const tourList = el('#tourList');
  const tourForm = el('#tourForm');
  const saveMsg = el('#saveMsg');
  const uploadBtn = el('#uploadBtn');
  const fileInput = el('#fileInput');
  const uploadMsg = el('#uploadMsg');
  const uploadPreview = el('#uploadPreview');
  const galleryList = el('#galleryList');
  const galleryUrl = el('#galleryUrl');
  const addGalleryUrl = el('#addGalleryUrl');
  const timelineItems = el('#timelineItems');
  const addTimelineItem = el('#addTimelineItem');

  let currentGallery = [];
  let currentTimeline = [];

  async function checkAuth(){
    try{
      const r = await fetch('/api/admin/tours');
      if(r.status===200){
        loginBox.style.display='none'; panel.style.display='block';
        const data = await r.json(); renderTours(data.tours || []);
        return true;
      }
    }catch(e){}
    loginBox.style.display='block'; panel.style.display='none';
    return false;
  }

  function renderTours(tours){
    tourList.innerHTML='';
    tours.forEach(t=>{
      const d = document.createElement('div'); d.className='tour-card';
      d.innerHTML = `<strong>${t.title || '(untitled)'}</strong><div class="small muted">${t.duration||''} ${t.price?('· '+t.price):''}</div><div style="margin-top:8px"><button class="btn edit" data-id="${t.id}">Düzenle</button> <button class="btn danger delete" data-id="${t.id}">Sil</button></div>`;
      tourList.appendChild(d);
    });
    elAll('.tour-card .edit').forEach(b=> b.addEventListener('click', ()=>{ const id = b.dataset.id; loadEdit(id); }));
    elAll('.tour-card .delete').forEach(b=> b.addEventListener('click', async ()=>{
      const id = b.dataset.id;
      if(!confirm('Bu turu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
      try{
        const res = await fetch(`/api/admin/tours/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if(res.ok && data.ok){ renderTours(data.tours || []); }
        else alert((data && data.error) || 'Silme hatası');
      }catch(e){ alert('Silme isteği başarısız'); }
    }));
  }

  function renderGallery(){
    galleryList.innerHTML='';
    currentGallery.forEach((url, idx)=>{
      const item = document.createElement('div'); item.style.display='flex'; item.style.alignItems='center'; item.style.gap='8px'; item.style.marginBottom='8px';
      const img = document.createElement('img'); img.src = url; img.style.width='120px'; img.style.height='70px'; img.style.objectFit='cover'; img.alt=''; img.style.borderRadius='6px';
        const btns = document.createElement('div'); btns.innerHTML = `<div class=\"small muted\">${url}</div><div style=\"margin-top:6px\"><button type="button" class=\"btn remove\" data-idx=\"${idx}\">Kaldır</button> <button type="button" class=\"btn set-hero\" data-idx=\"${idx}\">Kahraman Yap</button></div>`;
      item.appendChild(img); item.appendChild(btns); galleryList.appendChild(item);
    });
    elAll('#galleryList .remove').forEach(b=> b.addEventListener('click', ()=>{ const i = Number(b.dataset.idx); currentGallery.splice(i,1); renderGallery(); }));
    elAll('#galleryList .set-hero').forEach(b=> b.addEventListener('click', ()=>{ const i = Number(b.dataset.idx); tourForm.hero.value = currentGallery[i] || ''; }));
    // update datalist for timeline image selection
    const dl = document.getElementById('galleryOptions');
    if(dl){ dl.innerHTML = ''; currentGallery.forEach(u=>{ const opt = document.createElement('option'); opt.value = u; dl.appendChild(opt); }); }
    // update timeline inputs in case they need refreshed options
    renderTimeline();
  }

  function renderTimeline(){
    timelineItems.innerHTML='';
    currentTimeline.forEach((it, idx)=>{
      const wrap = document.createElement('div'); wrap.style.border='1px solid #233a48'; wrap.style.padding='8px'; wrap.style.marginBottom='8px'; wrap.style.borderRadius='6px';
      const imgVal = it.img || '';
      wrap.innerHTML = `
        <div class="form-row"><label>Gün Başlığı</label><input class="ti-title" data-idx="${idx}" type="text" value="${it.title||''}"></div>
        <div class="form-row"><label>Açıklama</label><textarea class="ti-desc" data-idx="${idx}" rows="2">${it.desc||''}</textarea></div>
        <div class="form-row"><label>Resim URL veya galeriden seç</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input list="galleryOptions" class="ti-img" data-idx="${idx}" type="text" value="${imgVal}">
            <select class="ti-img-select" data-idx="${idx}"><option value="">-- Galeriden seç --</option></select>
            <button type="button" class="btn ti-img-use" data-idx="${idx}">Kullan</button>
          </div>
        </div>
        <div style="margin-top:6px"><button type="button" class="btn ti-remove" data-idx="${idx}">Günü Kaldır</button></div>
      `;
      timelineItems.appendChild(wrap);
    });
    elAll('.ti-remove').forEach(b=> b.addEventListener('click', ()=>{ const i=Number(b.dataset.idx); currentTimeline.splice(i,1); renderTimeline(); }));
    elAll('.ti-title').forEach(inp=> inp.addEventListener('input', ()=>{ const i=Number(inp.dataset.idx); currentTimeline[i].title = inp.value; }));
    elAll('.ti-desc').forEach(inp=> inp.addEventListener('input', ()=>{ const i=Number(inp.dataset.idx); currentTimeline[i].desc = inp.value; }));
    elAll('.ti-img').forEach(inp=> inp.addEventListener('input', ()=>{ const i=Number(inp.dataset.idx); currentTimeline[i].img = inp.value; }));
    // populate select options for choosing gallery images
    elAll('.ti-img-select').forEach(sel=>{
      const idx = Number(sel.dataset.idx);
      sel.innerHTML = `<option value="">-- Galeriden seç --</option>`;
      currentGallery.forEach(u=>{ const o = document.createElement('option'); o.value = u; o.textContent = u; sel.appendChild(o); });
    });
    // use selected gallery image into input
    elAll('.ti-img-use').forEach(b=> b.addEventListener('click', ()=>{ const i=Number(b.dataset.idx); const sel = document.querySelector('.ti-img-select[data-idx="'+i+'"]'); const inp = document.querySelector('.ti-img[data-idx="'+i+'"]'); if(sel && inp){ inp.value = sel.value; currentTimeline[i].img = sel.value; } }));
  }

  async function loadEdit(id){
    const r = await fetch('/api/admin/tours');
    const data = await r.json();
    const tours = data.tours || [];
    const t = tours.find(x=>x.id===id); if(!t) return alert('Tur bulunamadı');
    tourForm.id.value = t.id || '';
    tourForm.title.value = t.title || '';
    tourForm.price.value = t.price || '';
    tourForm.duration.value = t.duration || '';
    tourForm.description.value = t.description || '';
    tourForm.hero.value = t.hero || '';
    tourForm.yurtdisi.checked = !!t.yurtdisi;
    // includes (array) and meeting point
    const includesField = tourForm.querySelector('[name="includes"]');
    if(includesField) includesField.value = (t.includes || []).join('\n');
    const meetingField = tourForm.querySelector('[name="meeting"]');
    if(meetingField) meetingField.value = t.meeting || '';
    currentGallery = (t.gallery||[]).slice();
    currentTimeline = (t.timeline||[]).map(x=>Object.assign({},x));
    renderGallery(); renderTimeline();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  loginBtn.addEventListener('click', async ()=>{
    const user = el('#adminUser').value; const pass = el('#adminPass').value;
    const r = await postJson('/api/admin/login', { user, pass });
    if(r && r.ok){ checkAuth(); } else { el('#loginMsg').textContent = (r && r.error) || 'Giriş başarısız'; }
  });

  logoutBtn.addEventListener('click', async ()=>{
    await postJson('/api/admin/logout', {});
    checkAuth();
  });

  newBtn.addEventListener('click', ()=>{
    tourForm.id.value=''; tourForm.reset(); currentGallery=[]; currentTimeline=[]; renderGallery(); renderTimeline();
    window.scrollTo({top:0,behavior:'smooth'});
  });

  tourForm.addEventListener('submit', async (e)=>{
    e.preventDefault(); saveMsg.textContent='';
    const form = new FormData(tourForm);
    const payload = {
      id: form.get('id') || undefined,
      title: form.get('title'),
      price: form.get('price'),
      duration: form.get('duration'),
      description: form.get('description'),
      hero: form.get('hero'),
      includes: (form.get('includes') || '').split('\n').map(s=>s.trim()).filter(Boolean),
      meeting: form.get('meeting') || '',
      gallery: currentGallery.slice(),
      timeline: currentTimeline.slice(),
      yurtdisi: !!form.get('yurtdisi')
    };
    const r = await postJson('/api/admin/tours', payload);
    if(r && r.ok){ saveMsg.textContent='Kaydedildi'; setTimeout(()=>saveMsg.textContent='',2500); renderTours(r.tours||[]); }
    else saveMsg.textContent = (r && r.error) || 'Kaydetme hatası';
  });

  addGalleryUrl.addEventListener('click', ()=>{
    const v = galleryUrl.value && galleryUrl.value.trim(); if(!v) return; currentGallery.push(v); galleryUrl.value=''; renderGallery();
  });

  addTimelineItem.addEventListener('click', ()=>{ currentTimeline.push({ title:'', desc:'', img:'' }); renderTimeline(); });

  uploadBtn.addEventListener('click', async ()=>{
    uploadMsg.textContent='';
    const f = fileInput.files && fileInput.files[0]; if(!f) return alert('Lütfen bir dosya seçin');
    // show progress and disable
    uploadBtn.disabled = true; uploadBtn.textContent = 'Yükleniyor...';
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const dataUrl = reader.result;
        uploadMsg.textContent = 'Sunucuya gönderiliyor...';
        const res = await postJson('/api/admin/upload', { filename: f.name, data: dataUrl });
        if(res && res.ok){ uploadMsg.textContent = 'Yüklendi: ' + res.url;
          currentGallery.push(res.url); renderGallery();
          // clear preview & file input
          fileInput.value = '';
          uploadPreview.style.display = 'none'; uploadPreview.innerHTML = '';
          // if editing an existing tour, auto-save the updated gallery
          const currentId = tourForm.querySelector('[name="id"]').value;
          if(currentId){
            try{
              const saveRes = await postJson('/api/admin/tours', { id: currentId, gallery: currentGallery.slice() });
              if(saveRes && saveRes.ok){ saveMsg.textContent = 'Galeri güncellendi'; setTimeout(()=>saveMsg.textContent='',2000); }
            }catch(e){ console.warn('Auto-save gallery failed', e); }
          }
        } else uploadMsg.textContent = (res && res.error) || 'Yükleme hatası';
      }catch(err){ uploadMsg.textContent = 'Yükleme başarısız'; }
      uploadBtn.disabled = false; uploadBtn.textContent = 'Yükle ve Galeriye Ekle';
    };
    reader.readAsDataURL(f);
  });

  // preview when user selects a file
  fileInput.addEventListener('change', ()=>{
    const f = fileInput.files && fileInput.files[0];
    if(!f){ uploadPreview.style.display='none'; uploadPreview.innerHTML=''; return; }
    const reader = new FileReader();
    reader.onload = ()=>{
      uploadPreview.style.display = 'block';
      uploadPreview.innerHTML = '';
      const img = document.createElement('img'); img.src = reader.result; img.style.maxWidth='220px'; img.style.maxHeight='140px'; img.style.display='block'; img.style.marginBottom='6px'; img.style.borderRadius='6px';
      const info = document.createElement('div'); info.className='small muted'; info.textContent = f.name + ' (' + Math.round(f.size/1024) + ' KB)';
      uploadPreview.appendChild(img); uploadPreview.appendChild(info);
    };
    reader.readAsDataURL(f);
  });

  // initial check
  checkAuth();
});
