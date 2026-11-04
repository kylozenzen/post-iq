'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const articlesSource = fs.readFileSync('help/articles.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const context = { window: {} };
vm.runInNewContext(articlesSource, context, { filename: 'help/articles.js' });

const articles = context.window.POSTIQ_HELP_ARTICLES;
assert.ok(Array.isArray(articles) && articles.length >= 11, 'help articles load');
const slugs = new Set(articles.map(article => article.slug));
assert.equal(slugs.size, articles.length, 'slugs stay unique');
for (const article of articles) {
  assert.ok(article.title && article.body && article.summary, `${article.slug} has required fields`);
  for (const related of article.relatedArticles || []) {
    assert.ok(slugs.has(related), `${article.slug}: missing related guide ${related}`);
  }
}
function article(slug) {
  const found = articles.find(item => item.slug === slug);
  assert.ok(found, `missing ${slug}`);
  return found.body;
}
assert.match(article('getting-started'), /Take the tour/);
assert.match(article('getting-started'), /Look around/);
assert.match(article('getting-started'), /four-part tour/);
assert.match(article('getting-started'), /Help → Getting started/);
assert.match(article('connect-buffer'), /expand/);
assert.match(article('connect-buffer'), /Sync now/);
assert.match(article('connect-buffer'), /Sign out/);
assert.match(article('build-your-idea-system'), /Settings → Customize/);
assert.match(article('plan-content-calendar'), /Start draft/);
assert.match(article('write-split-send-posts'), /Compose/);
assert.match(readme, /Welcome, tour, and Getting Started/);
assert.doesNotMatch(articlesSource, /A three-step tour opens/);
console.log('Help Center article links, onboarding terminology and key instructions pass');
