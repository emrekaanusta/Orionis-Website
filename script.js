document.addEventListener('DOMContentLoaded', ()=>{
  // Header scroll behavior: add a class when the page is scrolled
  const header = document.querySelector('.site-header');
  function onScrollHeader(){
    if(window.scrollY > 20) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, {passive:true});

  const modal = document.getElementById('bookingModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalPrice = document.getElementById('modalPrice');
  const closeBtn = document.querySelector('.modal-close');
  const form = document.getElementById('bookingForm');

  // Category filtering
  const filterBtns = document.querySelectorAll('.filter-btn');
  const tours = document.querySelectorAll('.tour-card');

  function applyFilter(filter){
    tours.forEach(t => {
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
        const json = await res.json();
        if(res.ok){
          // Show success message and any preview URLs (Ethereal) returned by server
          let msg = json.message || 'Kayıt başarılı. Teşekkürler!';
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
          newsletterMsg.textContent = json.error || 'Bir hata oluştu. Lütfen tekrar deneyin.';
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
    // For now just show a friendly confirmation — integrate backend later
    alert(`${modalTitle.textContent} için rezervasyon isteğiniz alındı. Teşekkürler, ${data.get('name')}!`);
    form.reset();
    closeModal();
  });
});
