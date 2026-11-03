import base64,gzip,html,json,re,sys
from pathlib import Path
root=Path('dist')
with_copper='--copper' in sys.argv
metadata='copper-boards.json' if with_copper else 'boards.json'
boards=json.loads((Path('.')/metadata).read_text())
preview='--preview' in sys.argv
if not preview and not all(b['routed'] for b in boards):raise ValueError('All six fresh native outputs are required')
if with_copper and not all(b.get('copperRecomputed') and b.get('regressionErrors')=={} for b in boards):raise ValueError('All six complete boards must pass final copper and routing validation')
versions={b['version'] for b in boards if b['routed']}
if len(versions)!=1:raise ValueError('Expected one verified autorouter version')
autorouter_version=next(iter(versions))
labels={'original':'Original Altium','unrouted':'Without traces','routed':'Autorouted'}
rows=[]
for b in boards:
 n=b['sample'];cards=[]
 for v,label in labels.items():
  image=root/f'assets/{n}-{v}.png'
  if image.exists():
   content=f'<button class="board-image" data-board="{n}" aria-label="Enlarge {html.escape(b["name"])}: {label}"><img src="assets/{n}-{v}.png" alt="{html.escape(b["name"])} — {label}" width="1200" height="800" loading="lazy" decoding="async"><span class="expand" aria-hidden="true">⤢</span></button>'
  else:content='<div class="board-image pending">Routing…</div>'
  status=f'<span class="result">{b["connections"]:,} connections</span>' if v=='routed' and b['routed'] else ''
  cards.append(f'<figure><figcaption><span>{label}</span>{status}</figcaption>{content}</figure>')
 title=b['name'][len(b['design']):].strip()
 rows.append(f'<section class="board" id="board-{n}" aria-labelledby="name-{n}"><div class="board-heading"><h2 id="name-{n}">{b["design"]}<span class="board-description">{html.escape(title)}</span></h2></div><div class="board-grid">{"".join(cards)}</div></section>')
page='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Six Texas Instruments power boards: original Altium layouts, unrouted boards, and tscircuit autorouting.">
<title>TI power boards · tscircuit</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#202523;background:#fafaf8;font-synthesis:none;scroll-behavior:smooth;scroll-padding-top:90px}
*{box-sizing:border-box}body{margin:0}a{color:inherit;text-underline-offset:3px}button{font:inherit}button,a{-webkit-tap-highlight-color:transparent}button:focus-visible,a:focus-visible{outline:2px solid #087256;outline-offset:4px}
header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:19px 32px;background:#fafaf8f5;border-bottom:1px solid #deded8;backdrop-filter:blur(10px)}h1{font-size:21px;letter-spacing:-.6px;line-height:1.2;margin:0;font-weight:600}nav{display:flex;gap:21px;align-items:center}nav a{font-size:14px;color:#5a625d;text-decoration:none}nav a:hover{color:#111;text-decoration:underline}.download{font-size:12px;white-space:nowrap}main{padding:5px 32px 20px;max-width:2000px;margin:auto}.board{padding:26px 0 31px;border-bottom:1px solid #deded8}.board:last-child{border:0}.board-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:17px}h2{font-size:19px;font-weight:600;letter-spacing:-.3px;line-height:1.5;margin:0;display:flex;align-items:baseline;gap:12px}.sample{color:#7a817b;font-size:12px;letter-spacing:0;font-weight:400;width:17px}.board-description{font-size:13px;color:#6a716c;font-weight:400;letter-spacing:0}.sources{display:flex;gap:17px;white-space:nowrap}.sources a{color:#69716b;font-size:12px;text-decoration:none}.sources a:hover{text-decoration:underline;color:#202523}.board-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0;min-width:0}figcaption{display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:12px;line-height:1.4;margin:0 0 8px;color:#535d56}.result{font-size:11px;color:#277256;white-space:nowrap}.result>span{padding:0 3px;color:#9ca59e}.board-image{display:block;position:relative;width:100%;border:1px solid #17302b;padding:0;background:#0b171a;border-radius:3px;overflow:hidden;cursor:zoom-in;aspect-ratio:3/2}.board-image img{display:block;width:100%;height:100%;object-fit:contain}.expand{position:absolute;bottom:8px;right:10px;color:#ebf4ef;font-size:20px;opacity:0;transition:opacity .12s}.board-image:hover .expand,.board-image:focus-visible .expand{opacity:1}.pending{display:grid;place-items:center;color:#a5b4ac;font-size:13px;cursor:default}footer{margin:0 32px;padding:17px 0 24px;border-top:1px solid #deded8;display:flex;justify-content:space-between;gap:20px;font-size:11px;color:#798078}footer a{text-decoration:none}footer a:hover{text-decoration:underline}
dialog{width:calc(100vw - 36px);max-width:1920px;height:calc(100dvh - 36px);max-height:100dvh;border:1px solid #c8d0c8;border-radius:5px;padding:0;background:#fafaf8;color:#202523;overflow:hidden}dialog[open]{display:flex;flex-direction:column}dialog::backdrop{background:#101b14b8}.viewer-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 20px;border-bottom:1px solid #deded8}.viewer-heading h2{font-size:17px}.viewer-controls{display:flex;align-items:center;gap:6px}.viewer-controls button{height:32px;min-width:32px;padding:0 11px;border:1px solid #cdd3cb;border-radius:3px;background:transparent;color:inherit;cursor:pointer;font-size:14px}.viewer-controls button:hover{background:#e9ede5}.viewer-controls output{min-width:53px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums}.viewer-controls .close{margin-left:9px}.viewer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;flex:1;min-height:0;height:auto;background:#20322b}.viewer-panel{min-width:0;background:#0b171a;display:flex;flex-direction:column}.viewer-label{font-size:12px;color:#b9c8bf;padding:13px 15px;line-height:1.2}.viewport{flex:1;position:relative;overflow:hidden;touch-action:none;cursor:grab;min-height:0;user-select:none}.viewport:active{cursor:grabbing}.viewport img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform-origin:50% 50%;pointer-events:none;user-select:none;will-change:transform}.viewer-note{font-size:11px;color:#7c8f81;margin-left:12px;font-weight:400}.viewer-error{position:absolute;inset:0;display:grid;place-items:center;color:#e0b6a9;font-size:12px}.viewer-error[hidden]{display:none}
@media(min-width:1600px){main{padding-left:45px;padding-right:45px}.board-grid{gap:20px}.board{padding-top:31px;padding-bottom:38px}}
@media(max-width:1050px){.board-description{display:block;margin-left:0}.board-heading h2{display:block;position:relative}.board-heading .sample{position:absolute;left:0;top:3px}.result{font-size:10px}.sources{gap:12px}.viewer-note{display:none}}
@media(max-width:720px){header{padding:16px;gap:15px;flex-wrap:wrap}h1{font-size:19px}nav{gap:16px}.download{display:none}main{padding:0 16px 10px}.board{padding:23px 0 25px}.board-heading{align-items:flex-start;gap:8px;margin-bottom:15px}.board-heading h2{font-size:17px}.board-description{font-size:11px;max-width:260px}.sources{flex-direction:column;gap:6px;align-items:flex-end;padding-top:4px}.sources a{font-size:10px}.board-grid{grid-template-columns:repeat(3, minmax(245px,1fr));overflow-x:auto;padding-bottom:10px;gap:12px;scroll-snap-type:x mandatory}.board-grid figure{scroll-snap-align:start}.result{font-size:10px}figcaption{font-size:11px}footer{margin:0 16px;line-height:1.6;flex-direction:column;gap:5px}dialog{width:100vw;height:100dvh;border-radius:0;max-height:100dvh;max-width:100vw}.viewer-heading{padding:12px;flex-wrap:wrap}.viewer-heading h2{font-size:15px}.viewer-controls{gap:4px}.viewer-controls button{padding:0 8px}.viewer-grid{grid-template-columns:repeat(3,minmax(245px,1fr));overflow-x:auto;height:auto}.viewer-label{font-size:11px;padding:12px}.viewer-controls .close{margin-left:5px}}
@media(prefers-reduced-motion:reduce){:root{scroll-behavior:auto}.expand{transition:none}}
</style>
</head>
<body>
<header><h1>TI power boards</h1></header>
<main>__ROWS__</main>
<footer><span><a href="https://www.npmjs.com/package/@tscircuit/capacity-autorouter/v/__AUTOROUTER_VERSION__" target="_blank" rel="noopener noreferrer">tscircuit autorouter __AUTOROUTER_VERSION__</a></span></footer>
<dialog id="viewer" aria-labelledby="viewer-name"><div class="viewer-heading"><h2 id="viewer-name"></h2><div class="viewer-controls"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><output id="zoom-level" aria-live="polite">100%</output><button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="zoom-reset">Reset</button><button type="button" class="close" id="viewer-close" aria-label="Close comparison">Close</button></div></div><div class="viewer-grid">__PANELS__</div></dialog>
<script id="board-data" type="application/json">__DATA__</script>
<!-- OFFLINE_ASSETS -->
<script>
"use strict";
const boards = JSON.parse(document.getElementById("board-data").textContent);
const viewer = document.getElementById("viewer");
const images = [...viewer.querySelectorAll(".viewport img")];
const viewports = [...viewer.querySelectorAll(".viewport")];
const errors = [...viewer.querySelectorAll(".viewer-error")];
const zoomLevel = document.getElementById("zoom-level");
let zoom = 1, panX = 0, panY = 0, drag = null, opening = 0, opener = null;
const offlineAssets = document.getElementById("offline-assets");
const packed = offlineAssets ? JSON.parse(offlineAssets.textContent) : null;
const unpacked = new Map();
async function imageSource(path) {
  if (!packed) return path;
  if (unpacked.has(path)) return unpacked.get(path);
  const bytes = Uint8Array.from(atob(packed[path]), (character) => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const svg = await new Response(stream).text();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  unpacked.set(path, url);
  return url;
}
function applyView() {
  const transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  for (const image of images) image.style.transform = transform;
  zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  document.getElementById("zoom-out").disabled = zoom <= 1;
  document.getElementById("zoom-in").disabled = zoom >= 12;
}
function setZoom(value) {
  const previous = zoom;
  zoom = Math.min(12, Math.max(1, value));
  panX *= zoom / previous;
  panY *= zoom / previous;
  if (zoom === 1) panX = panY = 0;
  applyView();
}
async function openBoard(sample, button) {
  const board = boards.find((entry) => entry.sample === Number(sample));
  if (!board) return;
  const generation = ++opening;
  opener = button;
  zoom = 1; panX = 0; panY = 0;
  document.getElementById("viewer-name").textContent = board.design;
  images.forEach((image) => { image.removeAttribute("src"); });
  errors.forEach((error) => { error.hidden = true; });
  applyView();
  if (!viewer.open) viewer.showModal();
  document.body.style.overflow = "hidden";
  await Promise.all(images.map(async (image, index) => {
    const variant = ["original", "unrouted", "routed"][index];
    image.alt = `${board.name} — ${["Original Altium", "Without traces", "Autorouted"][index]}`;
    try {
      const source = await imageSource(`assets/${board.sample}-${variant}.svg`);
      if (generation === opening) image.src = source;
    } catch (error) {
      if (generation === opening) errors[index].hidden = false;
    }
  }));
}
for (const button of document.querySelectorAll("[data-board]")) {
  button.addEventListener("click", () => openBoard(button.dataset.board, button));
}
document.getElementById("viewer-close").addEventListener("click", () => viewer.close());
viewer.addEventListener("close", () => { opening++; document.body.style.overflow = ""; opener?.focus(); });
viewer.addEventListener("click", (event) => { if (event.target === viewer) viewer.close(); });
document.getElementById("zoom-in").addEventListener("click", () => setZoom(zoom * 1.5));
document.getElementById("zoom-out").addEventListener("click", () => setZoom(zoom / 1.5));
document.getElementById("zoom-reset").addEventListener("click", () => setZoom(1));
for (const [index, viewport] of viewports.entries()) {
  images[index].addEventListener("error", () => { errors[index].hidden = false; });
  images[index].addEventListener("load", () => { errors[index].hidden = true; });
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    setZoom(zoom * Math.exp(-event.deltaY * 0.0015));
  }, { passive: false });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, originX: panX, originY: panY, pointer: event.pointerId };
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointer !== event.pointerId || zoom === 1) return;
    panX = drag.originX + event.clientX - drag.x;
    panY = drag.originY + event.clientY - drag.y;
    applyView();
  });
  viewport.addEventListener("pointerup", () => { drag = null; });
  viewport.addEventListener("pointercancel", () => { drag = null; });
  viewport.addEventListener("dblclick", () => setZoom(zoom === 1 ? 2.5 : 1));
}
viewer.addEventListener("keydown", (event) => {
  if (event.key === "+" || event.key === "=") { event.preventDefault(); setZoom(zoom * 1.5); }
  if (event.key === "-") { event.preventDefault(); setZoom(zoom / 1.5); }
  if (event.key === "0") { event.preventDefault(); setZoom(1); }
});
</script>
</body>
</html>'''
panels=''.join(f'<div class="viewer-panel"><div class="viewer-label">{label}</div><div class="viewport"><img alt="" draggable="false"><span class="viewer-error" hidden>Could not load this view.</span></div></div>' for label in labels.values())
page=page.replace('__ROWS__','\n'.join(rows)).replace('__PANELS__',panels).replace('__DATA__',json.dumps(boards,separators=(',',':'))).replace('__AUTOROUTER_VERSION__',autorouter_version)
(root/'index.html').write_text(page)
if not preview:
 packed={}
 for b in boards:
  for v in labels:
   path=f'assets/{b["sample"]}-{v}.svg'
   packed[path]=base64.b64encode(gzip.compress((root/path).read_bytes(),compresslevel=9,mtime=0)).decode()
 offline=page.replace('<!-- OFFLINE_ASSETS -->','<script id="offline-assets" type="application/json">'+json.dumps(packed,separators=(',',':'))+'</script>')
 def inline_png(m):
  return 'src="data:image/png;base64,'+base64.b64encode((root/m.group(1)).read_bytes()).decode()+'"'
 offline=re.sub(r'src="(assets/[^"]+\.png)"',inline_png,offline)
 (root/'ti-power-boards.html').write_text(offline)
 print('Standalone HTML',len(offline.encode()),'bytes')
print('Built',len(boards),'board rows;',sum(b['routed'] for b in boards),'fresh routed outputs')
