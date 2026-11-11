/* Renders the home-screen icons (icons/*.png) from one SVG, with the Playwright that the build machine has.
 * Run from the repo root: node tools/make_icons.js */
const { chromium } = require("playwright");
const path = require("path");

const SVG = size => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="a" cx="30%" cy="22%" r="75%"><stop offset="0" stop-color="#A855F7"/><stop offset=".55" stop-color="#EC4899" stop-opacity=".55"/><stop offset="1" stop-color="#09090F" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="85%" cy="90%" r="70%"><stop offset="0" stop-color="#6366F1" stop-opacity=".9"/><stop offset="1" stop-color="#09090F" stop-opacity="0"/></radialGradient>
    <radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="#09090F"/>
  <rect width="512" height="512" fill="url(#a)"/>
  <rect width="512" height="512" fill="url(#b)"/>
  <circle cx="256" cy="256" r="150" fill="url(#g)"/>
  <path d="M256 92 C 270 200, 312 242, 420 256 C 312 270, 270 312, 256 420 C 242 312, 200 270, 92 256 C 200 242, 242 200, 256 92 Z" fill="#fff"/>
  <path d="M372 118 C 376 146, 386 156, 414 160 C 386 164, 376 174, 372 202 C 368 174, 358 164, 330 160 C 358 156, 368 146, 372 118 Z" fill="#fff" opacity=".85"/>
</svg>`;

(async () => {
  const out = path.join(__dirname, "..", "icons");
  require("fs").mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const [name, size] of [["icon-512.png", 512], ["icon-192.png", 192], ["apple-touch-icon.png", 180]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:#09090F">${SVG(size)}</body></html>`);
    await p.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
    console.log("wrote icons/" + name);
  }
  await b.close();
})();
