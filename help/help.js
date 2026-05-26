(function(){
  const articles = (window.POSTIQ_HELP_ARTICLES || []).slice();
  const bySlug = new Map(articles.map(a => [a.slug, a]));
  const state = { query:'', category:'All' };

  const homeEl = document.getElementById('helpHome');
  const articleEl = document.getElementById('articleView');
  const searchEl = document.getElementById('helpSearch');
  const filtersEl = document.getElementById('categoryFilters');
  const gridEl = document.getElementById('articlesGrid');
  const metaEl = document.getElementById('resultsMeta');

  const categories = ['All', ...Array.from(new Set(articles.map(a => a.category)))];

  function normalize(v){ return String(v || '').toLowerCase(); }
  function matches(article){
    const q = normalize(state.query).trim();
    const bucket = [article.title, article.summary, article.category, ...(article.tags || [])].join(' ').toLowerCase();
    const queryMatch = !q || bucket.includes(q);
    const categoryMatch = state.category === 'All' || article.category === state.category;
    return queryMatch && categoryMatch;
  }

  function renderFilters(){
    filtersEl.innerHTML = categories.map(cat => `<button type="button" class="cat-btn ${state.category===cat?'active':''}" data-category="${cat}" aria-pressed="${state.category===cat}">${cat}</button>`).join('');
  }

  function articleCard(article){
    return `<article class="article-card"><p class="article-category">${article.category}</p><h2 class="article-title">${article.title}</h2><p class="article-summary">${article.summary}</p><div class="article-tags">${(article.tags||[]).map(t=>`<span class="tag">#${t}</span>`).join('')}</div><a class="read-link" href="?article=${encodeURIComponent(article.slug)}" data-open-article="${article.slug}">Read article →</a></article>`;
  }

  function renderHome(){
    const filtered = articles.filter(matches);
    metaEl.textContent = `${filtered.length} article${filtered.length===1?'':'s'} shown`;
    if (!filtered.length) {
      gridEl.innerHTML = '<p class="article-summary">No help articles match your filters yet.</p>';
      return;
    }
    const grouped = categories.filter(c=>c!=='All').map(category => ({ category, items: filtered.filter(a => a.category === category) })).filter(g=>g.items.length);
    gridEl.innerHTML = grouped.map(group => `
      <section>
        <h2 class="article-category" style="font-size:12px;margin-bottom:10px;">${group.category}</h2>
        <div class="articles-grid">${group.items.map(articleCard).join('')}</div>
      </section>
    `).join('');
  }

  function renderArticle(slug){
    const article = bySlug.get(slug);
    if (!article){
      articleEl.hidden = true;
      homeEl.hidden = false;
      renderHome();
      return;
    }
    const related = (article.relatedArticles || []).map(rs => bySlug.get(rs)).filter(Boolean);
    articleEl.innerHTML = `<h2>${article.title}</h2><p class="meta">${article.category}</p><div class="article-body">${article.body}</div>
      <div class="related-list">${related.length ? `<h3>Related articles</h3>${related.map(r => `<a href="?article=${encodeURIComponent(r.slug)}" data-open-article="${r.slug}">${r.title}</a>`).join('')}` : ''}</div>
      <div class="article-nav"><a class="btn-link" href="/help/" data-open-home="true">← Back to all articles</a><a class="btn-link" href="/app.html">Back to PostIQ</a></div>`;
    homeEl.hidden = true;
    articleEl.hidden = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function applyRoute(push){
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('article');
    if (slug) renderArticle(slug); else { articleEl.hidden = true; homeEl.hidden = false; renderHome(); }
    if (push) history.pushState({}, '', slug ? `?article=${encodeURIComponent(slug)}` : '/help/');
  }

  searchEl.addEventListener('input', () => { state.query = searchEl.value; renderHome(); });
  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]'); if (!btn) return;
    state.category = btn.dataset.category; renderFilters(); renderHome();
  });

  document.addEventListener('click', (e) => {
    const articleLink = e.target.closest('[data-open-article]');
    if (articleLink){
      e.preventDefault();
      const slug = articleLink.dataset.openArticle;
      history.pushState({}, '', `?article=${encodeURIComponent(slug)}`);
      renderArticle(slug);
      return;
    }
    const homeLink = e.target.closest('[data-open-home]');
    if (homeLink){
      e.preventDefault();
      history.pushState({}, '', '/help/');
      applyRoute(false);
    }
  });

  window.addEventListener('popstate', () => applyRoute(false));

  renderFilters();
  applyRoute(false);
})();
