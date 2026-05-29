'use strict';

const feed = document.getElementById('feed');
const search = document.getElementById('search');
let activeInfluencer = 'all';
let activeType = 'all';
const currentCode = getActiveCode();
localStorage.setItem('stn_last_aff', currentCode);

function productType(name){
  const n = String(name || '');
  if (n.includes('원피스')) return '원피스';
  if (n.includes('블라우스')) return '블라우스';
  if (n.includes('팬츠') || n.includes('데님')) return '팬츠';
  if (n.includes('스커트')) return '스커트';
  if (n.includes('자켓') || n.includes('점퍼')) return '아우터';
  if (n.includes('니트') || n.includes('베스트')) return '니트/베스트';
  if (n.includes('세트')) return '세트';
  return '기타';
}

function buildClipGroups(){
  const map = new Map();
  STN_PRODUCTS.forEach(product => {
    const clipId = product.defaultClip || product.video || product.defaultInfluencer || 'stn-shortform';
    if (!map.has(clipId)) {
      map.set(clipId, {
        id: clipId,
        influencer: product.defaultInfluencer || '인플루언서',
        brand: product.brand,
        category: product.category,
        video: product.video,
        campaign: product.campaign || 'grvn_shortform_commerce',
        affiliate: product.defaultAffiliate || currentCode,
        products: []
      });
    }
    map.get(clipId).products.push({...product, productType: productType(product.name)});
  });
  return Array.from(map.values());
}

function getFilteredClips(){
  const q = (search?.value || '').trim().toLowerCase();
  return buildClipGroups().filter(clip => {
    const matchesInfluencer = activeInfluencer === 'all' || clip.influencer === activeInfluencer;
    const matchesType = activeType === 'all' || clip.products.some(p => p.productType === activeType);
    const blob = [clip.influencer, clip.brand, clip.category, clip.products.map(p => `${p.name} ${p.productType} ${p.desc}`).join(' ')].join(' ').toLowerCase();
    const matchesSearch = !q || blob.includes(q);
    return matchesInfluencer && matchesType && matchesSearch;
  });
}

function openProduct(id, clipId){
  const item = getProduct(id);
  stnLog({type:'click',event:'product_detail_click',productId:id,productName:item.name,code:currentCode,amount:0,qty:0,commission:0,clip:clipId || item.defaultClip || 'stn-shortform'});
  const params = new URLSearchParams({
    product:id,
    aff:currentCode,
    clip:clipId || item.defaultClip || 'stn-shortform',
    utm_source:'instagram',
    utm_medium:'affiliate',
    utm_campaign:item.campaign || 'grvn_shortform_commerce',
    utm_content:`${currentCode.toLowerCase()}_${clipId || item.defaultClip || 'clip'}`
  });
  const url = `product-landing.html?${params.toString()}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function copyProductLink(id, clipId){
  const item = getProduct(id);
  const params = new URLSearchParams({
    product:id,
    aff:currentCode,
    clip:clipId || item.defaultClip || 'stn-shortform',
    utm_source:'instagram',
    utm_medium:'affiliate',
    utm_campaign:item.campaign || 'grvn_shortform_commerce',
    utm_content:`${currentCode.toLowerCase()}_${clipId || item.defaultClip || 'clip'}`
  });
  const url = `${location.origin}${location.pathname.replace(/index\.html$/,'')}product-landing.html?${params.toString()}`;
  navigator.clipboard?.writeText(url).then(()=>toast('상품 랜딩 링크가 복사되었습니다.')).catch(()=>prompt('링크를 복사하세요', url));
}

function productPip(item, clipId, idx){
  return `<button class="look-product" type="button" data-open="${item.id}" data-clip="${clipId}" aria-label="${item.name} 개별 상세페이지 새창 열기">
    <span class="look-no">LOOK ${String(idx + 1).padStart(2, '0')}</span>
    <span class="look-meta"><b>${item.productType} · ${item.sourceProductCode || '원본코드'}</b><strong>${item.name}</strong><em>${money(item.price)}${item.benefitRate ? ` · ${item.benefitRate}% 혜택` : ''}</em><small>개별 상세페이지 열기</small></span>
  </button>`;
}

function clipCard(clip, i){
  const productCount = clip.products.length;
  const minPrice = Math.min(...clip.products.map(p => Number(p.price) || 0));
  const maxBenefit = Math.max(...clip.products.map(p => Number(p.benefitRate) || 0));
  const products = clip.products.map((p, idx) => productPip(p, clip.id, idx)).join('');
  const typeBadges = [...new Set(clip.products.map(p => p.productType))].map(t => `<span>${t}</span>`).join('');
  return `<article class="clip-card influencer-clip-card" data-influencer="${clip.influencer}" data-category="${clip.category}">
    <div class="clip-media-row">
      <div class="video-box single-video-box">
        <span class="clip-badge">${clip.influencer} · ${productCount}착장 in 1 video</span>
        <video src="${clip.video}" ${i===0?'autoplay':''} muted loop playsinline controls preload="metadata" onerror="this.insertAdjacentHTML('afterend','<p class=&quot;notice video-notice&quot;>영상 파일을 불러오지 못했습니다. assets 경로와 H.264 코덱을 확인하세요.</p>')" aria-label="${clip.influencer} SALON DE SEOUL 숏폼 영상"></video>
        <button class="sound-chip" type="button" aria-label="영상 음소거 전환">▶ VIDEO</button>
      </div>
      <div class="clip-product-panel">
        <div class="clip-info-head">
          <p class="eyebrow">INFLUENCER LOOKBOOK</p>
          <h3>${clip.influencer} 영상 1개 안의 착장 상품</h3>
          <p>${clip.influencer} 인플루언서가 편집한 하나의 영상 안에 포함된 ${productCount}개 의상을 PIP 상품 버튼으로 연결했습니다. 의상별 상세페이지는 새창으로 열립니다.</p>
        </div>
        <div class="look-badges" aria-label="상품군">${typeBadges}</div>
        <div class="clip-summary-row">
          <div><b>${productCount}</b><span>영상 내 상품</span></div>
          <div><b>${money(minPrice)}</b><span>최저 혜택가</span></div>
          <div><b>${maxBenefit}%</b><span>최대 혜택률</span></div>
        </div>
        <div class="look-product-list" aria-label="영상 속 착장 상품 목록">${products}</div>
        <div class="card-actions clip-actions">
          <button class="btn dark" type="button" data-copy-clip="${clip.id}">영상 캠페인 링크 복사</button>
          <button class="btn primary" type="button" data-open="${clip.products[0].id}" data-clip="${clip.id}">첫 상품 보기</button>
        </div>
      </div>
    </div>
  </article>`;
}

function renderFilterTabs(){
  const influencerTabs = document.getElementById('influencerTabs');
  const typeTabs = document.getElementById('typeTabs');
  if (!influencerTabs || !typeTabs) return;
  const clips = buildClipGroups();
  const influencers = ['all', ...clips.map(c => c.influencer)];
  const types = ['all', ...new Set(STN_PRODUCTS.map(p => productType(p.name)))];
  const label = v => v === 'all' ? '전체' : v;
  influencerTabs.innerHTML = influencers.map(v => `<button class="tab" type="button" data-filter-kind="influencer" data-value="${v}" aria-selected="${activeInfluencer === v}">${label(v)}</button>`).join('');
  typeTabs.innerHTML = types.map(v => `<button class="tab small-tab" type="button" data-filter-kind="type" data-value="${v}" aria-selected="${activeType === v}">${label(v)}</button>`).join('');
}

function render(){
  renderFilterTabs();
  const rows = getFilteredClips();
  feed.innerHTML = rows.length ? rows.map(clipCard).join('') : '<p class="notice">검색 결과가 없습니다.</p>';
}

function copyClipLink(clipId){
  const clip = buildClipGroups().find(c => c.id === clipId);
  const params = new URLSearchParams({
    aff:currentCode,
    clip:clipId,
    utm_source:'instagram',
    utm_medium:'affiliate',
    utm_campaign:(clip && clip.campaign) || 'grvn_shortform_commerce',
    utm_content:`${currentCode.toLowerCase()}_${clipId}`
  });
  const url = `${location.origin}${location.pathname.replace(/index\.html$/,'')}index.html?${params.toString()}`;
  navigator.clipboard?.writeText(url).then(()=>toast('영상 캠페인 링크가 복사되었습니다.')).catch(()=>prompt('링크를 복사하세요', url));
}

document.addEventListener('click', e=>{
  const tab = e.target.closest('[data-filter-kind]');
  if(tab){
    if(tab.dataset.filterKind === 'influencer') activeInfluencer = tab.dataset.value;
    if(tab.dataset.filterKind === 'type') activeType = tab.dataset.value;
    render();
    return;
  }
  const open = e.target.closest('[data-open]');
  const share = e.target.closest('[data-share]');
  const copyClip = e.target.closest('[data-copy-clip]');
  if(open) openProduct(open.dataset.open, open.dataset.clip);
  if(share) copyProductLink(share.dataset.share, share.dataset.clip);
  if(copyClip) copyClipLink(copyClip.dataset.copyClip);
});
search?.addEventListener('input', render);

const clipFromUrl = qs('clip');
if (clipFromUrl) {
  const found = buildClipGroups().find(c => c.id === clipFromUrl);
  if (found) activeInfluencer = found.influencer;
}
render();
