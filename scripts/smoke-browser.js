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
  const dom = await loadApp();
  try {
    const { document } = dom.window;
    if (!document.querySelector('#calendarView.active')) throw new Error('Planning must open by default');
    dom.window.eval(`state.scheduled = [{id:'first',text:'First exact post',channelId:'a',dueAt:new Date().toISOString()},{id:'second',text:'Second exact post',channelId:'a',dueAt:new Date().toISOString()}]; renderCalendar();`);
    document.querySelector('[data-post-id="second"]').click();
    const detail = document.querySelector('#sharedDayBody').textContent;
    if (!detail.includes('Second exact post') || detail.includes('First exact post')) throw new Error('Post selection opened the wrong post');
    dom.window.eval("closeModal('sharedDayModal')");
    document.querySelector('[data-view="composerView"]').click();
    if (!document.querySelector('#composerView.active')) throw new Error('Composer navigation failed');
    document.querySelector('[data-view="calendarView"]').click();
    if (!document.querySelector('#calendarView.active')) throw new Error('Planning navigation failed');
  } finally { dom.window.close(); }
  console.log('DOM smoke test passed.');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
