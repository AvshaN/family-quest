// A thing a creature sits in or on, drawn whole and in halves (prop.html says what the halves are).
//   node prop.js MODEL.glb OUT_DIR [--size=900] [--yaw=0] [--tilt=6] [--split=0] [--level=0.5] [--shots=full,back,front]
// Writes OUT_DIR/<shot>.png and OUT_DIR/info.json. Any other --key=value goes to prop.html. THREE_DIR points at the
// three package.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const args = process.argv.slice(2), [model, out] = args.filter(a => !a.startsWith("--"));
const opt = Object.fromEntries(args.filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=") || "1"]; }));
const THREE_DIR = process.env.THREE_DIR || path.dirname(require.resolve("three/package.json"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
  const f = u === "model.glb" ? path.resolve(model) : u.startsWith("three/") ? path.join(THREE_DIR, u.slice(6)) : path.join(__dirname, u || "prop.html");
  if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(0, r));
  const size = +(opt.size || 900), shots = (opt.shots || "full,back,front").split(",");
  const q = Object.assign({}, opt); delete q.shots;
  const br = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await br.newPage({ viewport: { width: size + 40, height: size + 40 } });
  page.on("console", m => { if (m.type() === "error") console.log("page error:", m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${srv.address().port}/prop.html?${new URLSearchParams(q)}`);
  await page.waitForFunction(() => window.ready || window.failed, null, { timeout: 300000 });
  if (await page.evaluate(() => window.failed)) throw new Error(await page.evaluate(() => window.failed));
  fs.mkdirSync(out, { recursive: true });
  for (const s of shots) fs.writeFileSync(path.join(out, s + ".png"), Buffer.from((await page.evaluate(m => window.shot(m), s)).split(",")[1], "base64"));
  if (await page.evaluate(() => !!window.lost)) throw new Error("the WebGL context was lost on the way: these pictures are not to be trusted");
  const info = await page.evaluate(() => window.info());
  fs.writeFileSync(path.join(out, "info.json"), JSON.stringify(info));
  console.log(shots.join(", "), "->", out, JSON.stringify(info));
  await br.close(); srv.close();
})().catch(e => { console.error("FAILED", e); process.exit(1); });
