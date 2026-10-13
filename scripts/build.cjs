const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const context = { tailwind: {} };
vm.runInNewContext(fs.readFileSync('js/config/tailwind-config.js', 'utf8'), context);
const config = { ...context.tailwind.config, content: ['./index.html', './js/**/*.js'] };
fs.mkdirSync('work', { recursive: true });
fs.writeFileSync('work/tailwind.cjs', 'module.exports = ' + JSON.stringify(config));
fs.mkdirSync('vendor', { recursive: true });
for (const [from, to] of [
  ['vue/dist/vue.global.js', 'vue.global.js'],
  ['lucide/dist/umd/lucide.js', 'lucide.js'],
  ['leaflet/dist/leaflet.js', 'leaflet.js'],
  ['leaflet/dist/leaflet.css', 'leaflet.css'],
  ['vue/LICENSE', 'vue-LICENSE'],
  ['lucide/LICENSE', 'lucide-LICENSE'],
  ['leaflet/LICENSE', 'leaflet-LICENSE']
]) fs.copyFileSync(path.join('node_modules', from), path.join('vendor', to));
fs.cpSync('node_modules/leaflet/dist/images', 'vendor/images', { recursive: true });
const result = spawnSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'css/tailwind-input.css', '-o', 'vendor/tailwind.css', '--minify'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const files = ['index.html', 'css/styles.css', 'js/core.js', 'js/storage.js', 'js/app.js', 'js/config/tailwind-config.js', 'js/data/indicators.js', 'img/barra.png', 'img/paho-logo-blanco.png', ...fs.readdirSync('vendor', { recursive: true }).filter(file => fs.statSync(path.join('vendor', file)).isFile()).map(file => 'vendor/' + file.replace(/\\/g, '/'))];
const hash = require('node:crypto').createHash('sha256');
for (const file of files) hash.update(fs.readFileSync(file));
fs.writeFileSync('sw.js', `const CACHE = 'wash-fit-${hash.digest('hex').slice(0,12)}';\nconst ASSETS = ${JSON.stringify(['./', ...files.map(file=>'./'+file)])};\n` + fs.readFileSync('scripts/sw-template.js', 'utf8'));
for (const file of [...files, 'sw.js']) {
  const destination = path.join('dist', file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}
console.log('Recursos locales y caché offline generados.');
