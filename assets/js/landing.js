// ── Composer Split mode logic (shared across all instances) ──
function splitIntoThreads(text, maxLen = 280) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const posts = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) posts.push(current);
      if (trimmed.length > maxLen) {
        // chunk long sentence
        const words = trimmed.split(' ');
        let chunk = '';
        for (const word of words) {
          if ((chunk + ' ' + word).trim().length <= maxLen) {
            chunk = (chunk + ' ' + word).trim();
          } else {
            if (chunk) posts.push(chunk);
            chunk = word;
          }
        }
        if (chunk) current = chunk;
        else current = '';
      } else {
        current = trimmed;
      }
    }
  }
  if (current) posts.push(current);
  return posts;
}

function renderThreadOutput(outputEl, posts) {
  outputEl.innerHTML = '';
  if (!posts.length) {
    outputEl.innerHTML = '<div class="empty">Paste text to get instant post-ready drafts you can refine and share.</div>';
    return;
  }
  posts.forEach((post, i) => {
    const card = document.createElement('div');
    card.className = 'thread-card';
    card.style.animationDelay = (i * 0.04) + 's';
    card.innerHTML = `
      <div class="thread-meta">
        <span>Post ${i + 1} of ${posts.length}</span>
        <span>${post.length} / 280</span>
      </div>
      <div>${post}</div>
    `;
    outputEl.appendChild(card);
  });
}

function bindSplitter(inputId, btnId, outputId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  const output = document.getElementById(outputId);
  if (!input || !btn || !output) return;

  btn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) {
      output.innerHTML = '<div class="empty">Nothing to split yet—paste text above first.</div>';
      return;
    }
    const posts = splitIntoThreads(text);
    renderThreadOutput(output, posts);
  });
}

bindSplitter('demoInputHero', 'splitBtnHero', 'threadOutputHero');
bindSplitter('demoInputMobile', 'splitBtnMobile', 'threadOutputMobile');

// ── FAQ accordion ──
document.querySelectorAll('.faq-question').forEach(btn => {
  // Init open state
  const item = btn.closest('.faq-item');
  if (item.classList.contains('open')) {
    btn.querySelector('.faq-icon').textContent = '+';
  }

  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    // Close all
    document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
    // Open clicked if it was closed
    if (!isOpen) item.classList.add('open');
  });
});

// ── Scroll reveal ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal, .reveal-group').forEach(el => observer.observe(el));

function postIQTrack(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

document.querySelectorAll('a[href="app.html"]').forEach((link) => {
  link.addEventListener('click', () => {
    postIQTrack('landing_open_postiq_click', {
      location: link.closest('.topbar') ? 'topbar' : link.closest('.connect-card') ? 'final_cta' : 'page'
    });
  });
});

document.querySelectorAll('a[href="app.html?view=threadView"]').forEach((link) => {
  link.addEventListener('click', () => {
    postIQTrack('landing_try_split_mode_click', {
      location: link.closest('.topbar') ? 'topbar' : link.closest('.connect-card') ? 'final_cta' : 'page'
    });
  });
});

const splitBtnHero = document.getElementById('splitBtnHero');
if (splitBtnHero) {
  splitBtnHero.addEventListener('click', () => {
    postIQTrack('landing_hero_split_mode_used');
  });
}

const splitBtnMobile = document.getElementById('splitBtnMobile');
if (splitBtnMobile) {
  splitBtnMobile.addEventListener('click', () => {
    postIQTrack('landing_mobile_split_mode_used');
  });
}
