'use strict';

/*
 * HOME V2 only controls homepage presentation.
 * Payment, orders, Supabase and PortOne remain in product-landing.html,
 * product.js and worker.js and are intentionally untouched.
 */

const CAMPAIGN_DEFAULTS = {
  startAt: '2026-09-28T00:00:00+09:00',
  endAt: '2026-10-11T23:59:59+09:00',
  maxCampaigns: 4,
  maxProducts: 3
};

const CAMPAIGN_OVERRIDES = {
  // 인스타그램 주소는 캠페인별로 여기에 입력합니다.
  // woojung_reels: {
  //   instagram: '@instagram_handle',
  //   instagramUrl: 'https://www.instagram.com/instagram_handle/',
  //   startAt: '2026-09-28T00:00:00+09:00',
  //   endAt: '2026-10-11T23:59:59+09:00'
  // }
};

let activeCategory = 'all';
let activeProducts = getStaticProducts();
let campaigns = [];
let heroSlideIndex = 0;
let heroSlideTimer = null;
const affiliateCode = getActiveCode();
localStorage.setItem('stn_last_aff', affiliateCode);

function getStaticProducts() {
  if (Array.isArray(window.STN_PRODUCTS)) return window.STN_PRODUCTS;
  if (typeof STN_PRODUCTS !== 'undefined' && Array.isArray(STN_PRODUCTS)) return STN_PRODUCTS;
  return [];
}

function normalizeCategory(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('뷰티') || text.includes('beauty') || text.includes('코스메틱')) return 'beauty';
  if (text.includes('굿즈') || text.includes('goods') || text.includes('잡화')) return 'goods';
  if (text.includes('라이프') || text.includes('life') || text.includes('리빙')) return 'lifestyle';
  return 'fashion';
}

function normalizeApiProduct(apiProduct, fallback = {}) {
  const slug = apiProduct.slug || apiProduct.id || fallback.slug || fallback.id;
  return {
    ...fallback,
    ...apiProduct,
    id: slug,
    slug,
    name: apiProduct.name || fallback.name || '',
    brand: apiProduct.brand || fallback.brand || '',
    category: apiProduct.category || fallback.category || '패션',
    price: apiProduct.price ?? fallback.price ?? 0,
    originalPrice: apiProduct.original_price ?? fallback.originalPrice ?? 0,
    thumbnail: apiProduct.thumbnail_url || fallback.thumbnail || apiProduct.detail_image_url || fallback.detailImage || '',
    detailImage: apiProduct.detail_image_url || fallback.detailImage || '',
    video: apiProduct.video_url || fallback.video || '',
    defaultInfluencer: apiProduct.default_influencer || fallback.defaultInfluencer || 'GRVN Creator',
    defaultAffiliate: apiProduct.default_affiliate || fallback.defaultAffiliate || affiliateCode,
    defaultClip: apiProduct.default_clip || fallback.defaultClip || slug,
    campaign: apiProduct.campaign || fallback.campaign || 'grvn_shortform_commerce',
    status: apiProduct.status || fallback.status || 'active'
  };
}

async function loadProducts() {
  try {
    const response = await fetch(`${window.GRVN_API_BASE}/api/products?limit=100`);
    if (!response.ok) throw new Error(`products ${response.status}`);
    const result = await response.json();
    if (!result?.success || !Array.isArray(result.products)) return;

    const staticRows = getStaticProducts();
    const bySlug = new Map(staticRows.map(product => [product.slug || product.id, product]));
    result.products.forEach(apiProduct => {
      const slug = apiProduct.slug || apiProduct.id;
      if (!slug) return;
      bySlug.set(slug, normalizeApiProduct(apiProduct, bySlug.get(slug) || {}));
    });
    activeProducts = Array.from(bySlug.values());
  } catch (error) {
    console.warn('[GRVN HOME V2] API unavailable; using data.js fallback.', error);
  }
}

function groupCampaigns() {
  const map = new Map();
  activeProducts
    .filter(product => product && product.status !== 'inactive' && (product.video || product.defaultClip))
    .forEach(product => {
      const clipId = product.defaultClip || product.video || product.id;
      if (!map.has(clipId)) {
        const override = CAMPAIGN_OVERRIDES[clipId] || {};
        map.set(clipId, {
          id: clipId,
          influencer: product.defaultInfluencer || 'GRVN Creator',
          category: normalizeCategory(product.category),
          video: product.video || '',
          affiliate: product.defaultAffiliate || affiliateCode,
          campaign: product.campaign || 'grvn_shortform_commerce',
          startAt: override.startAt || product.startAt || product.start_at || CAMPAIGN_DEFAULTS.startAt,
          endAt: override.endAt || product.endAt || product.end_at || CAMPAIGN_DEFAULTS.endAt,
          instagram: override.instagram || product.instagram || `@${product.defaultInfluencer || 'grvn.official'}`,
          instagramUrl: override.instagramUrl || product.instagramUrl || product.instagram_url || '',
          products: []
        });
      }
      const row = map.get(clipId);
      if (row.products.length < CAMPAIGN_DEFAULTS.maxProducts) row.products.push(product);
    });
  return Array.from(map.values()).slice(0, CAMPAIGN_DEFAULTS.maxCampaigns);
}

function campaignState(campaign, now = new Date()) {
  const start = new Date(campaign.startAt);
  const end = new Date(campaign.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { visible: false, label: '' };
  if (now < start) return { visible: true, upcoming: true, label: '' };
  if (now > end) return { visible: false, ended: true, label: 'ENDED' };
  const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  return { visible: true, live: true, label: `D-${String(days).padStart(2, '0')}` };
}

function imageFor(product) {
  return product.thumbnail || product.detailImage || 'assets/grvn-shop-og-1200x630.jpg';
}

function detailPageImageFor(product) {
  return product.detailImage || product.thumbnail || 'assets/grvn-shop-og-1200x630.jpg';
}

function stillImageFor(product) {
  const slug = product.slug || product.id;
  return product.stillImage || product.still_image || product.image || `assets/${slug}.jpg`;
}

function productUrl(product, campaign) {
  const params = new URLSearchParams({
    product: product.slug || product.id,
    aff: campaign.affiliate || affiliateCode,
    clip: campaign.id,
    utm_source: 'grvn_home',
    utm_medium: 'shortform',
    utm_campaign: campaign.campaign,
    utm_content: `${String(campaign.affiliate || affiliateCode).toLowerCase()}_${campaign.id}`
  });
  return `product-landing-v2.html?${params.toString()}`;
}

function openProduct(product, campaign) {
  if (!product || !campaign) return;
  stnLog({ type: 'click', event: 'home_v2_product_click', productId: product.slug || product.id, productName: product.name, code: campaign.affiliate || affiliateCode, amount: 0, qty: 0, commission: 0, clip: campaign.id });
  window.location.href = productUrl(product, campaign);
}

function productTile(product, campaign) {
  return `<button class="campaign-product" type="button" data-product="${product.slug || product.id}" data-clip="${campaign.id}">
    <img src="${detailPageImageFor(product)}" alt="${product.name} 상세페이지 이미지" loading="lazy" decoding="async">
    <span class="product-copy"><b>${product.name}</b><small>${product.desc || `${product.brand || 'GRVN'} 큐레이션 제품`}</small><strong>${money(product.price)}</strong><em>바로 구매</em></span>
  </button>`;
}

function campaignCard(campaign) {
  const state = campaignState(campaign);
  const products = campaign.products.map(product => productTile(product, campaign)).join('');
  const instagram = campaign.instagramUrl
    ? `<a class="creator-handle" href="${campaign.instagramUrl}" target="_blank" rel="noopener" aria-label="${campaign.instagram} 인스타그램">${campaign.instagram}</a>`
    : `<span class="creator-handle">${campaign.instagram}</span>`;
  return `<article class="campaign-card" data-campaign-category="${campaign.category}">
    <div class="campaign-video">
      <video src="${campaign.video}" muted loop playsinline controls preload="metadata" aria-label="${campaign.influencer} 숏폼"></video>
      ${instagram}
      ${state.label ? `<span class="deadline">${state.label}</span>` : ''}
      <span class="limited-label">14일 한정 판매</span>
    </div>
    <div class="campaign-products">${products}</div>
  </article>`;
}

function visibleCampaigns() {
  return campaigns.filter(campaign => {
    const state = campaignState(campaign);
    return state.visible && (activeCategory === 'all' || campaign.category === activeCategory);
  });
}

function renderCampaigns() {
  const grid = document.getElementById('campaignGrid');
  const empty = document.getElementById('emptyState');
  const rows = visibleCampaigns();
  grid.innerHTML = rows.map(campaignCard).join('');
  empty.hidden = rows.length > 0;
  renderFeatureGrid(rows[0]);
  renderHeroCarousel(rows);
}

function heroStillRows(rows) {
  const source = rows.length ? rows : campaigns;
  const stills = [];
  source.forEach(campaign => campaign.products.forEach(product => {
    if (stills.length < 6) stills.push({ campaign, product });
  }));
  return stills;
}

function showHeroSlide(index, stills) {
  if (!stills.length) return;
  heroSlideIndex = (index + stills.length) % stills.length;
  document.querySelectorAll('.hero-slide').forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === heroSlideIndex));
  document.querySelectorAll('.hero-dot').forEach((dot, dotIndex) => dot.setAttribute('aria-pressed', String(dotIndex === heroSlideIndex)));
  document.getElementById('heroCreatorName').textContent = `@${stills[heroSlideIndex].campaign.influencer}`;
  document.getElementById('heroSlideCount').textContent = `${String(heroSlideIndex + 1).padStart(2, '0')} / ${String(stills.length).padStart(2, '0')}`;
}

function renderHeroCarousel(rows) {
  const stills = heroStillRows(rows);
  const slides = document.getElementById('heroSlides');
  const dots = document.getElementById('heroDots');
  slides.innerHTML = stills.map(({ product }, index) => `<img class="hero-slide${index === 0 ? ' is-active' : ''}" src="${stillImageFor(product)}" onerror="this.onerror=null;this.src='${detailPageImageFor(product)}'" alt="${product.defaultInfluencer || 'GRVN 크리에이터'} 스틸컷 ${index + 1}" decoding="async">`).join('');
  dots.innerHTML = stills.map((_, index) => `<button class="hero-dot" type="button" data-hero-index="${index}" aria-label="스틸컷 ${index + 1}" aria-pressed="${index === 0}"></button>`).join('');
  heroSlideIndex = 0;
  showHeroSlide(0, stills);
  clearInterval(heroSlideTimer);
  if (stills.length > 1) heroSlideTimer = setInterval(() => showHeroSlide(heroSlideIndex + 1, stills), 3500);
  document.querySelectorAll('[data-hero-direction]').forEach(button => button.onclick = () => showHeroSlide(heroSlideIndex + Number(button.dataset.heroDirection), stills));
  document.querySelectorAll('[data-hero-index]').forEach(button => button.onclick = () => showHeroSlide(Number(button.dataset.heroIndex), stills));
  document.getElementById('heroProductButton').onclick = () => openProduct(stills[heroSlideIndex]?.product, stills[heroSlideIndex]?.campaign);
}

function renderFeatureGrid(campaign) {
  const section = document.getElementById('featureGrid');
  if (!campaign) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const state = campaignState(campaign);
  const mainProduct = campaign.products[0];
  const limitedText = state.label ? `${state.label} · 14일 한정` : '14일 한정';
  document.getElementById('featuredMedia').style.backgroundImage = `url("${detailPageImageFor(mainProduct)}")`;
  document.getElementById('featuredCreator').textContent = `@${campaign.influencer}`;
  document.getElementById('featuredDeadline').textContent = limitedText;
  document.getElementById('featuredProductName').textContent = mainProduct.name;
  document.getElementById('featuredProductDesc').textContent = mainProduct.desc || `${mainProduct.brand || 'GRVN'}의 이번 기획전 메인 제품입니다.`;
  document.getElementById('featuredProductPrice').textContent = money(mainProduct.price);
  document.getElementById('featuredButton').onclick = () => openProduct(mainProduct, campaign);
  document.getElementById('creatorName').textContent = `@${campaign.influencer}`;
  document.getElementById('creatorDeadline').textContent = limitedText;
  document.getElementById('creatorProducts').innerHTML = campaign.products.map(product => productTile(product, campaign)).join('');
}

function selectCategory(category) {
  activeCategory = category;
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  renderCampaigns();
  document.getElementById('liveCampaigns').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initGrandOpenPopup() {
  const popup = document.getElementById('grandOpenPopup');
  const closeButton = document.getElementById('grandOpenClose');
  const todayClose = document.getElementById('grandOpenTodayClose');
  if (!popup || !closeButton) return;
  const dateKey = 'grvn_grand_open_popup_closed_date';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  if (localStorage.getItem(dateKey) !== today) {
    popup.classList.add('is-active');
    popup.setAttribute('aria-hidden', 'false');
  }
  const close = () => {
    if (todayClose?.checked) localStorage.setItem(dateKey, today);
    popup.classList.remove('is-active');
    popup.setAttribute('aria-hidden', 'true');
  };
  closeButton.addEventListener('click', close);
  popup.querySelectorAll('[data-popup-close]').forEach(node => node.addEventListener('click', close));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
}

document.addEventListener('click', event => {
  const filter = event.target.closest('[data-category]');
  if (filter) {
    selectCategory(filter.dataset.category);
    return;
  }
  const productButton = event.target.closest('[data-product]');
  if (productButton) {
    const campaign = campaigns.find(row => row.id === productButton.dataset.clip);
    const product = campaign?.products.find(row => (row.slug || row.id) === productButton.dataset.product);
    openProduct(product, campaign);
    return;
  }
  const campaignButton = event.target.closest('[data-campaign-open]');
  if (campaignButton) {
    const campaign = campaigns.find(row => row.id === campaignButton.dataset.campaignOpen);
    openProduct(campaign?.products[0], campaign);
  }
});

async function initHome() {
  await loadProducts();
  campaigns = groupCampaigns();
  renderCampaigns();
  initGrandOpenPopup();
}

initHome();
