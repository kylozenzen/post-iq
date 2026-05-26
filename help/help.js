(function(){
  const articles = (window.POSTIQ_HELP_ARTICLES || []).slice();
  const bySlug = new Map(articles.map(a => [a.slug, a]));
  const state = { query:'', category:'All' };

  const homeEl = document.getElementById('helpHome');
  const articleEl = document.getElementById('articleView');
  const searchEl = document.getElementById('helpSearch');
  const topicSelectEl = document.getElementById('topicSelect');
  const gridEl = document.getElementById('articlesGrid');
  const metaEl = document.getElementById('resultsMeta');
  const recommendedEl = document.getElementById('recommendedWrap');

  const categorySource = Array.isArray(window.HELP_CATEGORIES) && window.HELP_CATEGORIES.length
    ? window.HELP_CATEGORIES
    : Array.from(new Set(articles.map(a => a.category)));
  const categories = ['All', ...categorySource];
  const featuredTitles = new Set([
    'Getting Started with PostIQ',
    'Connect and Reconnect Buffer',
    'Compose Posts and Send to Buffer'
  ]);

  function normalize(v){ return String(v || '').toLowerCase(); }
  function matches(article){
    const q = normalize(state.query).trim();
    const bucket = [article.title, article.summary, article.category, ...(article.tags || [])].join(' ').toLowerCase();
    const queryMatch = !q || bucket.includes(q);
    const categoryMatch = state.category === 'All' || article.category === state.category;
    return queryMatch && categoryMatch;
  }

  function escapeHtml(value){
    return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
  }

  function renderTopicSelect(){
    topicSelectEl.innerHTML = categories.map(cat => `<option value="${escapeHtml(cat)}" ${state.category===cat?'selected':''}>${cat}</option>`).join('');
  }

  function articleCard(article, opts){
    const showCategory = !!opts.showCategory;
    const featured = !!opts.featured;
    const categoryHtml = showCategory ? `<p class="article-category">${article.category}</p>` : '';
    const featuredClass = featured ? ' featured' : '';
    return `<a class="article-card${featuredClass}" href="?article=${encodeURIComponent(article.slug)}" data-open-article="${article.slug}" aria-label="Read guide: ${escapeHtml(article.title)}">${categoryHtml}<h3 class="article-title">${article.title}</h3><p class="article-summary">${article.summary}</p><span class="read-link">Read guide →</span></a>`;
  }

  function renderRecommended(filtered){
    const featured = filtered.filter(a => featuredTitles.has(a.title)).slice(0, 3);
    if (!featured.length || state.query || state.category !== 'All') {
      recommendedEl.innerHTML = '';
      return new Set();
    }
    recommendedEl.innerHTML = `
      <div class="section-head">Start here</div>
      <div class="featured-grid">${featured.map(item => articleCard(item, { featured: true, showCategory: false })).join('')}</div>
      <div class="section-head all-guides-head">All guides</div>
    `;
    return new Set(featured.map(f => f.slug));
  }

  function renderHome(){
    const filtered = articles.filter(matches);
    metaEl.textContent = `${filtered.length} guide${filtered.length===1?'':'s'} shown`;
    if (!filtered.length) {
      recommendedEl.innerHTML = '';
      gridEl.innerHTML = '<p class="article-summary">No help guides match your filters yet.</p>';
      return;
    }

    const hiddenSlugs = renderRecommended(filtered);
    const baseList = filtered.filter(a => !hiddenSlugs.has(a.slug));

    if (!baseList.length) {
      gridEl.innerHTML = '';
      return;
    }

    const isAllTopic = state.category === 'All';
    const isSearching = !!state.query.trim();
    const showCategoryOnCard = isSearching && isAllTopic;
    const heading = isSearching && isAllTopic ? 'Matching guides' : (isAllTopic ? 'All guides' : state.category);

    gridEl.innerHTML = `<section><h2 class="section-head">${heading}</h2><div class="articles-grid">${baseList.map(a => articleCard(a, { showCategory: showCategoryOnCard })).join('')}</div></section>`;
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

  searchEl.addEventListener('input', () => { state.query = searchEl.value; renderHome(); });
  topicSelectEl.addEventListener('change', () => { state.category = topicSelectEl.value; renderHome(); });

  document.addEventListener('click', (e) => {
    const articleLink = e.target.closest('[data-open-article]');
    if (articleLink){ e.preventDefault(); const slug = articleLink.dataset.openArticle; history.pushState({}, '', `?article=${encodeURIComponent(slug)}`); renderArticle(slug); return; }
    const homeLink = e.target.closest('[data-open-home]');
    if (homeLink){ e.preventDefault(); history.pushState({}, '', '/help/'); applyRoute(); }
  });

  window.addEventListener('popstate', applyRoute);

  renderTopicSelect();
  applyRoute();
})();
