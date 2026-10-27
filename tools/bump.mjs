// Set the release number in both places it lives: node tools/bump.mjs 0.4.1
import fs from 'fs';
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) { console.error('Usage: node tools/bump.mjs X.Y.Z'); process.exit(1); }
const sub = (f, re, rep) => fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(re, rep));
sub('js/version.js', /APP_VERSION = '[^']+'/, `APP_VERSION = '${v}'`);
sub('sw.js', /const VERSION = '[^']+'/, `const VERSION = '${v}'`);
console.log(`Version set to ${v} in js/version.js and sw.js`);
