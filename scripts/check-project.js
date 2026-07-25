const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html',
  'app.html',
  'manifest.json',
  'icons/postiq-icon.svg',
  'sw.js',
  'assets/css/app.css',
  'assets/css/landing.css',
  'assets/css/tool-manager.css',
  'assets/js/app.js',
  'assets/js/landing.js',
  'assets/js/tool-registry.js',
  'assets/js/tools/trending-view.js',
  'netlify/functions/buffer-proxy.js',
  'netlify/functions/approval.js',
  'netlify/functions/unsplash-search.js'
];

const failures = [];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) failures.push(`Missing ${relativePath}`);
}

for (const relativePath of requiredFiles.filter(file => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  try {
    new vm.Script(source, { filename: relativePath });
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
  }
}

const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
for (const viewId of [
  'composerView',
  'threadView',
  'calendarView',
  'trendingView',
  'snippetsView',
  'approvalsView'
]) {
  const viewExists = viewId === 'trendingView'
    ? fs.readFileSync(path.join(root, 'assets/js/tools/trending-view.js'), 'utf8').includes(`tv.id = '${viewId}'`)
    : appHtml.includes(`id="${viewId}"`);
  if (!viewExists) failures.push(`Missing view ${viewId}`);
}

if (!appHtml.includes('assets/js/tool-registry.js')) {
  failures.push('Tool registry is not loaded by app.html');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`PostIQ checks passed (${requiredFiles.length} required files).`);
