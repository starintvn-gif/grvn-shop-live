'use strict';
(() => {
  const instagramByName = { '이우정': '@이우정 · Instagram', '박혜훈': '@박혜훈 · Instagram', '김보경': '@김보경 · Instagram', '송지은': '@송지은 · Instagram', '조수아': '@조수아 · Instagram' };
  const categoryKeywords = { all: [], fashion: ['원피스', '팬츠', '스커트', '블라우스', '니트', '베스트', '아우터', '재킷', '자켓', '의류', '패션'], beauty: ['뷰티', '코스메틱', '스킨', '메이크업', '향수'], goods: ['잡화', '가방', '슈즈', '주얼리', '쥬얼리', '액세서리', '굿즈'], lifestyle: ['라이프', '리빙', '홈', '여행', '공연', '클래스'] };
  const getName = card => Object.keys(instagramByName).find(name => (card?.textContent || '').includes(name)) || 'GRVN Creator';
  function decorate() {
    document.querySelectorAll('#feed .video-box, #feed .single-video-box').forEach(videoBox => {
      const card = videoBox.closest('article') || videoBox.parentElement;
      const name = getName(card);
      let identity = videoBox.querySelector('.drop-identity');
      if (!identity) {
        identity = document.createElement('div');
        identity.className = 'drop-identity';
        identity.innerHTML = `<span class="drop-instagram">${instagramByName[name] || '@grvn.official'}</span><span class="drop-period">14 DAYS ONLY</span>`;
        videoBox.append(identity);
      }
      const title = card?.querySelector('.clip-info-head h3');
      const nextTitle = `${name}의 14일 한정 DROP`;
      if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
      const count = card?.querySelector('.clip-summary-row b');
      if (count && count.textContent !== '2') count.textContent = '2';
    });
  }
  function filter(category) {
    document.querySelectorAll('[data-drop-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dropCategory === category)));
    const words = categoryKeywords[category] || [];
    document.querySelectorAll('#feed > article').forEach(card => { card.hidden = words.length > 0 && !words.some(word => (card.textContent || '').includes(word)); });
  }
  function init() {
    document.addEventListener('click', event => { const button = event.target.closest('[data-drop-category]'); if (button) filter(button.dataset.dropCategory); });
    const feed = document.getElementById('feed');
    if (feed) new MutationObserver(decorate).observe(feed, { childList: true, subtree: true });
    decorate(); window.setTimeout(decorate, 500); window.setTimeout(decorate, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
