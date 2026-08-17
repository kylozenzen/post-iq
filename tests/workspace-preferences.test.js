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
const nav = Object.assign({ hidden: false }, { dataset: { workspaceNav: 'ideas' } });
const toggle = Object.assign({ checked: false }, { dataset: { workspaceToggle: 'ideas' } });
const context = {
  console,
  window: {},
  localStorage: {
    getItem: key => stored.has(key) ? stored.get(key) : null,
    setItem: (key, value) => stored.set(key, value),
  },
  document: {
    querySelectorAll: selector => selector === '[data-workspace-nav]' ? [nav] : selector === '[data-workspace-toggle]' ? [toggle] : [],
  },
  qs: id => id === 'workspacePreferenceNote' ? note : null,
  safeTrack: callback => callback(),
  activateView: view => { context.activatedView = view; },
  currentViewId: 'calendarView',
};
vm.createContext(context);
vm.runInContext(`${constants}\nlet workspacePreferences = { ...WORKSPACE_DEFAULTS };\n${helpers}`, context);

function run(expression) {
  return vm.runInContext(expression, context);
}

stored.set('postiq.workspacePreferences', '{bad json');
assert.deepEqual({ ...run('getWorkspacePreferences()') }, { planning: true, create: true, ideas: true, approvals: true });
assert.equal(stored.get('postiq.workspacePreferences'), JSON.stringify({ planning: true, create: true, ideas: true, approvals: true }));

stored.set('postiq.workspacePreferences', JSON.stringify({ planning: false, create: false, ideas: false, approvals: false }));
assert.deepEqual({ ...run('getWorkspacePreferences()') }, { planning: true, create: false, ideas: false, approvals: false });

run('workspacePreferences = { planning: false, create: false, ideas: true, approvals: false }; setWorkspacePreference("ideas", false)');
assert.equal(note.textContent, 'At least one workspace needs to stay on.');
assert.equal(run('workspacePreferences.ideas'), true);

context.currentViewId = 'ideasView';
run('workspacePreferences = { planning: true, create: false, ideas: true, approvals: false }; saveWorkspacePreferences({ planning: true, create: false, ideas: false, approvals: false })');
assert.equal(context.activatedView, 'calendarView');
assert.equal(nav.hidden, true);
assert.equal(toggle.checked, false);

const html = fs.readFileSync('app.html', 'utf8');
const css = fs.readFileSync('css/app/ideas-settings.css', 'utf8');
assert.match(html, /data-stab="customize">Customize<\/button>/);
assert.doesNotMatch(html, /data-stab="(?:workspace|planning|notes)"/);
assert.match(html, /id="settingsPanelCustomize"[\s\S]*id="customizeWorkspaceHeading">Workspace<[\s\S]*id="customizePlanningHeading">Planning<[\s\S]*id="customizeNotesHeading">Notes</);
assert.match(html, /id="resetWorkspaceBtn"[^>]*>Reset workspace visibility<\/button>/);
assert.match(css, /\.settings-panel \{ display: none; min-height: 420px; max-height: 420px; overflow-y: auto;/);

console.log('Workspace preference tests passed');
