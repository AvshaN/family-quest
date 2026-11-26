// A creature's motion, drawn as frames (the creature idea's first step).
//   node clip.js MODEL.glb --info                          how long its motion is, its bones, where a camera must stand
//   node clip.js MODEL.glb OUT_DIR --d=.. --aim=.. [--from=0] [--to=4] [--fps=12] [--size=512] [--wear=FILE.glb ...]
// Any other --key=value goes to clip.html. THREE_DIR points at the three package.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const args = process.argv.slice(2), [model, out] = args.filter(a => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=") || "1"]; }));
const THREE_DIR = process.env.THREE_DIR || path.dirname(require.resolve("three/package.json"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const wear = opt.wear && opt.wear !== "1" ? path.resolve(opt.wear) : null; if (wear) opt.wear = "1";
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  const f = u === "model.glb" ? path.resolve(model) : u === "wear.glb" ? wear : u.startsWith("three/") ? path.join(THREE_DIR, u.slice(6)) : path.join(__dirname, u || "clip.html");
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(0, r));
  const size = +(opt.size || 512), info = !!opt.info, from = +(opt.from || 0), fps = +(opt.fps || 12);
  const q = Object.assign({}, opt); ["info", "from", "to", "fps"].forEach(k => delete q[k]);
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await br.newPage({ viewport: { width: size, height: size } });
  page.on("console", m => { if (m.type() === "error") console.log("page error:", m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${srv.address().port}/clip.html?${new URLSearchParams(q)}`);
  await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 300000 });
  if (await page.evaluate(() => window.failed)) throw new Error(await page.evaluate(() => window.failed));
  const I = await page.evaluate(() => window.info());
  if (info) { console.log(JSON.stringify(I)); await br.close(); srv.close(); return; }
  const to = opt.to ? +opt.to : I.duration, n = Math.max(1, Math.round((to - from) * fps));
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(out, f));
  for (let k = 0; k < n; k++) {
    const url = await page.evaluate(t => window.frame(t), from + k / fps);
    fs.writeFileSync(path.join(out, `f${String(k).padStart(3, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
  console.log(n, "frames,", from, "to", to.toFixed(2), "s at", fps, "a second ->", out);
  await br.close(); srv.close();
})().catch(e => { console.error("FAILED", e); process.exit(1); });
