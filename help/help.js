(function(){
  const articles = (window.POSTIQ_HELP_ARTICLES || []).slice();
  const bySlug = new Map(articles.map(a => [a.slug, a]));

  const homeEl = document.getElementById('helpHome');
  const articleEl = document.getElementById('articleView');
  const gridEl = document.getElementById('articlesGrid');
  const recommendedEl = document.getElementById('recommendedWrap');

  const supportModal = document.getElementById('supportModal');
  const openSupportBtn = document.getElementById('openSupportBtn');
  const closeSupportBtn = document.getElementById('closeSupportBtn');

  function escapeHtml(value){
    return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  }

  function articleCard(article, opts){
    const featuredClass = opts.featured ? ' featured' : '';
    return `<a class="article-card${featuredClass}" href="?article=${encodeURIComponent(article.slug)}" data-open-article="${article.slug}" aria-label="Read guide: ${escapeHtml(article.title)}"><h3 class="article-title">${article.title}</h3><p class="article-summary">${article.summary}</p><span class="read-link">Read guide →</span></a>`;
  }

  function renderRecommended(){
    const featured = articles.filter(a => a.featured === true).slice(0, 3);
    recommendedEl.innerHTML = featured.length
      ? `<div class="section-head">Start here</div><div class="featured-grid">${featured.map(item => articleCard(item, { featured: true })).join('')}</div>`
      : '';
    return new Set(featured.map(f => f.slug));
  }

  function renderHome(){
    const hiddenSlugs = renderRecommended();
    const baseList = articles.filter(a => !hiddenSlugs.has(a.slug));
    gridEl.innerHTML = `<section><h2 class="section-head">All guides</h2><div class="articles-grid">${baseList.map(a => articleCard(a, { featured: false })).join('')}</div></section>`;
  }

  function renderArticle(slug){
    const article = bySlug.get(slug);
    if (!article){ articleEl.hidden = true; homeEl.hidden = false; renderHome(); return; }
    const related = (article.relatedArticles || []).map(rs => bySlug.get(rs)).filter(Boolean);
    articleEl.innerHTML = `<h2>${article.title}</h2><p class="meta">${article.category}</p><div class="article-body">${article.body}</div><div class="related-list">${related.length ? `<h3>Related guides</h3>${related.map(r => `<a href="?article=${encodeURIComponent(r.slug)}" data-open-article="${r.slug}">${r.title}</a>`).join('')}` : ''}</div><div class="article-nav"><a class="btn-link" href="/help/" data-open-home="true">← Back to all guides</a><a class="btn-link" href="/app.html">Back to PostIQ</a></div>`;
    homeEl.hidden = true;
    articleEl.hidden = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function applyRoute(){
    const slug = new URLSearchParams(window.location.search).get('article');
    if (slug) renderArticle(slug); else { articleEl.hidden = true; homeEl.hidden = false; renderHome(); }
  }

  function openSupportModal() {
    if (!supportModal) return;
    supportModal.classList.remove('hidden');
    supportModal.classList.add('is-open');
    supportModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeSupportBtn?.focus();
  }

  function closeSupportModal() {
    if (!supportModal) return;
    supportModal.classList.add('hidden');
    supportModal.classList.remove('is-open');
    supportModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  openSupportBtn?.addEventListener('click', openSupportModal);
  closeSupportBtn?.addEventListener('click', closeSupportModal);

  supportModal?.addEventListener('click', function(event) {
    if (event.target === supportModal) closeSupportModal();
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && supportModal && supportModal.classList.contains('is-open')) closeSupportModal();
  });

  document.addEventListener('click', (e) => {
    const articleLink = e.target.closest('[data-open-article]');
    if (articleLink){ e.preventDefault(); history.pushState({}, '', `?article=${encodeURIComponent(articleLink.dataset.openArticle)}`); renderArticle(articleLink.dataset.openArticle); return; }
    const homeLink = e.target.closest('[data-open-home]');
    if (homeLink){ e.preventDefault(); history.pushState({}, '', '/help/'); applyRoute(); }
  });

  window.addEventListener('popstate', applyRoute);
  applyRoute();
})();
