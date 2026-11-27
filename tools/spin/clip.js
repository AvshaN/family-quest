// A creature's motion, drawn as frames (the creature idea's first step).
//   node clip.js MODEL.glb --info                          how long its motion is, its bones, where a camera must stand
//   node clip.js MODEL.glb OUT_DIR --d=.. --aim=.. [--from=0] [--to=4] [--fps=12] [--size=512] [--wear=FILE.glb ...]
// Outfits (clip.html, "outfits"): --outfit=LIST.json names what it wears, --weardir=DIR holds their models.
//   ... --outfit=L.json --weardir=D --layer=1 --pad=1     OUT_DIR/<key>/fNNN.png: each thing worn, alone, as a layer
//   ... --outfit=L.json --weardir=D --look=0,55,-55 --at=0   OUT_DIR/look_<yaw>.png: one moment from several sides
// Any other --key=value goes to clip.html. THREE_DIR points at the three package.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const args = process.argv.slice(2), [model, out] = args.filter(a => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=") || "1"]; }));
const THREE_DIR = process.env.THREE_DIR || path.dirname(require.resolve("three/package.json"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const wear = opt.wear && opt.wear !== "1" ? path.resolve(opt.wear) : null; if (wear) opt.wear = "1";
const outfit = opt.outfit && opt.outfit !== "1" ? path.resolve(opt.outfit) : null; if (outfit) opt.outfit = "1";
const weardir = opt.weardir ? path.resolve(opt.weardir) : null;
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  const f = u === "model.glb" ? path.resolve(model) : u === "wear.glb" ? wear : u === "outfit.json" ? outfit : u.startsWith("wear/") ? weardir && path.join(weardir, path.basename(u))
    : u.startsWith("three/") ? path.join(THREE_DIR, u.slice(6)) : path.join(__dirname, u || "clip.html");
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
const png = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
(async () => {
  await new Promise(r => srv.listen(0, r));
  const size = +(opt.size || 512), info = !!opt.info, from = +(opt.from || 0), fps = +(opt.fps || 12);
  const q = Object.assign({}, opt); ["info", "from", "to", "fps", "weardir", "look", "at", "anchors"].forEach(k => delete q[k]);
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await br.newPage({ viewport: { width: Math.round(size * 1.3), height: Math.round(size * 1.3) } });
  page.on("console", m => { if (m.type() === "error") console.log("page error:", m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${srv.address().port}/clip.html?${new URLSearchParams(q)}`);
  await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 300000 });
  if (await page.evaluate(() => window.failed)) throw new Error(await page.evaluate(() => window.failed));
  const I = await page.evaluate(() => window.info());
  if (opt.anchors) console.log(JSON.stringify(await page.evaluate(() => window.anchors || null)));
  if (info) { console.log(JSON.stringify(I)); await br.close(); srv.close(); return; }
  fs.mkdirSync(out, { recursive: true });
  if (opt.look) {   // one moment, from several sides
    for (const yaw of opt.look.split(",")) png(path.join(out, `look_${yaw}.png`), await page.evaluate(([t, y]) => window.frameYaw(t, y), [+(opt.at || 0), +yaw]));
    console.log("looked from", opt.look, "->", out);
    await br.close(); srv.close(); return;
  }
  const to = opt.to ? +opt.to : I.duration, n = Math.max(1, Math.round((to - from) * fps));
  if (opt.layer) {   // each thing worn, alone
    for (let k = 0; k < n; k++) {
      const got = await page.evaluate(t => window.layers(t), from + k / fps);
      for (const key of Object.keys(got)) { const dir = path.join(out, key); if (!k) { fs.mkdirSync(dir, { recursive: true }); for (const f of fs.readdirSync(dir)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(dir, f)); }
        png(path.join(dir, `f${String(k).padStart(3, "0")}.png`), got[key]); }
    }
    if (await page.evaluate(() => !!window.lost)) throw new Error("the WebGL context was lost on the way: these pictures are not to be trusted");
    console.log(n, "frames of each layer,", from, "to", to.toFixed(2), "s at", fps, "a second ->", out);
    await br.close(); srv.close(); return;
  }
  for (const f of fs.readdirSync(out)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(out, f));
  for (let k = 0; k < n; k++) png(path.join(out, `f${String(k).padStart(3, "0")}.png`), await page.evaluate(t => window.frame(t), from + k / fps));
  if (await page.evaluate(() => !!window.lost)) throw new Error("the WebGL context was lost on the way: these pictures are not to be trusted");
  console.log(n, "frames,", from, "to", to.toFixed(2), "s at", fps, "a second ->", out);
  await br.close(); srv.close();
})().catch(e => { console.error("FAILED", e); process.exit(1); });
