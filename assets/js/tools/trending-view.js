// Inject trending view into main on load
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('.main');
  const tv = document.createElement('section');
  tv.id = 'trendingView';
  tv.className = 'view';
  tv.innerHTML = `
    <div class="page-hdr">
      <div class="page-hdr-left">
        <h1 class="page-title">Trending</h1>
          <div class="state-pill preview view-state-pill" id="trendingStatePill">Free Preview</div>
        <p class="page-desc">What's hot on Reddit and Hacker News right now. Click any story to draft a post.</p>
      </div>
    </div>
    <div class="mob-view-hdr">
      <span class="mob-view-title"><span class="mob-icon"><svg><use href="#i-trending"></use></svg></span>Trending</span>
      <button class="btn sm ghost" id="trendingRefreshMob">↻</button>
    </div>

    <div class="trending-layout">

      <!-- Source tabs -->
      <div class="trending-tabs">
        <button class="trending-tab active" data-src="reddit">Reddit</button>
        <button class="trending-tab" data-src="hn">Hacker News</button>
        <button class="trending-tab" data-src="topics">Topics</button>
      </div>

      <!-- Reddit panel -->
      <div id="trendingReddit" class="trending-panel">
        <div class="trending-controls">
          <div class="trending-subs" id="trendingSubBtns">
            <button class="sub-pill active" data-sub="socialmedia">r/socialmedia</button>
            <button class="sub-pill" data-sub="entrepreneur">r/entrepreneur</button>
            <button class="sub-pill" data-sub="marketing">r/marketing</button>
            <button class="sub-pill" data-sub="business">r/business</button>
          </div>
          <div class="trending-custom-row">
            <input id="trendingCustomSub" class="input" placeholder="r/custom subreddit" style="max-width:200px;" />
            <button class="btn sm" id="trendingAddSub">Go</button>
            <button class="btn sm ghost" id="trendingRefresh">↻ Refresh</button>
          </div>
        </div>
        <div id="trendingRedditStatus" class="status-txt mt8"></div>
        <div id="trendingRedditList" class="trending-list"></div>
      </div>

      <!-- HN panel -->
      <div id="trendingHN" class="trending-panel" style="display:none;">
        <div class="trending-controls">
          <div class="trending-subs">
            <button class="sub-pill active" data-hn="topstories">Top</button>
            <button class="sub-pill" data-hn="newstories">New</button>
            <button class="sub-pill" data-hn="beststories">Best</button>
          </div>
          <div class="trending-custom-row">
            <button class="btn sm ghost" id="trendingHNRefresh">↻ Refresh</button>
          </div>
        </div>
        <div id="trendingHNStatus" class="status-txt mt8"></div>
        <div id="trendingHNList" class="trending-list"></div>
      </div>

      <!-- Topics panel -->
      <div id="trendingTopics" class="trending-panel" style="display:none;">
        <div class="trending-controls">
          <div class="trending-custom-row">
            <input id="topicsSearchInput" class="input" placeholder="e.g. content marketing, AI tools" style="flex:1;" />
            <button class="btn sm" id="topicsSearchBtn">Search</button>
            <button class="btn sm ghost" id="topicsEditBtn">Edit list</button>
          </div>
          <div id="topicsSavedPills" class="trending-subs" style="margin-top:8px;"></div>
        </div>
        <div id="topicsStatus" class="status-txt mt8"></div>
        <div id="topicsList" class="trending-list"></div>
      </div>

    </div>
  `;
  main.appendChild(tv);
});
