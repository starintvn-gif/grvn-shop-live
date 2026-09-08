'use strict';
(() => {
  const creatorByName = {
    '이우정': { handle: '@_woojung_lee', url: 'https://www.instagram.com/_woojung_lee/' },
    '박혜훈': { handle: '@hyeho_on', url: 'https://www.instagram.com/hyeho_on/' },
    '김보경': { handle: '@lepontmirabeau', url: 'https://www.instagram.com/lepontmirabeau/' },
    '송지은': { handle: '@jieunisong', url: 'https://www.instagram.com/jieunisong/' },
    '조수아': { handle: '@josooah', url: 'https://www.instagram.com/josooah/' }
  };
  const categoryAliases = {
    fashion: ['패션', 'fashion'],
    beauty: ['뷰티', 'beauty'],
    goods: ['잡화', 'goods'],
    lifestyle: ['라이프스타일', '라이프', 'lifestyle']
  };
  const getName = card => Object.keys(creatorByName).find(name => (card?.textContent || '').includes(name)) || 'GRVN Creator';
  function decorate() {
    document.querySelectorAll('#feed .video-box, #feed .single-video-box').forEach(videoBox => {
      const card = videoBox.closest('article') || videoBox.parentElement;
      const name = getName(card);
      const creator = creatorByName[name] || { handle: '@grvn.official', url: 'https://www.instagram.com/grvn.official/' };
      let identity = videoBox.querySelector('.drop-identity');
      if (!identity) {
        identity = document.createElement('div');
        identity.className = 'drop-identity';
        identity.innerHTML = `<a class="drop-instagram" href="${creator.url}" target="_blank" rel="noopener noreferrer" aria-label="${creator.handle} 인스타그램 열기"><span aria-hidden="true">◎</span>${creator.handle}</a><span class="drop-period">14일 한정판매 · DROP</span>`;
        videoBox.append(identity);
      }
      const title = card?.querySelector('.clip-info-head h3');
      const nextTitle = '영상 속 상품 2개 · 14일 한정 DROP';
      if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
      const eyebrow = card?.querySelector('.clip-info-head .eyebrow');
      const nextEyebrow = 'CURATED SHORT-FORM DROP';
      if (eyebrow && eyebrow.textContent !== nextEyebrow) eyebrow.textContent = nextEyebrow;
      const description = card?.querySelector('.clip-info-head h3 + p');
      const nextDescription = '크리에이터가 직접 소개한 상품 중 GRVN이 선택한 2개만, 14일 동안 특별 혜택으로 공개합니다.';
      if (description && description.textContent !== nextDescription) description.textContent = nextDescription;
      const count = card?.querySelector('.clip-summary-row b');
      if (count && count.textContent !== '2') count.textContent = '2';
    });
  }
  function filter(category) {
    const selected = document.querySelector(`[data-drop-category="${category}"]`);
    const nextCategory = selected?.getAttribute('aria-pressed') === 'true' ? 'all' : category;
    document.querySelectorAll('[data-drop-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dropCategory === nextCategory)));
    document.querySelectorAll('#feed > article').forEach(card => {
      const cardCategory = (card.dataset.category || '').trim().toLowerCase();
      const aliases = categoryAliases[nextCategory] || [];
      card.hidden = nextCategory !== 'all' && !aliases.some(value => cardCategory.includes(value));
    });
  }
  function init() {
    // shop.js는 API 응답을 기다린 뒤 피드를 그립니다. 네트워크가 느리거나
    // 로컬 미리보기에서 API가 지연돼도 data.js 상품을 먼저 보여줍니다.
    if (typeof render === 'function') {
      try { render(); } catch (error) { console.warn('[GRVN] 초기 피드 표시 대기:', error); }
    }
    document.addEventListener('click', event => { const button = event.target.closest('[data-drop-category]'); if (button) filter(button.dataset.dropCategory); });
    const feed = document.getElementById('feed');
    if (feed) new MutationObserver(decorate).observe(feed, { childList: true, subtree: true });
    decorate(); window.setTimeout(decorate, 500); window.setTimeout(decorate, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
