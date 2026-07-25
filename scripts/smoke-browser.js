const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');

class LocalResourceLoader extends ResourceLoader {
  fetch(url) {
    const parsed = new URL(url);
    if (parsed.hostname !== 'postiq.local') return Promise.resolve(Buffer.from(''));
    const relativePath = parsed.pathname.replace(/^\/+/, '');
    const absolutePath = path.join(root, relativePath);
    if (!absolutePath.startsWith(root) || !fs.existsSync(absolutePath)) return null;
    return Promise.resolve(fs.readFileSync(absolutePath));
  }
}

async function loadApp(search = '') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', error => errors.push(String(error)));

  const dom = new JSDOM(fs.readFileSync(path.join(root, 'app.html'), 'utf8'), {
    url: `https://postiq.local/app.html${search}`,
    runScripts: 'dangerously',
    resources: new LocalResourceLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '{}'
      });
      window.navigator.clipboard = { writeText: async () => {} };
      window.CSS = window.CSS || {};
      window.CSS.escape = window.CSS.escape || (value => String(value).replace(/"/g, '\\"'));
      window.confirm = () => true;
    }
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('App load timed out')), 5000);
    dom.window.addEventListener('load', () => {
      clearTimeout(timeout);
      setTimeout(resolve, 20);
    }, { once: true });
  });

  if (errors.length) throw new Error(`DOM errors:\n${errors.join('\n')}`);
  return dom;
}

async function run() {
  let dom = await loadApp();
  let { document, PostIQTools } = dom.window;

  if (!document.querySelector('#composerView.active')) {
    throw new Error('Composer was not the default active view');
  }
  if (!PostIQTools || PostIQTools.list().length !== 6) {
    throw new Error('Tool registry did not initialize');
  }

  document.querySelector('#openSettings').click();
  document.querySelector('[data-stab="tools"]').click();
  const composerToggle = document.querySelector('[data-tool-toggle="composer"]');
  composerToggle.checked = false;
  composerToggle.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  if (!document.querySelector('#threadView.active')) {
    throw new Error('Disabling the active tool did not select the next enabled tool');
  }
  if (document.querySelector('.side-nav [data-view="composerView"]').dataset.toolHidden !== 'true') {
    throw new Error('Composer navigation did not hide');
  }

  document.querySelector('#resetEnabledTools').click();
  dom.window.close();

  dom = await loadApp('?view=threadView');
  document = dom.window.document;
  if (!document.querySelector('#threadView.active')) {
    throw new Error('Direct Thread Splitter route did not activate');
  }
  if (!document.querySelector('#threadTabSplitter')) {
    throw new Error('Thread Splitter content is missing');
  }

  document.querySelector('#mobSettingsBtn').click();
  if (!document.querySelector('#mobDrawer.open')) {
    throw new Error('Mobile Tools button did not open the tool drawer');
  }

  dom.window.close();
  console.log('DOM smoke test passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
