// A Meshy model, drawn from every side for the app (CLAUDE.md, "Meshy, for the app's art").
//
//   node tools/spin/spin.js MODEL.glb OUT_DIR [--n=32] [--size=512] [--yaw=0] [--tilt=12] [--fit=1] [--env=0.55] [--tint=ffdb9e] ...
//   python3 tools/art.py sheet OUT_DIR NAME          # packs the frames into art/spin/NAME.webp
//
// Opens spin.html in headless Chromium (software GL) and saves view 0..n-1 as PNGs. It needs two packages that are not
// in this repo: `playwright` (on Claude's cloud machine already) and `three` (npm install three, anywhere; point
// THREE_DIR at its folder, or NODE_PATH at the node_modules that holds it). Any other --key=value goes to spin.html.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const [model, out] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
if (!model || !out) { console.error("usage: node spin.js MODEL.glb OUT_DIR [--n=32] [--size=512] ..."); process.exit(1); }
const N = +(opt.n || 32); delete opt.n;
const THREE_DIR = process.env.THREE_DIR || path.dirname(require.resolve("three/package.json"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  const f = u === "model.glb" ? path.resolve(model) : u.startsWith("three/") ? path.join(THREE_DIR, u.slice(6)) : path.join(__dirname, u || "spin.html");
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(0, r));
  const size = +(opt.size || 512);
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await br.newPage({ viewport: { width: size, height: size } });
  page.on("console", m => { if (m.type() === "error") console.log("page error:", m.text().slice(0, 200)); });
  await page.goto(`http://localhost:${srv.address().port}/spin.html?${new URLSearchParams(opt)}`);
  await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 300000 });
  if (await page.evaluate(() => window.failed)) throw new Error(await page.evaluate(() => window.failed));
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(out, f));
  const t = Date.now();
  for (let k = 0; k < N; k++) {
    const url = await page.evaluate(([k, n]) => window.frame(k, n), [k, N]);
    fs.writeFileSync(path.join(out, `f${String(k).padStart(3, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  console.log(N, "frames of", size, "px in", Date.now() - t, "ms ->", out);
  await br.close(); srv.close();
})().catch(e => { console.error("FAILED", e); process.exit(1); });
