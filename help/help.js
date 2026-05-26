(function(){
  const articles = (window.POSTIQ_HELP_ARTICLES || []).slice();
  const bySlug = new Map(articles.map(a => [a.slug, a]));

  const homeEl = document.getElementById('helpHome');
  const articleEl = document.getElementById('articleView');
  const gridEl = document.getElementById('articlesGrid');
  const recommendedEl = document.getElementById('recommendedWrap');
  const supportBackdropEl = document.getElementById('supportModalBackdrop');
  const openSupportBtnEl = document.getElementById('openSupportModal');
  const closeSupportBtnEl = document.getElementById('closeSupportModal');

  function escapeHtml(value){
    return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  }

  function articleCard(article, opts){
    const showCategory = !!opts.showCategory;
    const featured = !!opts.featured;
    const categoryHtml = showCategory ? `<p class="article-category">${article.category}</p>` : '';
    const featuredClass = featured ? ' featured' : '';
    return `<a class="article-card${featuredClass}" href="?article=${encodeURIComponent(article.slug)}" data-open-article="${article.slug}" aria-label="Read guide: ${escapeHtml(article.title)}">${categoryHtml}<h3 class="article-title">${article.title}</h3><p class="article-summary">${article.summary}</p><span class="read-link">Read guide →</span></a>`;
  }

  function renderRecommended(){
    const featured = articles.filter(a => a.featured === true).slice(0, 3);
    if (!featured.length) {
      recommendedEl.innerHTML = '';
      return new Set();
    }
    recommendedEl.innerHTML = `<div class="section-head">Start here</div><div class="featured-grid">${featured.map(item => articleCard(item, { featured: true, showCategory: false })).join('')}</div>`;
    return new Set(featured.map(f => f.slug));
  }

  function renderHome(){
    const hiddenSlugs = renderRecommended();
    const baseList = articles.filter(a => !hiddenSlugs.has(a.slug));
    gridEl.innerHTML = `<section><h2 class="section-head">All guides</h2><div class="articles-grid">${baseList.map(a => articleCard(a, { showCategory: false })).join('')}</div></section>`;
  }

  function renderArticle(slug){
    const article = bySlug.get(slug);
    if (!article){ articleEl.hidden = true; homeEl.hidden = false; renderHome(); return; }
    const related = (article.relatedArticles || []).map(rs => bySlug.get(rs)).filter(Boolean);
    articleEl.innerHTML = `<h2>${article.title}</h2><p class="meta">${article.category}</p><div class="article-body">${article.body}</div>
      <div class="related-list">${related.length ? `<h3>Related guides</h3>${related.map(r => `<a href="?article=${encodeURIComponent(r.slug)}" data-open-article="${r.slug}">${r.title}</a>`).join('')}` : ''}</div>
      <div class="article-nav"><a class="btn-link" href="/help/" data-open-home="true">← Back to all guides</a><a class="btn-link" href="/app.html">Back to PostIQ</a></div>`;
    homeEl.hidden = true;
    articleEl.hidden = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function applyRoute(){
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('article');
    if (slug) renderArticle(slug); else { articleEl.hidden = true; homeEl.hidden = false; renderHome(); }
  }

  function openSupportModal(){ supportBackdropEl.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeSupportModal(){ supportBackdropEl.hidden = true; document.body.style.overflow = ''; }

  document.addEventListener('click', (e) => {
    const articleLink = e.target.closest('[data-open-article]');
    if (articleLink){ e.preventDefault(); const slug = articleLink.dataset.openArticle; history.pushState({}, '', `?article=${encodeURIComponent(slug)}`); renderArticle(slug); return; }
    const homeLink = e.target.closest('[data-open-home]');
    if (homeLink){ e.preventDefault(); history.pushState({}, '', '/help/'); applyRoute(); return; }
    if (e.target === supportBackdropEl) closeSupportModal();
  });

  openSupportBtnEl.addEventListener('click', openSupportModal);
  closeSupportBtnEl.addEventListener('click', closeSupportModal);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !supportBackdropEl.hidden) closeSupportModal(); });
  window.addEventListener('popstate', applyRoute);

  applyRoute();
})();
