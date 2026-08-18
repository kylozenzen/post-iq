'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('app.html', 'utf8');
const composer = fs.readFileSync('js/features/composer.js', 'utf8');
const composerResources = fs.readFileSync('js/features/composer-resources.js', 'utf8');
const bootstrap = fs.readFileSync('js/core/bootstrap.js', 'utf8');
const navigation = fs.readFileSync('js/core/navigation.js', 'utf8');
const css = fs.readFileSync('css/app/composer.css', 'utf8');
const responsive = fs.readFileSync('css/app/responsive.css', 'utf8');

assert.match(html, /id="composerFocusBar"[^>]*hidden/);
assert.ok((html.match(/data-composer-focus-toggle/g) || []).length >= 3, 'Expected desktop, mobile, and focus-bar toggles');
assert.ok((html.match(/data-composer-resources-toggle/g) || []).length >= 3, 'Expected desktop, mobile, and focus-bar resource toggles');
assert.match(html, /id="composerSupportSection"[^>]*aria-hidden="true"[^>]*inert/);
assert.match(html, /data-composer-draft-status[^>]*data-state="empty"/);

assert.match(composer, /const COMPOSER_DRAFT_KEY = 'postiq_composer_draft_v1'/);
assert.match(composer, /sanitizeComposerDraftHtml/);
assert.match(composer, /localStorage\.setItem\(COMPOSER_DRAFT_KEY/);
assert.match(composer, /localStorage\.removeItem\(COMPOSER_DRAFT_KEY/);
assert.match(composer, /function setComposerFocusMode/);
assert.match(composer, /function setComposerResourcesOpen/);
assert.match(composer, /event\.key !== 'Escape'/);
assert.match(composer, /PostIQComposerResources\?\.refresh/);
assert.match(composerResources, /window\.PostIQComposerResources/);
assert.match(bootstrap, /initComposerWorkspace\(editor\)/);
assert.match(navigation, /new CustomEvent\('postiq:view-changed'/);

assert.match(css, /body\.composer-focus-mode #app \{ grid-template-columns: 1fr; \}/);
assert.match(css, /\.composer-support\.open/);
assert.match(css, /prefers-reduced-motion/);
assert.match(responsive, /height: min\(78dvh, 720px\)/);
assert.match(responsive, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(responsive, /body\.composer-focus-mode \.composer-panel \{ bottom: env\(safe-area-inset-bottom\); \}/);

console.log('Focused writing workspace tests passed');
