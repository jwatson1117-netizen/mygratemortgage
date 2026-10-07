/* ===== My Grate Mortgage — interactions ===== */
(function(){
  'use strict';
  const $ = (s,c)=> (c||document).querySelector(s);
  const $$ = (s,c)=> [...(c||document).querySelectorAll(s)];
  const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
  const fmt2 = n => '$' + n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});

  /* ================================================================
     LEAD CAPTURE — Web3Forms
     1. Go to https://web3forms.com, enter tpelayo@emortgagecapital.com,
        and click "Create Access Key". Check that inbox for the key.
     2. Paste the key between the quotes below and re-deploy.
     Until a key is set, forms still work but just show the success
     message without sending (no leads are captured yet).
  ================================================================ */
  const WEB3FORMS_KEY = 'c87fee06-0bd5-4056-8ee1-e47ea3d1189d';   // ← live access key
  const LEAD_CC = 'jwatson1117@gmail.com';        // second recipient on every lead
  // Backup copy of every lead → Google Sheet (see Google Sheet Setup.md). Paste the Web App URL here.
  const SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbxIYEFkxYGVborW4Zt8AphjkOlNqyTBShJUHKNwLSIddtoCrOuQVIEnQ-qtBkMtRgyH0g/exec';

  function sendToSheet(data){
    if(!SHEET_WEBHOOK) return Promise.resolve(false);
    return fetch(SHEET_WEBHOOK, {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(data)})
      .then(()=>true).catch(()=>false);
  }
  // Leads that failed to send are kept in the browser and retried on the next page load.
  const QKEY = 'mgm_pending_leads';
  function queueLead(data){ try{ const q = JSON.parse(localStorage.getItem(QKEY)||'[]'); q.push(data); localStorage.setItem(QKEY, JSON.stringify(q.slice(-10))); }catch(e){} }
  (async function flushQueue(){
    let q; try{ q = JSON.parse(localStorage.getItem(QKEY)||'[]'); }catch(e){ return; }
    if(!q.length) return;
    const left = [];
    for(const d of q){
      let ok = await sendToSheet(Object.assign({'Retried':'yes'}, d));
      if(WEB3FORMS_KEY){
        try{ const r = await fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(Object.assign({access_key:WEB3FORMS_KEY, subject:'New lead (retried) \u2014 My Grate Mortgage website', cc:LEAD_CC}, d))}); ok = ok || r.ok; }catch(e){}
      }
      if(!ok) left.push(d);
    }
    try{ localStorage.setItem(QKEY, JSON.stringify(left)); }catch(e){}
  })();

  function collectFields(form){
    const data = {};
    $$('.field', form).forEach(f=>{
      const label = f.querySelector('label');
      const input = f.querySelector('input,select,textarea');
      if(label && input && input.value.trim()){
        data[label.textContent.replace(/\s+/g,' ').trim()] = input.value.trim();
      }
    });
    const activeTab = form.querySelector('.toggle-tabs button.on');
    if(activeTab) data['Loan Purpose'] = activeTab.textContent.trim();
    return Object.assign(data, leadContext());
  }

  /* ---- lead context: which page, which button, campaign source ---- */
  const params = new URLSearchParams(location.search);
  ['utm_source','utm_medium','utm_campaign','utm_content','gclid','fbclid'].forEach(k=>{
    if(params.get(k)) try{ sessionStorage.setItem('mgm_'+k, params.get(k)); }catch(e){}
  });
  try{ if(!sessionStorage.getItem('mgm_ref')) sessionStorage.setItem('mgm_ref', document.referrer || 'Direct'); }catch(e){}
  document.addEventListener('click', e=>{
    const el = e.target.closest('a.btn, button.btn, [data-magnet], .nav-phone, a[href^="tel:"], a[href^="mailto:"]');
    if(!el || el.type==='submit') return;
    const label = el.textContent.replace(/\s+/g,' ').trim().slice(0,60);
    const sec = el.closest('section[id], header[id], footer, nav');
    try{ sessionStorage.setItem('mgm_cta', label + (sec ? ' ('+(sec.id||sec.tagName.toLowerCase())+')' : '')); }catch(err){}
  }, true);
  function leadContext(){
    const ctx = { 'Page': document.title, 'Page URL': location.href, 'Submitted': new Date().toLocaleString('en-US') };
    try{
      if(sessionStorage.getItem('mgm_cta')) ctx['Button Clicked'] = sessionStorage.getItem('mgm_cta');
      ctx['Referrer'] = sessionStorage.getItem('mgm_ref') || 'Direct';
      ['utm_source','utm_medium','utm_campaign','utm_content','gclid','fbclid'].forEach(k=>{
        const v = sessionStorage.getItem('mgm_'+k); if(v) ctx[k] = v;
      });
    }catch(e){}
    return ctx;
  }

  /* ---- nav scroll state ---- */
  const nav = $('.nav');
  const onScroll = ()=>{ if(nav) nav.classList.toggle('scrolled', window.scrollY>10); };
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();

  /* ---- mobile menu ---- */
  const mobBtn = $('[data-mob-toggle]');
  function setMob(open){ if(!nav||!mobBtn) return; nav.classList.toggle('mob-open', open); mobBtn.textContent = open ? 'Close' : 'Menu'; mobBtn.setAttribute('aria-expanded', open); }
  if(mobBtn){
    mobBtn.addEventListener('click', ()=> setMob(!nav.classList.contains('mob-open')));
    $$('.nav-links a').forEach(a=> a.addEventListener('click', ()=> setMob(false)));
  }

  /* ---- marquee: duplicate track for seamless loop ---- */
  const track = $('.marquee-track');
  if(track){ track.innerHTML += track.innerHTML; }

  /* ---- purchase/refi toggle tabs ---- */
  $$('.toggle-tabs').forEach(g=>{
    g.addEventListener('click', e=>{
      const b = e.target.closest('button'); if(!b) return;
      $$('button',g).forEach(x=>x.classList.remove('on')); b.classList.add('on');
    });
  });

  /* ---- live calculator ---- */
  const calc = {
    price: $('#c-price'), down: $('#c-down'), rate: $('#c-rate'), term: $('#c-term'),
    tax: $('#c-tax'), ins: $('#c-ins'), hoa: $('#c-hoa')
  };
  const lab = {
    price: $('#l-price'), down: $('#l-down'), rate: $('#l-rate'), term: $('#l-term'),
    tax: $('#l-tax'), ins: $('#l-ins'), hoa: $('#l-hoa'), dpct: $('#l-dpct')
  };
  function runCalc(){
    if(!calc.price) return;
    const price = +calc.price.value, downAmt = +calc.down.value;
    const rate = +calc.rate.value, term = +calc.term.value;
    const taxPct = +calc.tax.value, insYr = +calc.ins.value, hoa = +calc.hoa.value;
    const loan = Math.max(0, price - downAmt);
    const r = rate/100/12, n = term*12;
    const pi = r>0 ? loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1) : loan/n;
    const taxMo = price*(taxPct/100)/12;
    const insMo = insYr/12;
    const dpPct = price>0 ? (downAmt/price*100) : 0;
    // PMI if <20% down on conventional
    const pmiMo = (dpPct < 20) ? loan*0.005/12 : 0;
    const total = pi + taxMo + insMo + hoa + pmiMo;
    // labels
    lab.price.textContent = fmt(price);
    lab.down.textContent = fmt(downAmt);
    lab.dpct.textContent = dpPct.toFixed(0)+'%';
    lab.rate.textContent = rate.toFixed(3)+'%';
    lab.term.textContent = term+' yr';
    lab.tax.textContent = taxPct.toFixed(2)+'%';
    lab.ins.textContent = fmt(insYr)+'/yr';
    lab.hoa.textContent = fmt(hoa)+'/mo';
    // result
    $('#r-total').firstChild.textContent = fmt(total);
    $('#b-pi').textContent = fmt(pi);
    $('#b-tax').textContent = fmt(taxMo);
    $('#b-ins').textContent = fmt(insMo);
    $('#b-hoa').textContent = fmt(hoa);
    const pmiRow = $('#row-pmi');
    if(pmiMo>0){ pmiRow.style.display='flex'; $('#b-pmi').textContent=fmt(pmiMo); }
    else pmiRow.style.display='none';
    $('#r-loan').textContent = fmt(loan);
    // keep down slider within price
    calc.down.max = price;
  }
  Object.values(calc).forEach(el=> el && el.addEventListener('input', runCalc));
  runCalc();

  /* ---- gated lead-magnet modal ---- */
  let pendingGuide = null;
  let pendingPdf = null;
  const modal = $('#mag-modal');
  $$('[data-magnet]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $('#mag-modal-title').textContent = btn.dataset.magnet;
      pendingGuide = btn.dataset.guide || null;
      pendingPdf = btn.dataset.pdf || null;
      modal.classList.add('open');
    });
  });
  function closeModal(){ modal && modal.classList.remove('open'); }
  $$('[data-close-modal]').forEach(b=> b.addEventListener('click', closeModal));
  modal && modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

  /* ---- toast ---- */
  let toastTimer;
  function toast(msg){
    let t = $('#toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast';
      t.innerHTML='<span class="ck">✓</span><span class="tmsg"></span>'; document.body.appendChild(t); }
    $('.tmsg',t).textContent = msg;
    t.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove('show'), 3600);
  }

  /* ---- form validation ---- */
  function validate(form){
    let ok = true;
    $$('[required]', form).forEach(el=>{
      const field = el.closest('.field');
      let valid = !!el.value.trim();
      if(el.type==='email') valid = valid && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
      if(el.type==='tel') valid = valid && el.value.replace(/\D/g,'').length>=10;
      if(field) field.classList.toggle('err', !valid);
      if(!valid) ok = false;
    });
    return ok;
  }
  $$('form[data-validate]').forEach(form=>{
    // spam honeypot: invisible to people, bots fill it in
    const hp = document.createElement('input');
    hp.type='text'; hp.name='company_website'; hp.tabIndex=-1; hp.autocomplete='off'; hp.setAttribute('aria-hidden','true');
    hp.style.cssText='position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    form.appendChild(hp);
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      if(hp.value){ form.reset(); toast(form.dataset.success || 'Thanks! A loan officer will reach out shortly.'); return; }
      if(!validate(form)){ return; }
      const btn = $('button[type=submit]', form);
      const original = btn ? btn.innerHTML : '';
      if(btn){ btn.disabled=true; btn.innerHTML='Sending…'; }

      const inModal = form.closest('.modal-bg');
      const source = (inModal && inModal.id==='mag-modal')
        ? ('Resource Download: ' + (($('#mag-modal-title')||{}).textContent || 'Guide'))
        : (form.classList.contains('contact-form')
            ? (/\/programs\//.test(location.pathname) ? 'Program Consultation: ' + ((($('.lp-hero h1')||{}).textContent||document.title).replace(/\s+/g,' ').trim()) : 'Contact Inquiry')
            : 'Rate Quote Request');

      // Send to Web3Forms when a key is configured; otherwise simulate so the site still works.
      const isMagnet = !!(inModal && inModal.id==='mag-modal');
      let sent = true;
      if(WEB3FORMS_KEY){
        const fields = collectFields(form);
        const base = Object.assign({
          access_key: WEB3FORMS_KEY,
          subject: 'New ' + source + ' \u2014 My Grate Mortgage website',
          from_name: 'My Grate Mortgage Website',
          'Lead Source': source
        }, fields);
        if(LEAD_CC) base.cc = LEAD_CC;
        if(fields['Email']) base.replyto = fields['Email'];

        let done = false;
        // Resource download: send as multipart so the matching guide PDF is
        // attached to the notification email for that resource.
        if(isMagnet && pendingPdf){
          try{
            const pres = await fetch(pendingPdf);
            if(pres.ok){
              const blob = await pres.blob();
              const fd = new FormData();
              Object.keys(base).forEach(k=> fd.append(k, base[k]));
              fd.append('Resource File', pendingPdf.split('/').pop());
              fd.append('attachment', blob, pendingPdf.split('/').pop());
              const res = await fetch('https://api.web3forms.com/submit', { method:'POST', body: fd });
              done = res.ok; sent = res.ok;
            }
          }catch(err){ /* fall back to JSON below */ }
        }
        // Standard JSON submit (also the fallback if an attachment can't be sent).
        if(!done){
          try{
            const res = await fetch('https://api.web3forms.com/submit', {
              method:'POST',
              headers:{'Content-Type':'application/json', Accept:'application/json'},
              body: JSON.stringify(base)
            });
            sent = res.ok;
          }catch(err){ sent = false; }
        }
      }

      const leadData = Object.assign({'Lead Source': source}, collectFields(form));
      const sheetOk = await sendToSheet(leadData);
      if(btn){ btn.disabled=false; btn.innerHTML=original; }

      if(WEB3FORMS_KEY && !sent){
        if(!sheetOk) queueLead(leadData);
        if(!sheetOk){ toast('Something went wrong — please call (323) 313-8761.'); return; }
      }

      if(inModal && inModal.id==='mag-modal'){
        closeModal();
        if(pendingPdf){
          const a=document.createElement('a');
          a.href=pendingPdf; a.download=pendingPdf.split('/').pop();
          a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
        }
        if(pendingGuide){ openArticle(pendingGuide); }
        toast('Sent to your inbox — your guide is downloading now.');
      } else if(inModal){
        closeModal();
        toast('Check your inbox — your download is on the way.');
      } else {
        toast(form.dataset.success || 'Thanks! A loan officer will reach out shortly.');
      }
      form.reset();
      $$('.toggle-tabs button', form).forEach((b,i)=> b.classList.toggle('on', i===0));
    });
    // clear error on input
    $$('input,select,textarea', form).forEach(el=>{
      el.addEventListener('input', ()=> el.closest('.field')&&el.closest('.field').classList.remove('err'));
    });
  });

  /* ---- phone input mask ---- */
  $$('input[type=tel]').forEach(el=>{
    el.addEventListener('input', ()=>{
      let v = el.value.replace(/\D/g,'').slice(0,10);
      if(v.length>6) v=`(${v.slice(0,3)}) ${v.slice(3,6)}-${v.slice(6)}`;
      else if(v.length>3) v=`(${v.slice(0,3)}) ${v.slice(3)}`;
      else if(v.length>0) v=`(${v}`;
      el.value=v;
    });
  });

  /* ---- reveal on scroll (with safe fallbacks) ---- */
  const reveals = $$('.reveal');
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries=>{
      entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
    }, {threshold:.08, rootMargin:'0px 0px -6% 0px'});
    reveals.forEach(el=> io.observe(el));
    // reveal anything already in/near viewport on first paint
    const showInView = ()=> reveals.forEach(el=>{
      const r = el.getBoundingClientRect();
      if(r.top < (window.innerHeight||800)*1.05) el.classList.add('in');
    });
    requestAnimationFrame(showInView);
    setTimeout(showInView, 200);
    // ultimate failsafe: never leave content hidden
    setTimeout(()=> reveals.forEach(el=> el.classList.add('in')), 1400);
  } else {
    reveals.forEach(el=> el.classList.add('in'));
  }

  /* ---- legal modal (privacy / terms / licensing / accessibility) ---- */
  const legalModal = document.getElementById('legal-modal');
  const legalContent = document.getElementById('legal-content');
  const eff = 'Effective June 15, 2026';
  const legalDocs = {
    privacy: `<h3>Privacy Policy</h3><p class="eff">${eff}</p>
      <p>My Grate Mortgage, a DBA of E Mortgage Capital, Inc. (NMLS #1416824) ("we," "us"), respects your privacy. This policy explains what we collect through this website and how we use it.</p>
      <h4>Information we collect</h4>
      <p>When you submit a rate request, contact form, or resource download, we collect the information you provide — such as your name, email, phone number, property and loan details, and credit-score range. We also automatically collect basic technical data (IP address, browser type, pages viewed) through standard web analytics and cookies.</p>
      <h4>How we use it</h4>
      <ul><li>To respond to your inquiry and provide loan products and services you request;</li><li>To contact you by phone, text (SMS), or email about your inquiry — see consent below;</li><li>To send resources you requested and occasional related updates;</li><li>To improve our website and comply with legal and regulatory obligations.</li></ul>
      <h4>Telephone &amp; text (SMS) consent</h4>
      <p>By submitting your phone number you consent to receive calls and text messages (including via automated technology) from us at the number provided, regarding your inquiry and our services. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out of texts at any time.</p>
      <h4>We do not sell your information</h4>
      <p>We do not sell your personal information. We share it only with service providers and our parent company as needed to process your request, or as required by law.</p>
      <h4>Your choices &amp; rights</h4>
      <p>You may request access to, correction of, or deletion of your personal information, and California residents have additional rights under the CCPA/CPRA. To make a request, call (323) 313-8761.</p>
      <h4>Contact</h4>
      <p>My Grate Mortgage · Temecula, California · (323) 313-8761. Parent company: E Mortgage Capital, Inc., 18071 Fitch, Suite 200, Irvine, CA 92614.</p>
      <p class="note">This is a general template provided for your convenience. Please have it reviewed and finalized by E Mortgage Capital's compliance/legal team before relying on it.</p>`,
    terms: `<h3>Terms of Use</h3><p class="eff">${eff}</p>
      <p>By using this website you agree to these terms. The content here is for general informational purposes only and does not constitute financial, legal, or tax advice, nor an offer or commitment to lend.</p>
      <h4>No guarantee of rates or approval</h4>
      <p>Interest rates, payments, and program details shown are illustrative, subject to change without notice, and not guaranteed. Calculator results are estimates only and do not include all costs. Actual terms depend on credit approval, income and asset verification, property appraisal, and applicable program guidelines. Not all applicants will qualify.</p>
      <h4>Licensing</h4>
      <p>My Grate Mortgage is a DBA of E Mortgage Capital, Inc., NMLS #1416824; Branch NMLS #2123147; California DRE #01986350. We are licensed in CA, TX, FL, AZ, GA, NC, TN, WA, NV, and IL, and may only conduct business in states where properly licensed.</p>
      <h4>Intellectual property</h4>
      <p>All content, branding, and materials on this site are owned by or licensed to us and may not be reproduced without permission.</p>
      <h4>Limitation of liability</h4>
      <p>This site is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the site.</p>
      <p class="note">This is a general template. Please have it reviewed and finalized by E Mortgage Capital's compliance/legal team.</p>`,
    licensing: `<h3>Licensing</h3><p class="eff">${eff}</p>
      <p><strong>My Grate Mortgage</strong> is a DBA / branch of <strong>E Mortgage Capital, Inc.</strong></p>
      <ul><li>Company NMLS: <strong>#1416824</strong></li><li>Branch NMLS: <strong>#2123147</strong></li><li>California DRE: <strong>#01986350</strong></li></ul>
      <p>Licensed in: California, Texas, Florida, Arizona, Georgia, North Carolina, Tennessee, Washington, Nevada, and Illinois.</p>
      <p>Verify our licenses at the NMLS Consumer Access website: www.nmlsconsumeraccess.org.</p>
      <p>Not affiliated with or endorsed by the VA, FHA, HUD, USDA, or any government agency. Equal Housing Opportunity / Equal Housing Lender.</p>
      <p class="note">Confirm the complete, current state-license list with compliance before publishing.</p>`,
    accessibility: `<h3>Accessibility Statement</h3><p class="eff">${eff}</p>
      <p>We are committed to making this website accessible to everyone, including people with disabilities, and we strive to meet WCAG 2.1 AA guidelines where reasonably possible.</p>
      <p>If you experience any difficulty accessing any part of this site, or need information in an alternative format, please contact us at (323) 313-8761 and we will work with you to provide the information or service you need.</p>
      <p>We welcome your feedback and will make reasonable efforts to address accessibility barriers.</p>`
  };
  function openLegal(key){
    if(!legalDocs[key]) return;
    legalContent.innerHTML = legalDocs[key];
    legalModal.classList.add('open');
    legalModal.querySelector('.modal-legal').scrollTop = 0;
  }
  function closeLegal(){ legalModal && legalModal.classList.remove('open'); }
  $$('[data-legal]').forEach(a=>{
    a.addEventListener('click', e=>{ e.preventDefault(); openLegal(a.dataset.legal); });
  });
  $$('[data-close-legal]').forEach(b=> b.addEventListener('click', closeLegal));
  legalModal && legalModal.addEventListener('click', e=>{ if(e.target===legalModal) closeLegal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeLegal(); });

  /* ---- article reader ---- */
  const reader = document.getElementById('reader');
  const readerContent = document.getElementById('reader-content');
  const contactCtaHTML = `
    <div class="article-cta"><div class="article-cta-box">
      <h3>Have a question about your situation?</h3>
      <p>A local loan officer will give you a straight answer — no pressure, no obligation.</p>
      <a class="btn btn-gold" href="#contact" data-close-reader>Talk to a Loan Officer →</a>
    </div></div>`;
  const printMastheadHTML = `
    <div class="print-masthead print-only">
      <img src="assets/logo.png" alt="My Grate Mortgage" />
      <div class="pm-meta">
        <div class="pm-name">My Grate Mortgage</div>
        <div class="pm-sub">A branch of E Mortgage Capital, Inc. · Branch NMLS #2123147</div>
      </div>
      <div class="pm-tag">Free Client Resource</div>
    </div>`;
  const printFooterHTML = `
    <div class="print-footer print-only">
      <div class="pf-head">Questions about your situation? Let’s talk — no pressure, no obligation.</div>
      <div class="pf-grid">
        <div><span class="pf-k">Call or text</span><span class="pf-v">(323) 313-8761</span></div>
        <div><span class="pf-k">Online</span><span class="pf-v">MyGrateMortgage.com</span></div>
        <div><span class="pf-k">Your loan officer</span><span class="pf-v">Anthony “Tony” Pelayo · NMLS #1501920</span></div>
      </div>
    </div>`;
  const disclaimerHTML = `
    <div class="article-disclaimer"><p>This article is for general educational purposes only and does not constitute financial, legal, or tax advice, nor an offer or commitment to lend. Programs, guidelines, rates, and terms are subject to change and vary by situation and state; not all applicants will qualify. All loans subject to credit approval. Please consult a licensed loan officer about your specific circumstances. My Grate Mortgage is a DBA of E Mortgage Capital, Inc. · NMLS #1416824 · Branch NMLS #2123147 · Equal Housing Opportunity.</p></div>`;

  function openArticle(id){
    const src = document.querySelector(`[data-article-id="${id}"]`);
    if(!src) return;
    const d = src.dataset;
    readerContent.innerHTML = `
      ${printMastheadHTML}
      <div class="article-hero">
        <span class="article-cat">${d.cat}</span>
        <h1 class="article-title">${d.title}</h1>
        <div class="article-meta">${d.meta}</div>
      </div>
      <div class="article-cover"><img src="${d.cover}" alt="${d.coverAlt||''}" /></div>
      <div class="article-body">${src.innerHTML}</div>
      ${d.authorName ? `<div class="article-byline"><div class="avatar">${d.authorInitials||'MG'}</div><div><div class="nm">${d.authorName}</div><div class="rl">${d.authorRole||''}</div></div></div>` : ''}
      ${contactCtaHTML}
      ${printFooterHTML}
      ${disclaimerHTML}
      <div style="height:50px;"></div>`;
    reader.classList.add('open');
    reader.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('reading');
    // rebind any close triggers inside freshly injected content
    readerContent.querySelectorAll('[data-close-reader]').forEach(el=>{
      el.addEventListener('click', ()=> closeReader());
    });
  }
  function closeReader(){
    reader.classList.remove('open');
    document.body.style.overflow = '';
    document.body.classList.remove('reading');
  }
  const printBtn = document.getElementById('reader-print');
  if(printBtn) printBtn.addEventListener('click', ()=> window.print());
  $$('[data-article]').forEach(el=>{
    el.addEventListener('click', e=>{ e.preventDefault(); openArticle(el.dataset.article); });
  });
  $$('[data-close-reader]').forEach(b=> b.addEventListener('click', closeReader));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeReader(); });

})();
