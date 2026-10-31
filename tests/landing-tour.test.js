'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const landing = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const tour = fs.readFileSync('js/features/tour.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(landing, /<h1[^>]*>Your Buffer calendar, <em>with room to think\.<\/em><\/h1>/);
assert.match(landing, /href="\/auth\/connect\.html\?return=%2Fapp\.html%3Fview%3DcalendarView"[^>]*>Sign in with Buffer</, 'primary CTA returns to the calendar');
assert.match(landing, /href="\/app\.html\?view=calendarView"[^>]*>Preview the calendar</);
assert.match(landing, /need Buffer sign-in/);
assert.match(landing, /Sample data/);
assert.match(landing, /not (?:made by, )?affiliated with/);
assert.doesNotMatch(landing, /thread splitter|first companion app|demoInput/i, 'obsolete demo and claims stay removed');
assert.ok(landing.indexOf('id="calendar"') < landing.indexOf('id="toolkit"'), 'toolkit follows the calendar story');
assert.doesNotMatch(landing, /href="[^"]*tour=1/, 'one preview entry point, not a separate tour link');
const heroVisual = landing.match(/<figure class="hero-visual"[\s\S]*?<\/figure>/);
assert.ok(heroVisual, 'hero shows the product next to the copy');
assert.doesNotMatch(heroVisual[0], /Approvals|Library|Pulse/, 'hero mockup shows only calendar-first tools');

assert.ok(app.includes('./js/features/tour.js') && app.includes('./css/app/tour.css'));
assert.ok(!app.includes('onboarding.js') && !sw.includes('onboarding'), 'the tour is the only onboarding');
assert.ok((app.match(/data-tour-start=/g) || []).length >= 3, 'tour can be restarted from the sidebar, Calendar and mobile menu');
assert.ok(sw.includes("'/js/features/tour.js'") && sw.includes("'/css/app/tour.css'"));

// The tour only navigates and points; it never calls Buffer or post creation.
// Sign-in starts only from the tour's own button.
assert.doesNotMatch(tour, /fetch\(|createPost|syncBuffer|\.click\(\)/);
assert.match(tour, /action === 'connect'[\s\S]*goToBufferConnect/);
assert.match(tour, /FIRST_VISIT && read\(SEEN_KEY\) !== '1'/, 'opens once on a first visit');
assert.match(tour, /params\.delete\('tour'\)/, 'landing tour flag is single-use');
assert.match(tour, /aria-modal', 'false'/, 'tour is non-modal');
for (const id of ['calendar', 'context', 'health', 'pace', 'bank']) assert.match(tour, new RegExp(`id: '${id}'`));

console.log('Landing CTA, claim, screenshot and tour wiring tests passed');
