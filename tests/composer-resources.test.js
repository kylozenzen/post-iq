'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('app.html', 'utf8');
const resourcesSource = fs.readFileSync('js/features/composer-resources.js', 'utf8');
const bootstrap = fs.readFileSync('js/core/bootstrap.js', 'utf8');
const contentFlow = fs.readFileSync('js/features/content-flow.js', 'utf8');
const templates = fs.readFileSync('js/features/templates.js', 'utf8');
const library = fs.readFileSync('js/library.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

for (const tab of ['notebook', 'hooks', 'hashtags', 'templates', 'pillars', 'ai']) {
  assert.match(html, new RegExp(`data-stool="${tab}"`));
  assert.match(html, new RegExp(`data-stool-panel="${tab}"`));
}
assert.match(html, /id="composerResourceSearch"/);
assert.match(html, /id="composerNotebookResources"/);
assert.match(html, /id="composerHookResources"/);
assert.match(html, /id="composerHashtagResources"/);
assert.match(html, /js\/features\/composer-resources\.js/);

assert.match(resourcesSource, /postiq_notebook_v1/);
assert.match(resourcesSource, /postiq_templates_v1/);
assert.match(resourcesSource, /postiq_library_cache_v3/);
assert.match(resourcesSource, /postiq_library_starred_v1/);
assert.match(resourcesSource, /metricNumber\(post, 'engagementRate'\)/);
assert.match(resourcesSource, /insertText\(template\.body, 'prepend'\)/);
assert.match(resourcesSource, /data-resource-action="pin-notebook"/);
assert.match(resourcesSource, /data-resource-action="insert-hashtags"/);
assert.match(resourcesSource, /createTextFragment/);
assert.match(resourcesSource, /editor\.insertBefore\(fragment, editor\.firstChild\)/);

assert.match(bootstrap, /PostIQComposerResources\?\.init/);
assert.match(contentFlow, /postiq:notebook-changed/);
assert.match(bootstrap, /window\.pinReferenceToComposer = pinReferenceToComposer/);
assert.match(templates, /postiq:templates-changed/);
assert.match(library, /postiq:library-changed/);
assert.match(sw, /postiq-v10-content-flow/);
assert.match(sw, /\/js\/features\/composer-resources\.js/);

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(resourcesSource, context, { filename: 'composer-resources.js' });
const api = context.window.PostIQComposerResources;
assert.ok(api, 'Expected composer resources API');
assert.equal(api.extractOpening('The opening line\n\nThe rest of the post.'), 'The opening line');
assert.equal(api.extractOpening(''), '');
assert.ok(api.extractOpening('A'.repeat(260)).length <= 220, 'Long hooks should be compact');

const makeFragment = () => ({
  children: [],
  append(...nodes) { this.children.push(...nodes); },
});
const editor = {
  innerText: 'Existing draft',
  textContent: 'Existing draft',
  firstChild: { kind: 'existing' },
  prepended: [],
  appended: [],
  insertBefore(fragment) { this.prepended.push(...fragment.children); },
  append(...nodes) { this.appended.push(...nodes.flatMap(node => node.children || [node])); },
  dispatchEvent(event) { this.lastEvent = event; },
};
context.document = {
  getElementById: id => id === 'composerEditor' ? editor : null,
  createDocumentFragment: makeFragment,
  createElement: tag => ({ kind: tag }),
  createTextNode: text => ({ kind: 'text', text }),
};
context.Event = class Event { constructor(type) { this.type = type; } };
assert.equal(api.insertText('A better hook', 'prepend'), true);
assert.equal(editor.prepended[0].text, 'A better hook');
assert.deepEqual(editor.prepended.slice(1).map(node => node.kind), ['br', 'br']);
assert.equal(editor.lastEvent.type, 'input');

console.log('Composer resource integration tests passed');
