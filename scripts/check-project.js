const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appHtmlPath = path.join(root, 'app.html');
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');
const failures = [];
const requiredFiles = [
  'index.html',
  'app.html',
  'manifest.json',
  'icons/postiq-icon.svg',
  'sw.js',
  'netlify/functions/buffer-proxy.js',
  'netlify/functions/approval.js',
  'netlify/functions/unsplash-search.js',
];

const localAssetReferences = [...appHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
  .map(match => match[1])
  .filter(reference => !/^(?:https?:)?\/\//.test(reference))
  .map(reference => reference.replace(/^[./]+/, ''));

const checkedFiles = [...new Set([...requiredFiles, ...localAssetReferences])];

for (const relativePath of checkedFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) failures.push(`Missing ${relativePath}`);
}

for (const relativePath of checkedFiles.filter(file => file.endsWith('.js'))) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, 'utf8');
  try {
    new vm.Script(source, { filename: relativePath });
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
  }
}

for (const viewId of ['calendarView', 'composerView', 'ideasView', 'approvalsView', 'libraryView', 'pulseView']) {
  if (!appHtml.includes(`id="${viewId}"`)) failures.push(`Missing view ${viewId}`);
}

if (appHtml.includes('./app.js') || appHtml.includes('./app.css')) {
  failures.push('app.html still loads a legacy root bundle');
}

const activeBundleFiles = localAssetReferences.filter(file => file.startsWith('js/') || file.startsWith('css/app/'));
for (const relativePath of activeBundleFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const size = fs.statSync(absolutePath).size;
  if (size > 80_000) failures.push(`${relativePath} is ${size} bytes; keep active modules below 80 KB`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`PostIQ checks passed (${checkedFiles.length} files, ${localAssetReferences.length} app assets).`);
