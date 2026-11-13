const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/core/runtime.js', 'utf8');
const constants = source.slice(
  source.indexOf("const WORKSPACE_PREFERENCES_KEY"),
  source.indexOf("const IMGUR_KEY")
);
const helpers = source.slice(
  source.indexOf('function trackWorkspacePreference'),
  source.indexOf('function getErrorType')
);

const stored = new Map();
const note = { textContent: '' };
const paceToggle = { checked: false };
const bodyClasses = new Set();
const events = [];
const context = {
  console,
  window: { dispatchEvent: e => events.push(e), gtag: () => {} },
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
  localStorage: {
    getItem: key => stored.has(key) ? stored.get(key) : null,
    setItem: (key, value) => stored.set(key, value),
  },
  document: {
    body: { classList: { toggle: (c, on) => (on ? bodyClasses.add(c) : bodyClasses.delete(c)) } },
    querySelectorAll: selector => selector === '[data-pace-toggle]' ? [paceToggle] : [],
  },
  qs: id => id === 'pacePreferenceNote' ? note : null,
  safeTrack: callback => callback(),
  activateView: view => { context.activatedView = view; },
  currentViewId: 'calendarView',
};
vm.createContext(context);
vm.runInContext(`${constants}\nlet workspacePreferences = { ...WORKSPACE_DEFAULTS };\n${helpers}`, context);
const run = expression => vm.runInContext(expression, context);

// Every workspace is always on, whatever an older version saved.
stored.set('postiq.workspacePreferences', '{bad json');
assert.deepEqual({ ...run('getWorkspacePreferences()') }, { planning: true, create: true, ideas: true });
stored.set('postiq.workspacePreferences', JSON.stringify({ planning: false, create: false, ideas: false }));
assert.deepEqual({ ...run('getWorkspacePreferences()') }, { planning: true, create: true, ideas: true });
assert.equal(stored.get('postiq.workspacePreferences'), JSON.stringify({ planning: true, create: true, ideas: true }));

// Writing tools no longer show a first-draft tip.
assert.doesNotMatch(source, /writing-tools-tip|Your writing tools are on/);

// Pace is on by default and can be switched off and back on.
assert.equal(run('isPaceEnabled()'), true);
run('applyPacePreference()');
assert.equal(paceToggle.checked, true);
assert.equal(bodyClasses.has('pace-off'), false);

context.currentViewId = 'suiteView';
run('setPaceEnabled(false)');
assert.equal(run('isPaceEnabled()'), false);
assert.equal(stored.get('postiq.paceEnabled'), '0');
assert.equal(bodyClasses.has('pace-off'), true);
assert.equal(paceToggle.checked, false);
assert.equal(context.activatedView, 'calendarView', 'leaving Pace when it is switched off');
assert.match(note.textContent, /Pace is off/);
assert.equal(events.at(-1).type, 'postiq:pace-changed');

run('setPaceEnabled(true)');
assert.equal(run('isPaceEnabled()'), true);
assert.equal(bodyClasses.has('pace-off'), false);

const html = fs.readFileSync('app.html', 'utf8');
const css = fs.readFileSync('css/app/ideas-settings.css', 'utf8');
const nav = fs.readFileSync('js/core/navigation.js', 'utf8');
const suiteCss = fs.readFileSync('css/app/suite.css', 'utf8');
assert.match(html, /data-stab="customize">Customize<\/button>/);
assert.doesNotMatch(html, /data-stab="(?:workspace|planning|notes)"/);
assert.match(html, /id="settingsPanelCustomize"[\s\S]*id="customizePaceHeading">Pace<[\s\S]*id="customizePlanningHeading">Planning<[\s\S]*id="customizeNotesHeading">Notes</);
assert.match(html, /data-pace-toggle id="paceToggle"/);
assert.doesNotMatch(html, /data-workspace-toggle|resetWorkspaceBtn/, 'workspaces are no longer toggles');
assert.match(nav, /viewId === 'suiteView' && typeof isPaceEnabled === 'function' && !isPaceEnabled\(\)/);
assert.match(suiteCss, /body\.pace-off \.nav-btn\[data-view="suiteView"\]/);
assert.match(css, /\.settings-panel \{ display: none; min-height: 0; max-height: none; overflow: visible;/);

console.log('Workspace preference tests passed');
