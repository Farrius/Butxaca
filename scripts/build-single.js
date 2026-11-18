// (Function replacements below: plain strings would treat "$'" etc. in the code as patterns.)
// Bundles the renderer into ONE self-contained HTML file (dist/butxaca.html)
// for hosting anywhere a single page is easiest (phone testing, static hosts).
//   npm run build:single
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'renderer');
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
// Order matters: dependencies first, app.js last.
const modules = ['data/categories.js', 'data/period.js', 'data/store.js', 'app.js'];
const js = modules
  .map((f) => `// ---- ${f} ----\n` + read(f)
    .replace(/^import .*?;\s*$/gm, '')
    .replace(/^export (?=const|function|class|async)/gm, ''))
  .join('\n');

const icon = 'data:image/svg+xml,' + encodeURIComponent(read('icon.svg').trim());
let html = read('index.html')
  .replace(/^\s*<meta http-equiv="Content-Security-Policy".*\n/m, '')
  .replace(/^\s*<link rel="manifest".*\n/m, '')
  .replace(/^\s*<link rel="apple-touch-icon".*\n/m, '')
  .replace('href="icon.svg"', () => `href="${icon}"`)
  .replace('<link rel="stylesheet" href="styles.css" />', () => `<style>\n${read('styles.css')}</style>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script type="module">\n${js}</script>`);

const out = path.join(__dirname, '..', 'dist', 'butxaca.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
