// Slims a Meshy model for drawing its pictures: welded, simplified to about so many triangles, textures made
// smaller. Meshy's models have 100,000 to 2,500,000 triangles and 4096 px textures, and drawing a creature's
// outfits from them (wear.py) took hours; a picture 340 px across shows no difference.
//   node slim.mjs IN.glb OUT.glb [triangles=25000] [texture=1024]
// Needs @gltf-transform/core, @gltf-transform/functions, meshoptimizer and sharp (npm install them beside it, or
// run it from a folder that has them). A model with a skeleton and a motion keeps both.
import { NodeIO } from "@gltf-transform/core";
import { weld, simplify, textureCompress, prune, dedup } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
const [src, dst, want = "25000", tex = "1024"] = process.argv.slice(2);
const io = new NodeIO(), doc = await io.read(src);
const count = () => { let t = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3; return Math.round(t); };
const before = count();
await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, +want / before), error: 0.01 }), textureCompress({ encoder: sharp, resize: [+tex, +tex] }), prune());
await io.write(dst, doc);
console.log(src.split("/").slice(-2).join("/"), before, "->", count(), "triangles");
