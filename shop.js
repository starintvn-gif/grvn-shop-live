const feed = document.getElementById('feed');
const search = document.getElementById('search');
let active = 'all';
const currentCode = getActiveCode();
localStorage.setItem('stn_last_aff', currentCode);

function relatedProducts(product){
  const same = STN_PRODUCTS.filter(item => item.id !== product.id && item.category === product.category);
  const others = STN_PRODUCTS.filter(item => item.id !== product.id && item.category !== product.category);
  return [product, ...same, ...others].slice(0, 2);
}

function pipCard(item, parentId){
  return `<button class="pip-item" type="button" data-open="${item.id}" aria-label="${item.name} 상품 랜딩 새창 열기">
    <span class="pip-thumb" aria-hidden="true">${item.category}</span>
    <span class="pip-copy"><b>${item.brand}</b><strong>${item.name}</strong><em>${money(item.price)}</em></span>
  </button>`;
}

function productCard(p, i){
  const pips = relatedProducts(p).map(item => pipCard(item, p.id)).join('');
  return `<article class="clip-card" data-category="${p.category}">
    <div class="video-box">
      <span class="clip-badge">혜훈 · ${p.category} 추천</span>
      <video src="${p.video}" ${i===0?'autoplay':''} muted loop playsinline controls aria-label="${p.name} 숏폼 영상"></video>
      <div class="pip-products" aria-label="관련 상품 빠른 보기">
        <div class="pip-head"><span>${p.brand}</span><b>관련 제품</b></div>
        <div class="pip-list">${pips}</div>
      </div>
      <button class="sound-chip" type="button" aria-label="영상 음소거 전환">▶ 00:02</button>
    </div>
    <div class="clip-info">
      <h3>${p.name}</h3>
      <p>${p.brand} · ${p.desc}</p>
      <div class="mini-product">
        <span>${p.category}</span>
        <div><b>${p.brand}</b><strong>${money(p.price)}</strong></div>
      </div>
      <div class="card-actions">
        <button class="btn dark" type="button" data-share="${p.id}">공유 링크</button>
        <button class="btn primary" type="button" data-open="${p.id}">제품 보기 / 구매</button>
      </div>
    </div>
  </article>`;
}

function render(){
  const q = (search?.value || '').trim().toLowerCase();
  const rows = STN_PRODUCTS.filter(p => (active==='all' || p.category===active) && `${p.name} ${p.brand} ${p.desc} ${p.category}`.toLowerCase().includes(q));
  feed.innerHTML = rows.length ? rows.map(productCard).join('') : '<p class="notice">검색 결과가 없습니다.</p>';
}

function openProduct(id){
  stnLog({type:'click',event:'product_detail_click',productId:id,productName:getProduct(id).name,code:currentCode,amount:0,qty:0,commission:0});
  const url = `product-landing.html?product=${encodeURIComponent(id)}&aff=${encodeURIComponent(currentCode)}&clip=stn-shortform`;
  window.open(url, '_blank', 'noopener,noreferrer,width=1180,height=960');
}
function copyProductLink(id){
  const url = `${location.origin}${location.pathname.replace(/index\.html$/,'')}product-landing.html?product=${encodeURIComponent(id)}&aff=${encodeURIComponent(currentCode)}&clip=stn-shortform`;
  navigator.clipboard?.writeText(url).then(()=>toast('공유 링크가 복사되었습니다.')).catch(()=>prompt('링크를 복사하세요', url));
}

document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected','false'));
  btn.setAttribute('aria-selected','true'); active=btn.dataset.cat; render();
}));
search?.addEventListener('input', render);
feed.addEventListener('click', e=>{
  const open = e.target.closest('[data-open]');
  const share = e.target.closest('[data-share]');
  if(open) openProduct(open.dataset.open);
  if(share) copyProductLink(share.dataset.share);
});
render();
