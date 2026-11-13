'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const landing = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const tour = fs.readFileSync('js/features/tour.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

assert.match(landing, /<h1[^>]*>Buffer publishes\. <em>PostIQ plans\.<\/em><\/h1>/);
assert.match(landing, /href="\/auth\/connect\.html\?return=%2Fapp\.html%3Fview%3DcalendarView"[^>]*>Sign in with Buffer</, 'primary CTA returns to the calendar');
assert.match(landing, /href="\/app\.html\?view=calendarView"[^>]*>Preview the calendar</);
assert.match(landing, /Buffer sign-in loads your scheduled posts and enables Buffer actions/);
assert.match(landing, /Sample data/);
assert.match(landing, /not endorsed by Buffer/);
assert.doesNotMatch(landing, /affiliated with/, 'no affiliation claim next to the partner link');
assert.doesNotMatch(landing, /thread splitter|first companion app|demoInput/i, 'obsolete demo and claims stay removed');
const order = ['id="heroTitle"', 'id="how"', 'id="try"', 'id="extras"'].map(id => landing.indexOf(id));
assert.ok(order.every(i => i > -1) && order.every((i, k) => k === 0 || order[k - 1] < i), 'hero, how it works, sample, then extras');
const heroVisual = landing.match(/<figure class="hero-visual"[\s\S]*?<\/figure>/);
assert.ok(heroVisual, 'hero shows the product next to the copy');
assert.match(heroVisual[0], /calendar-desktop\.png/, 'hero uses the current product capture');
assert.doesNotMatch(landing.slice(0, landing.indexOf('id="how"')), /<postiq-sample-calendar/, 'the live sample lives below the hero, not in it');
assert.match(landing, /<a class="signup-pill" href="https:\/\/join\.buffer\.com\/ben-campbell"[^>]*>Don’t have a Buffer account\? Sign up/, 'sign-up pill uses the partner link');
assert.match(landing, /Partner link: Ben may earn a commission/, 'affiliate disclosure sits beside the pill');
assert.doesNotMatch(landing, /href="[^"]*tour=1/, 'one preview entry point, not a separate tour link');
const shots = [...landing.matchAll(/src="\/images\/product\/([a-z-]+\.png)"/g)].map(m => m[1]);
assert.equal(new Set(shots).size, shots.length, `each landing image is different: ${shots.join(', ')}`);
for (const shot of shots) assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'images', 'product', shot)), `${shot} exists`);
assert.match(landing, /id="pace"[\s\S]*Take a break without going quiet[\s\S]*Today card[\s\S]*id="newsletters"[\s\S]*Quick add reads plain English[\s\S]*moves it in Buffer/, 'Pace, one-tap fill, newsletters, plain English and drag each get a beat');
assert.match(landing, /Does it sync with Google Calendar\?[\s\S]*Not live yet/, 'no Google Calendar sync claim');
for (const shot of ['pace-desktop.png', 'campaign-desktop.png', 'quickadd-desktop.png']) assert.ok(landing.includes(shot), `${shot} is on the page`);

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
assert.match(tour, /showWelcome\(\{ source:/, 'first visit shows welcome choice');
assert.match(tour, /data-welcome="tour"/, 'tour is optional');
assert.match(tour, /data-welcome="explore"/, 'exploration is optional');
assert.match(tour, /params\.get\('welcome'\) === '1'/, 'welcome can be force-previewed after earlier visits');
assert.match(tour, /params\.delete\('welcome'\)/, 'welcome preview flag is single-use');
assert.match(app, /id="gettingStartedDialog"/, 'getting started has its own dialog');
assert.match(app, /id="sidebarBufferDetails"/, 'Buffer actions expand in sidebar');
assert.match(app, /id="connStatusButton"/, 'connection has a compact status action');
assert.match(app, /id="openGettingStarted"/, 'sidebar opens setup dialog');
for (const id of ['calendar', 'plan', 'compose']) assert.match(tour, new RegExp(`id: '${id}'`));

assert.match(tour, /CONNECTED_SEEN_KEY/, 'connected and preview tour completion are independent');
assert.match(tour, /relevantSteps\(\)/, 'tour adapts to connection state');
assert.doesNotMatch(tour, /Ideas on the Shelf/, 'tour no longer points at a Settings toggle');
assert.match(tour, /selectSettingsTab\?\.\('customize'\)/, 'tour opens the Shelf setting');
assert.match(tour, /#sharedDayModal\.open \[data-add-note\]/, 'plan step follows the day drawer action');
assert.match(tour, /dayObserver = new MutationObserver/, 'tour repositions after a day drawer opens');
console.log('Landing CTA, claim, screenshot and calendar tour wiring tests passed');
