fetch('data/map.json', { cache: 'force-cache' })
.then(response => {
  if (!response.ok) throw new Error('HTTP ' + response.status + ' při načítání data/map.json');
  return response.json();
})
.then(RAW => {

(() => {
"use strict";


/* ---------- projection ---------- */
const C = 0.8660254, S = 0.5, ZK = 1.12;
const VX = 0, VY = -1, VZ = S / ZK;                   // toward viewer (looking north)
const SUN = (() => { const v = [-0.62, -0.78, 1.05], l = Math.hypot(...v); return v.map(a => a / l); })();
const PX = (e, n) => e;
const PY = (e, n, z) => -n * S - z * ZK;
const DEP = (e, n) => -n;                            // larger = closer to viewer

/* ---------- seeded random ---------- */
function rng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0); };

/* ---------- colour helpers ---------- */
const hex2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgb = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ---------- palettes ---------- */
const PAL = {
  spring: {
    ground: '#e6e8c4', meadow: '#cbd897', grass: '#c3d58c', farmland: ['#d8c793', '#bfd283', '#cfd68d', '#dccf9c'],
    residential: '#f1ead6', industrial: '#e3ddcf', farmyard: '#e0d2b2', allotments: '#c6d88f', sport: '#c6d78b', park: '#bfd585',
    cemetery: '#c7cfa2', scrub: '#bccb86', forest: '#b2c27e', pitch: '#b5cf7a', parking: '#ddd6c8', water: '#a6c3cc', waterInk: '#5f8796',
    road: '#f1e4c2', leaves: ['#a8c26a', '#9cbb62', '#b6c977', '#93b15e'], conifer: ['#5f7f52', '#557649', '#6c8a58'],
    blossom: ['#f2b9b5', '#f4c6c2', '#eeaab0'], bush: ['#a9bf6e', '#c0c56d'], roofSnow: false, bare: false,
  },
  summer: {
    ground: '#e2deb3', meadow: '#c2cf83', grass: '#b9cd7c', farmland: ['#e6cb76', '#dcbc61', '#b7c46f', '#e9d38a'],
    residential: '#f0e8d2', industrial: '#e2dccd', farmyard: '#dfcfa9', allotments: '#bacd7c', sport: '#bbcd7a', park: '#b2c977',
    cemetery: '#bdc890', scrub: '#adbe74', forest: '#a3b56f', pitch: '#acc86d', parking: '#dcd5c6', water: '#9dbdc8', waterInk: '#557f90',
    road: '#f0e2bd', leaves: ['#7f9e4f', '#8aa957', '#739448', '#94ad5e'], conifer: ['#4f6e45', '#46653e', '#5b7a4d'],
    blossom: ['#8aa957', '#7f9e4f'], bush: ['#90a95a', '#a0b35f'], roofSnow: false, bare: false,
  },
  autumn: {
    ground: '#e5dbb7', meadow: '#d2cf96', grass: '#cacb8c', farmland: ['#c9a87b', '#b8936a', '#d6c08a', '#cfb07e'],
    residential: '#f0e7d3', industrial: '#e2dccd', farmyard: '#ddcba8', allotments: '#cfc68a', sport: '#c9cd88', park: '#cfc683',
    cemetery: '#cdc79a', scrub: '#c9b57a', forest: '#c1b07a', pitch: '#bdc77e', parking: '#ddd6c8', water: '#9fb9c2', waterInk: '#5a7d8b',
    road: '#efe1c0', leaves: ['#d98c3a', '#c96a32', '#e2b04a', '#b8823c', '#cf9a3f'], conifer: ['#5c7650', '#536c48', '#667f55'],
    blossom: ['#c95b3b', '#d97a3e'], bush: ['#c48a45', '#b9893f'], roofSnow: false, bare: false,
  },
  winter: {
    ground: '#eef0ee', meadow: '#edf0f0', grass: '#e9eded', farmland: ['#ecefef', '#e6eaea', '#eff1f1', '#e9ecec'],
    residential: '#f1efe9', industrial: '#e5e2dc', farmyard: '#ecebe6', allotments: '#e9ece9', sport: '#e8ecea', park: '#e7ebe7',
    cemetery: '#e6e9e5', scrub: '#e1e4df', forest: '#e1e5e1', pitch: '#e6eae8', parking: '#e4e1db', water: '#c3d3d9', waterInk: '#7c97a2',
    road: '#e5ded0', leaves: ['#8b7a68'], conifer: ['#4d6649', '#45603f', '#56704f'],
    blossom: ['#8b7a68'], bush: ['#a99c8a'], roofSnow: true, bare: true,
  },
};
const WALLS = ['#f1df9f', '#efe7d1', '#ebcd9c', '#efd4c6', '#e2e2cf', '#f3e7bd', '#e8d8b4'];
const ROOFS = ['#b8664a', '#ad5c45', '#c47a55', '#b86f50', '#7e8487', '#8f9391', '#6e7477', '#6d5a4d'];
const INK = '#3a2f25';
const NIGHT_INK = '#15120f';

let season = 'spring', night = false;
const colCache = new Map();
function col(h) {
  const key = h + (night ? 'n' : 'd');
  let v = colCache.get(key);
  if (v) return v;
  let c = hex2(h);
  if (night) c = [c[0] * 0.27 + 14, c[1] * 0.30 + 18, c[2] * 0.40 + 34];
  v = { c, s: rgb(c) };
  colCache.set(key, v);
  return v;
}
function shade(h, k) {           // k: 0 (deep shadow) .. 1 (full light)
  const key = h + '|' + k.toFixed(2) + (night ? 'n' : 'd');
  let v = colCache.get(key);
  if (v) return v;
  const base = col(h).c;
  const cool = night ? [10, 14, 34] : [118, 120, 150];
  const c = mix(mix(base, cool, 0.5), base, k);
  v = rgb(c);
  colCache.set(key, v);
  return v;
}
const darker = (h, t = 0.35) => { const c = col(h).c; return rgb(mix(c, night ? [0, 0, 10] : [60, 45, 35], t)); };

/* ---------- data prep ---------- */
const [bx0, by0, bx1, by1] = RAW.bbox.map(v => v / 10);
const TREES = [], BLDS = [], AREAS = [], LINES = [], LAMPS = [];

// boundary (ragged edge)
const boundary = (() => {
  const r = rng(42), pts = [];
  const corners = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
  const ph = [r() * 6, r() * 6, r() * 6];
  let t = 0;
  for (let s = 0; s < 4; s++) {
    const [ax, ay] = corners[s], [bx, by] = corners[(s + 1) % 4];
    const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L; // inward normal for CCW
    for (let d = 0; d < L; d += 14) {
      t += 14;
      const off = 34 + 22 * Math.sin(t / 170 + ph[0]) + 12 * Math.sin(t / 61 + ph[1]) + 6 * Math.sin(t / 23 + ph[2]) + r() * 5;
      const f = d / L;
      pts.push([ax + (bx - ax) * f + nx * off, ay + (by - ay) * f + ny * off]);
    }
  }
  const p = new Path2D();
  pts.forEach(([e, n], i) => i ? p.lineTo(PX(e, n), PY(e, n, 0)) : p.moveTo(PX(e, n), PY(e, n, 0)));
  p.closePath();
  return p;
})();
const WX0 = PX(bx0, by0), WX1 = PX(bx1, by1), WY0 = PY(bx0, by1, 0), WY1 = PY(bx1, by0, 0);

function pathFrom(flat, close) {
  const p = new Path2D();
  for (let i = 0; i < flat.length; i += 2) {
    const e = flat[i] / 10, n = flat[i + 1] / 10, x = PX(e, n), y = PY(e, n, 0);
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  if (close) p.closePath();
  return p;
}
function bboxOf(flat) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < flat.length; i += 2) {
    const e = flat[i] / 10, n = flat[i + 1] / 10, x = PX(e, n), y = PY(e, n, 0);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

RAW.areas.forEach((a, i) => {
  const p = new Path2D();
  a.r.forEach(r => p.addPath(pathFrom(r, true)));
  const bb = bboxOf(a.r[0]);
  AREAS.push({ ord: i, c: a.c, path: p, bb, seed: a.s, ring: a.r[0], n: a.n });
});
const ROADW = { primary: 9, secondary: 8, tertiary: 7, unclassified: 5.6, residential: 5.6, living_street: 5, pedestrian: 6, service: 3.6, track: 2.8, path: 1.3, footway: 1.5, steps: 1.5, cycleway: 2 };
RAW.waters.forEach((w, i) => LINES.push({ ord: i, t: 'water', k: w.k, path: pathFrom(w.p), bb: bboxOf(w.p), p: w.p, n: w.n }));
RAW.rails.forEach((w, i) => LINES.push({ ord: 1000 + i, t: 'rail', k: w.k, path: pathFrom(w.p), bb: bboxOf(w.p), p: w.p }));
RAW.roads.forEach((w, i) => {
  LINES.push({ ord: 2000 + i, t: 'road', k: w.k, path: pathFrom(w.p), bb: bboxOf(w.p), p: w.p, n: w.n });
  if (['secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'pedestrian', 'primary'].includes(w.k)) {
    let acc = 14 + (i % 3) * 7;
    for (let j = 2; j < w.p.length; j += 2) {
      const ae = w.p[j - 2] / 10, an = w.p[j - 1] / 10, be = w.p[j] / 10, bn = w.p[j + 1] / 10;
      const L = Math.hypot(be - ae, bn - an);
      while (acc < L) {
        const f = acc / L, side = (LAMPS.length % 2 ? 1 : -1) * (ROADW[w.k] / 2 + 0.6);
        const nx = -(bn - an) / L, ny = (be - ae) / L;
        LAMPS.push([ae + (be - ae) * f + nx * side, an + (bn - an) * f + ny * side]);
        acc += 32;
      }
      acc -= L;
    }
  }
});

/* --- buildings --- */
const signedArea = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
const NOWIN = new Set(['garage', 'garages', 'shed', 'roof', 'barn', 'ruins', 'farm_auxiliary', 'warehouse']);

function newell(P) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
function mkFace(P3, kind, center, wall) {
  let N = newell(P3);
  if (center) {
    let cx = 0, cy = 0, cz = 0; P3.forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; });
    cx /= P3.length; cy /= P3.length; cz /= P3.length;
    if (N[0] * (cx - center[0]) + N[1] * (cy - center[1]) + N[2] * (cz - center[2]) < 0) N = N.map(v => -v);
  }
  if (N[0] * VX + N[1] * VY + N[2] * VZ <= 1e-4) return null;
  const pts = new Float32Array(P3.length * 2);
  const path = new Path2D();
  P3.forEach((p, i) => { const x = PX(p[0], p[1]), y = PY(p[0], p[1], p[2]); pts[i * 2] = x; pts[i * 2 + 1] = y; i ? path.lineTo(x, y) : path.moveTo(x, y); });
  path.closePath();
  const light = Math.max(0, N[0] * SUN[0] + N[1] * SUN[1] + N[2] * SUN[2]);
  let d = 0; P3.forEach(p => d += DEP(p[0], p[1])); d /= P3.length;
  return { kind, pts, path, light, N, wall, depth: d };
}

function boxSolid(foot, z0, h, center) {      // prism from CCW footprint
  const faces = [];
  for (let i = 0; i < foot.length; i++) {
    const a = foot[i], b = foot[(i + 1) % foot.length];
    const f = mkFace([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z0 + h], [a[0], a[1], z0 + h]], 'wall', center, { a, b, z0, h });
    if (f) faces.push(f);
  }
  faces.sort((p, q) => p.depth - q.depth);
  return faces;
}
function pyramid(foot, z, hh, center) {
  const cx = foot.reduce((s, p) => s + p[0], 0) / foot.length, cy = foot.reduce((s, p) => s + p[1], 0) / foot.length;
  const faces = [];
  for (let i = 0; i < foot.length; i++) {
    const a = foot[i], b = foot[(i + 1) % foot.length];
    const f = mkFace([[a[0], a[1], z], [b[0], b[1], z], [cx, cy, z + hh]], 'roof', [cx, cy, z]);
    if (f) faces.push(f);
  }
  return faces;
}
function square(cx, cy, s, ux, uy) { // oriented square, CCW
  const vx = -uy, vy = ux, h = s / 2;
  return [[cx - ux * h - vx * h, cy - uy * h - vy * h], [cx + ux * h - vx * h, cy + uy * h - vy * h], [cx + ux * h + vx * h, cy + uy * h + vy * h], [cx - ux * h + vx * h, cy - uy * h + vy * h]];
}

const KIND_NAMES = {
  house: 'Rodinný dům', detached: 'Rodinný dům', residential: 'Obytný dům', apartments: 'Bytový dům', garage: 'Garáž', garages: 'Garáže', yes: 'Budova',
  civic: 'Veřejná budova', warehouse: 'Sklad', industrial: 'Průmyslová budova', barn: 'Stodola', farm_auxiliary: 'Hospodářská budova',
  church: 'Kostel', chapel: 'Kaple', school: 'Škola', commercial: 'Obchodní budova', train_station: 'Nádražní budova', fire_station: 'Hasičská zbrojnice',
  bell_tower: 'Zvonice', ruins: 'Zřícenina', manufacture: 'Výrobní budova', transportation: 'Dopravní budova', roof: 'Přístřešek', shed: 'Kůlna', retail: 'Obchod',
};

/* --- landmark overrides (researched) --- */
const OVR = {
  81195484: { n: 'Kostel sv. Mikuláše', style: 'church', wall: '#f0deae', roof: '#6c7272', desc: 'Pozdně barokní farní kostel bez věže z let 1781–1782 v dolní části Husova náměstí.' },
  81195353: { n: 'Radnice', style: 'townhall', wall: '#e8d39f', roof: '#7d5a4c', h: 12, lv: 3, desc: 'Neogotická radnice z roku 1864 s podélným průčelím do náměstí, štítem nad balkonem, malovanými znaky řemesel a hodinovou věží s korouhví. Sídlí v ní městský úřad.' },
  224943649: { n: 'Penny', style: 'store', wall: '#dedcd5', flat: '#b7b4ac', h: 6.2, lv: 1, desc: 'Přízemní supermarket v ulici Pivovarská.' },
  81194703: { n: 'Dům s pečovatelskou službou', style: 'hip4', rh: 2.2, wall: '#e9e2cf', roof: '#8a8784', lv: 5, desc: 'Dům s pečovatelskou službou.' },
  81196489: { n: 'Bývalá nemocnice', style: 'hipPoly', wall: '#ece3cb', roof: '#a65a44', h: 10.2, lv: 3, d: 4, poly: [[335.0, 195.6], [345.5, 177.9], [353.9, 182.9], [350.1, 189.3], [383.7, 209.3], [400.5, 181.1], [409.6, 186.5], [385.6, 225.7]], desc: 'Bývalá nemocnice, třípodlažní budova s valbovou střechou.' },
  81196460: { style: 'hip4' },
  81195159: { n: 'Střední škola', desc: 'Střední škola.' },
  81196445: { n: 'Střední škola', noLabel: true, desc: 'Střední škola, část areálu.' },
  81195046: { n: 'Základní škola T. G. Masaryka', noLabel: true, style: 'hipPoly', wall: '#ebe1c9', roof: '#a65a44', h: 12.6, lv: 3, d: 5, school: true, dome: { e: 883.5, n: -306.5, r: 3.4 }, poly: [[922.0, -338.0], [911.7, -322.0], [911.2, -314.5], [904.4, -311.0], [893.8, -295.5], [899.2, -291.9], [893.5, -283.1], [885.4, -281.5], [872.0, -261.0], [856.1, -271.4], [868.2, -290.0], [865.3, -291.9], [877.3, -303.8], [870.0, -308.6], [876.7, -318.7], [889.5, -310.4], [895.7, -319.6], [891.5, -322.3], [894.8, -330.6], [907.5, -350.1]], desc: 'Část budovy Základní školy T. G. Masaryka s kopulí na střeše.' },
  81196194: { n: 'Hasičská zbrojnice', style: 'hipPoly', h: 6.6, lv: 2, d: 4, poly: [[601.5, 215.8], [608.7, 207.2], [612.1, 210.1], [616.1, 207.1], [630.1, 190.4], [637.5, 196.6], [613.2, 225.5]], desc: 'Sbor dobrovolných hasičů Lomnice nad Popelkou.' },
  81196220: { n: 'Zimní stadion', style: 'arena', wall: '#c9d0d4', h: 8.5, lv: 1, desc: 'Kryté kluziště. Hokejová hala stojí od roku 2000, ledová plocha měří 57 × 27 m.' },
  81195508: { n: 'Kino', style: 'cinema', h: 8.2, lv: 1, corners: [[659.3, 187.0], [672.4, 197.3], [651.7, 223.4], [638.7, 213.1]], desc: 'Městské kino z roku 1953, po rekonstrukci v letech 2017–2018 s dřevěnou fasádou, vysokou věží z cortenové oceli na nároží a kavárnou s terasou.' },
  81195249: { n: 'Řemeslný pivovar', desc: 'Řemeslný pivovar v budově bývalé pekárny nedaleko náměstí. Ve vlastních prostorách vaří od roku 2019.' },
  81196127: { n: 'Tribuna', style: 'grandstand', wall: '#e6dfcc', h: 7, lv: 2, desc: 'Krytá tribuna Letního stadionu generála Ludvíka Svobody, otevřeného roku 1951. Uvnitř jsou šatny, zázemí pro sportovce a ubytování.' },
  81194966: { style: 'skip' },
  791449440: { style: 'skip' },
  207217683: { n: undefined },
  207217976: { n: 'Pohřební ústav a smuteční síň', desc: 'Pohřební ústav a smuteční síň.' },
  50751553: { n: 'Letiště', desc: 'Letiště.' },
  81194782: { n: 'Továrna Mastných', style: 'mill', wall: '#d8cbb0', roof: '#6f7275', h: 12.6, lv: 3, frame: { cx: 529.9, cy: -478.1, ang: -148 },
    blocks: [[-18, -11.5, 25.6, 13.6, 12.6, 'gable'], [-32.5, -9.2, -18, 2.6, 9.4, 'gable'], [-14.8, -17.8, -3.0, -11.5, 15.2, 'tower']],
    desc: 'Mechanická tkalcovna T. H. & V. Mastný, nejstarší dochovaný průmyslový areál v Lomnici. Postavena v letech 1854–1856, od roku 2025 kulturní památka. Areál obnovuje spolek a otevírá ho veřejnosti.' },
  81195692: { n: 'Husův sbor', style: 'husuv', wall: '#ece6d6', roof: '#7a7c7c', flat: '#b9b6ae', h: 7.6, lv: 2, desc: 'Funkcionalistický kostel Církve československé husitské od stavitele Františka Pivce (1935–1937). Věž s dvojramenným křížem a kalichem se obrací do ulice 5. května, loď je kvůli úzké parcele zalomená.' },
  81196552: { n: 'Sokolovna', style: 'blocks', wall: '#e6e0d2', roof: '#7a7c7c', h: 8.4, lv: 2, frame: { cx: 858.39, cy: 181.62, ang: 128.82 },
    blocks: [[-21.5, -12.8, -1.8, 7.5, 7.6, 'hall', 2.6], [-1.8, -16.4, 19.7, 7.5, 10.2, 'hall', 2.8], [-14.8, 7.5, 21.2, 14.7, 8.4, 'gable', 2.6], [-23.4, 7.5, -14.8, 11.4, 6.0, 'flat'], [11.2, 14.7, 15.2, 17.4, 3.6, 'flat']],
    relief: [-11.5, -2.5, 14.75, 2.6, 7.4],
    desc: 'Sokolovna otevřená roku 1898. V letech 1929–1930 k ní přibyl velký sál, tehdy největší a nejmodernější v župě. Při rekonstrukci v 70. letech dostala novou fasádu, sokolské symboly zmizely a do průčelí přibyla plastika se cvičenci.' },
  81194444: { n: 'Horákova vila', style: 'hip4', rh: 5.6, lantern: true, wall: '#efe3c3', roof: '#8a5a48', h: 7.4, lv: 2, desc: 'Pozdně secesní vila továrníka Františka Horáka (také Křížova vila) podle návrhu architekta Františka Xavera Sandera, postavená v letech 1912–1914. Na vrcholu střechy má majákovou vížku s barevnými skly, na fasádě úryvky z Čechovy básně Domov. Od roku 2013 kulturní památka.' },
  81196582: { n: 'Lovecký zámeček', style: 'chalet', h: 7.0, lv: 2, desc: 'Rohanský lovecký zámeček v Oboře, postavený v letech 1864–1868 ve stylu švýcarské alpské architektury, zřejmě podle projektu knížecího architekta Josefa Pruvota. Dřevěné průčelí vyřezal Petr Bušek. Rohanové sem jezdili na podzimní hony až do roku 1945, od roku 2012 je zámeček kulturní památkou.' },
  81194721: { n: 'Lovecký zámeček', noLabel: true, style: 'chalet', h: 5.6, lv: 2, desc: 'Část areálu Rohanského loveckého zámečku v Oboře.' },
  81194682: { n: 'Základní škola T. G. Masaryka', style: 'hipPoly', wall: '#ebe1c9', roof: '#a65a44', h: 12.6, lv: 3, d: 5, school: true, poly: [[873.1, -358.9], [863.7, -365.1], [857.8, -356.2], [847.1, -363.3], [858.1, -380.3], [893.0, -363.3], [907.5, -350.1], [899.4, -337.6], [888.4, -348.8], [885.7, -344.6], [879.2, -348.7], [860.7, -316.5], [844.7, -326.9], [859.4, -349.1], [866.4, -348.7]], desc: 'Jedna z největších školních budov v okrese, otevřená roku 1932. Dominanta Školního náměstí, v podkroví jsou od roku 2003 další učebny.' },
  81194985: { n: 'Základní škola T. G. Masaryka', noLabel: true, style: 'hipPoly', wall: '#ebe1c9', roof: '#a65a44', h: 12.6, lv: 3, d: 6, school: true, poly: [[858.2, -306.8], [842.8, -283.8], [812.3, -304.0], [811.7, -328.8], [822.6, -345.1], [860.8, -316.3]], desc: 'Část areálu Základní školy T. G. Masaryka na Školním náměstí.' },
  81195335: { n: 'Zámek', style: 'mansard', wall: '#efd699', roof: '#6c6e70', h: 8.4, lv: 2, desc: 'Barokní zámek s mansardovou střechou na horním konci Husova náměstí. Dnes v něm sídlí knihovna.' },
  81196163: { n: 'Městské muzeum', style: 'hip4', wall: '#f0e2c1', roof: '#9c5a46', h: 13, lv: 4, desc: 'Muzeum sídlí ve čtyřpodlažním novoklasicistním Šlechtově Hrubém domě na Husově náměstí.' },
  81194933: { n: 'Tylovo divadlo', style: 'theatre', wall: '#ebe5d6', flat: '#c9c4b8', h: 9.5, lv: 2, frame: { cx: 768.22, cy: 87.92, ang: -132.51 }, desc: 'Funkcionalistické divadlo architekta Oldřicha Lisky, otevřené v roce 1930. Průčelí z klinkerových cihel s velkým oknem, nižší vstupní hala s plochými střechami a markýzou, sál pod nízkou sedlovou střechou.' },
  207217667: { n: 'Dřevěná zvonice', style: 'belfry', desc: 'Hřbitovní zvonice z roku 1652, nejstarší dochovaná stavba ve městě.' },
  207218071: { n: 'Kaple sv. Jana Křtitele', style: 'mansard', wall: '#f3e5c0', roof: '#6c6e70', h: 7, lv: 1, desc: 'Barokní hřbitovní kaple z roku 1768 s mansardovou střechou.' },
};
const KARLOV = RAW.roads.filter(r => r.n === 'Karlovské náměstí').map(r => { const a = []; for (let i = 0; i < r.p.length; i += 2) a.push([r.p[i] / 10, r.p[i + 1] / 10]); return a; });
function distToLines(e, n, lines) {
  let best = 1e9;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const [ax, ay] = l[i - 1], [bx, by] = l[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((e - ax) * dx + (n - ay) * dy) / L2));
    best = Math.min(best, Math.hypot(e - ax - dx * t, n - ay - dy * t));
  }
  return best;
}
function obb(pts) {
  const Hh = hull(pts); let best = null;
  for (let i = 0; i < Hh.length; i++) {
    const a = Hh[i], b = Hh[(i + 1) % Hh.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    let mnU = 1e9, mxU = -1e9, mnV = 1e9, mxV = -1e9;
    for (const p of Hh) { const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux; mnU = Math.min(mnU, u); mxU = Math.max(mxU, u); mnV = Math.min(mnV, v); mxV = Math.max(mxV, v); }
    const area = (mxU - mnU) * (mxV - mnV);
    if (!best || area < best.area) best = { area, ux, uy, mnU, mxU, mnV, mxV };
  }
  const { ux, uy, mnU, mxU, mnV, mxV } = best, P = (u, v) => [u * ux - v * uy, u * uy + v * ux];
  return [P(mnU, mnV), P(mxU, mnV), P(mxU, mxV), P(mnU, mxV)];
}
function insetPoly(P, d) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const n1 = [-(b[1] - a[1]) / l1, (b[0] - a[0]) / l1], n2 = [-(c[1] - b[1]) / l2, (c[0] - b[0]) / l2];
    const k = Math.max(0.35, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    out.push([b[0] + (n1[0] + n2[0]) / k * d, b[1] + (n1[1] + n2[1]) / k * d]);
  }
  return out;
}
// gable / hip roof on an oriented rectangle; insetA/insetB = hip depth at each short end
function rectRoof(foot4, wallH, rh, insetA, insetB) {
  let [A, B, Cc, D] = foot4;
  if (Math.hypot(B[0] - A[0], B[1] - A[1]) < Math.hypot(Cc[0] - B[0], Cc[1] - B[1])) [A, B, Cc, D] = [B, Cc, D, A];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), W = Math.hypot(Cc[0] - B[0], Cc[1] - B[1]);
  const ux = (B[0] - A[0]) / L, uy = (B[1] - A[1]) / L;
  const mA = [(D[0] + A[0]) / 2, (D[1] + A[1]) / 2], mB = [(B[0] + Cc[0]) / 2, (B[1] + Cc[1]) / 2];
  const iA = typeof insetA === 'function' ? insetA(mA, mB, W, L) : insetA, iB = typeof insetB === 'function' ? insetB(mA, mB, W, L) : insetB;
  const RA = [mA[0] + ux * iA, mA[1] + uy * iA, wallH + rh], RB = [mB[0] - ux * iB, mB[1] - uy * iB, wallH + rh];
  const cx = (A[0] + Cc[0]) / 2, cy = (A[1] + Cc[1]) / 2;
  const faces = boxSolid([A, B, Cc, D], 0, wallH, null);
  const cen = [cx, cy, wallH];
  const add = (P, k) => { const f = mkFace(P, k, cen); if (f) faces.push(f); };
  add([[A[0], A[1], wallH], [B[0], B[1], wallH], RB, RA], 'roof');
  add([[Cc[0], Cc[1], wallH], [D[0], D[1], wallH], RA, RB], 'roof');
  add([[B[0], B[1], wallH], [Cc[0], Cc[1], wallH], RB], iB > 0.01 ? 'roof' : 'gable');
  add([[D[0], D[1], wallH], [A[0], A[1], wallH], RA], iA > 0.01 ? 'roof' : 'gable');
  return { faces, A, B, Cc, D, L, W, ux, uy, mA, mB, RA, RB, cx, cy };
}
function frustum(outer, z0, inner, z1) {
  const faces = [];
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length, a = outer[i], b = outer[j], ai = inner[i], bi = inner[j];
    const f = mkFace([[a[0], a[1], z0], [b[0], b[1], z0], [bi[0], bi[1], z1], [ai[0], ai[1], z1]], 'roof', null);
    if (f) faces.push(f);
  }
  return faces.sort((p, q) => p.depth - q.depth);
}
const projPoly = P3 => { const pts = new Float32Array(P3.length * 2), path = new Path2D(); P3.forEach((p, i) => { const x = PX(p[0], p[1]), y = PY(p[0], p[1], p[2]); pts[i * 2] = x; pts[i * 2 + 1] = y; i ? path.lineTo(x, y) : path.moveTo(x, y); }); path.closePath(); return { pts, path }; };

const MONS = [];
const SAME_AS = { 81195255: 81194342 };   // looks like Fajx Restaurant G

RAW.blds.forEach(b => {
  let foot = [];
  for (let i = 0; i < b.p.length; i += 2) foot.push([b.p[i] / 10, b.p[i + 1] / 10]);
  if (signedArea(foot) < 0) foot.reverse();
  const r = rng(SAME_AS[b.i] || b.i);
  const ov = OVR[b.i];
  let h = ov && ov.h ? ov.h : b.h;
  let cx = 0, cy = 0; foot.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= foot.length; cy /= foot.length;
  const solids = [];
  let wall = WALLS[Math.floor(r() * WALLS.length)];
  let roof = ROOFS[Math.floor(r() * ROOFS.length)];
  let flatCol = ['industrial', 'warehouse', 'manufacture', 'garage', 'garages', 'commercial', 'retail', 'roof', 'transportation'].includes(b.t) ? '#c4bfb2' : ['#bdb8ac', '#b3b1aa', '#c4bfb3', '#a9a8a3'][Math.floor(r() * 4)];
  if (['industrial', 'warehouse', 'manufacture', 'garage', 'garages'].includes(b.t)) { wall = ['#d9d4c6', '#cfcbbf', '#e0d8c3'][Math.floor(r() * 3)]; roof = '#a9a69c'; }
  if (b.t === 'barn' || b.t === 'farm_auxiliary') { wall = ['#c9a77d', '#d7c3a0', '#bb9c78'][Math.floor(r() * 3)]; }
  if (b.t === 'church' || b.t === 'chapel') { wall = '#f3ead1'; roof = '#6f7777'; }
  let style = ov ? ov.style : null;
  if (!ov && b.r === 'g' && ['house', 'residential', 'yes', 'detached'].includes(b.t) && KARLOV.length && distToLines(cx, cy, KARLOV) < 42) style = 'log';
  if (ov) { if (ov.wall) wall = ov.wall; if (ov.roof) roof = ov.roof; if (ov.flat) flatCol = ov.flat; if (ov.style === 'mansard') flatCol = ov.roof; }
  let gableCol = null, tex = null, winStyle = null;
  let peak = h;
  let lv = (ov && ov.lv) || b.l || Math.max(1, Math.round(h / 3));
  let flatRoof = b.r === 'f';

  if (style === 'church') {
    const wallH = 11;
    const east = (mA, mB) => mA[0] > mB[0];
    const rr = rectRoof(foot, wallH, 0, 0, 0);
    const rh = Math.min(rr.W * 0.6, 9);
    const R = rectRoof(foot, wallH, rh, (mA, mB, W) => (east(mA, mB) ? W * 0.5 : 0), (mA, mB, W) => (east(mA, mB) ? 0 : W * 0.5));
    // baroque front gable on the west end (seen from behind in this view)
    const westA = !east(R.mA, R.mB);
    const p0 = westA ? R.D : R.B, p1 = westA ? R.A : R.Cc;
    const top = rh + 3.6;
    const prof = [[0, 0], [0.04, 0.16], [0.16, 0.3], [0.26, 0.42], [0.31, 0.6], [0.36, 0.74], [0.42, 0.78], [0.42, 0.93], [0.5, 1], [0.58, 0.93], [0.58, 0.78], [0.64, 0.74], [0.69, 0.6], [0.74, 0.42], [0.84, 0.3], [0.96, 0.16], [1, 0]];
    const P3 = prof.map(([t, z]) => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, wallH - 0.2 + z * top]);
    const fg = projPoly(P3);
    const crossAt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, wallH - 0.2 + top];
    solids.push({ custom: true, kind: 'facade', fg, cross: crossAt, depth: (westA ? DEP(R.mA[0], R.mA[1]) : DEP(R.mB[0], R.mB[1])) - 50 });
    solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy) });
    winStyle = 'tall'; lv = 1; peak = wallH + top + 3; flatRoof = false;
  } else if (style === 'townhall') {
    const Q = [779, -97];
    // ridge parallel to the facade (long side towards the square)
    const R = rectRoof(foot, h, 7, (mA, mB, W) => W * 0.22, (mA, mB, W) => W * 0.22);
    solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy) });
    const ring = [R.A, R.B, R.Cc, R.D];
    let best = null;
    for (let i = 0; i < 4; i++) {
      const a = ring[i], c = ring[(i + 1) % 4], L = Math.hypot(c[0] - a[0], c[1] - a[1]), nx = (c[1] - a[1]) / L, ny = -(c[0] - a[0]) / L;
      const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], sc = nx * (Q[0] - m[0]) + ny * (Q[1] - m[1]);
      if (!best || sc > best.sc) best = { sc, a, c, L, m, nx, ny, ux: (c[0] - a[0]) / L, uy: (c[1] - a[1]) / L };
    }
    // neo-Gothic gable over the balcony, in the facade plane
    const fe = (t, z) => [best.m[0] + best.ux * t + best.nx * 0.35, best.m[1] + best.uy * t + best.ny * 0.35, z];
    const gw = 3.6, gh = 6.2;
    const prof = [[-gw, -0.2], [-gw, 1.9], [-gw + 0.5, 1.9], [-gw + 0.5, 0.9], [0, gh], [gw - 0.5, 0.9], [gw - 0.5, 1.9], [gw, 1.9], [gw, -0.2]];
    const gable = projPoly(prof.map(([t, z]) => fe(t, h + z)));
    const gwin = projPoly([[-0.9, 1.0], [0.9, 1.0], [0.9, 2.6], [0, 3.6], [-0.9, 2.6]].map(([t, z]) => fe(t, h + z)));
    const shields = [];
    for (let i = 0; i < 10; i++) { const t = (-0.44 + i * 0.88 / 9) * best.L; if (Math.abs(t) < gw * 0.6) continue; shields.push(t); }
    solids.push({ draw: 'thGable', gable, gwin, fe, shields, z0: h, depth: DEP(R.cx, R.cy) + 0.3 });
    // clock tower on the ridge
    const tcx = (R.RA[0] + R.RB[0]) / 2, tcy = (R.RA[1] + R.RB[1]) / 2, zr = R.RA[2];
    const s = 3.4, zb = zr - 2.5, TH = 7.2;
    const tf = boxSolid(square(tcx, tcy, s, R.ux, R.uy), zb, TH, null);
    const cornice = frustum(square(tcx, tcy, s + 0.6, R.ux, R.uy), zb + TH, square(tcx, tcy, s + 0.2, R.ux, R.uy), zb + TH + 0.4);
    const spire = pyramid(square(tcx, tcy, s + 0.2, R.ux, R.uy), zb + TH + 0.4, 6.5, null);
    solids.push({ faces: tf.concat(cornice, spire), depth: DEP(R.cx, R.cy) + 0.6, clock: zb + TH - 1.6, vane: [tcx, tcy, zb + TH + 6.9], wallCol: wall, roofCol: '#6f7777', noWin: true });
    peak = zb + TH + 10; flatRoof = false;
  } else if (style === 'theatre') {
    const F = ov.frame, ca = Math.cos(F.ang * Math.PI / 180), sa = Math.sin(F.ang * Math.PI / 180);
    const L2W = (u, v) => [F.cx + u * ca - v * sa, F.cy + u * sa + v * ca];
    const rect = (u0, v0, u1, v1) => [L2W(u0, v0), L2W(u1, v0), L2W(u1, v1), L2W(u0, v1)];
    const ctr = (u, v) => { const p = L2W(u, v); return DEP(p[0], p[1]); };
    const flatBox = (rc, z0, hh, extra = {}) => {
      const fs = boxSolid(rc, z0, hh, null), tp = projPoly(rc.map(p => [p[0], p[1], z0 + hh]));
      fs.push({ kind: 'flat', pts: tp.pts, path: tp.path, light: SUN[2], N: [0, 0, 1] });
      return Object.assign({ faces: fs, noWin: true }, extra);
    };
    // stage end and side annex (rear)
    solids.push(Object.assign(flatBox(rect(-5.1, -23.9, 3.9, -19.5), 0, 8.5), { depth: ctr(0, -21.7) }));
    solids.push(Object.assign(flatBox(rect(-9.8, -19.7, -6.6, -16.2), 0, 4.2), { depth: ctr(-8, -18) }));
    // auditorium: plastered hall under a low gable roof
    const hall = rectRoof(rect(-6.6, -19.5, 6.4, 5.5), 9.5, 2.4, 0, 0);
    solids.push({ faces: hall.faces, depth: ctr(0, -7), roofCol: '#6f7372' });
    // street facade: clinker brick grid around a large window, rising above the hall
    const fu0 = -7.0, fu1 = 6.8, fv = 5.6, fz = 13.2;
    const fpt = (u, z) => { const p = L2W(u, fv); return [PX(p[0], p[1]), PY(p[0], p[1], z)]; };
    const fq = (u0, z0, u1, z1) => { const pth = new Path2D(); [fpt(u0, z0), fpt(u1, z0), fpt(u1, z1), fpt(u0, z1)].forEach((q, i) => i ? pth.lineTo(q[0], q[1]) : pth.moveTo(q[0], q[1])); pth.closePath(); return pth; };
    const fw = [L2W(fu0, fv), L2W(fu1, fv)];
    const ff = mkFace([[fw[0][0], fw[0][1], 0], [fw[1][0], fw[1][1], 0], [fw[1][0], fw[1][1], fz], [fw[0][0], fw[0][1], fz]], 'wall', null, null)
      || mkFace([[fw[1][0], fw[1][1], 0], [fw[0][0], fw[0][1], 0], [fw[0][0], fw[0][1], fz], [fw[1][0], fw[1][1], fz]], 'wall', null, null);
    solids.push({ draw: 'thFacade', ff, fpt, fq, fu0, fu1, fz, depth: ctr(0, 5.6) });
    // entrance hall: flat roofs stepping down to both sides, canopy over the door
    solids.push(Object.assign(flatBox(rect(-10.6, 5.6, -4.6, 17.8), 0, 4.6), { depth: ctr(-7.6, 11.7), entrance: true }));
    solids.push(Object.assign(flatBox(rect(7.0, 5.6, 13.0, 15.4), 0, 4.6), { depth: ctr(10, 10.5), entrance: true }));
    solids.push(Object.assign(flatBox(rect(-4.6, 5.6, 7.0, 17.8), 0, 6.6), { depth: ctr(1.2, 11.7), entrance: true, door: true }));
    solids.push(Object.assign(flatBox(rect(-3.4, 17.8, 5.8, 20.0), 3.3, 0.35), { depth: ctr(1.2, 18.9) + 0.5 }));
    peak = fz + 1; flatRoof = false; winStyle = 'tall';
  } else if (style === 'arena') {
    const R4 = obb(foot);
    const R = rectRoof(R4, h, 4.2, 0, 0);
    solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy), tex: 'panels', ribbon: true, noWin: true, roofCol: '#9aa3a8' });
    peak = h + 4.2; flatRoof = false;
  } else if (style === 'cinema') {
    const [c0, c1, c2, c3] = ov.corners;   // c0-c1: south-east front, c1-c2 and c3-c0 long sides
    const len = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
    const ue = [(c2[0] - c1[0]) / len, (c2[1] - c1[1]) / len];
    const at = (p, u) => [p[0] + ue[0] * u, p[1] + ue[1] * u];
    const quad = (u0, u1) => { const q = [at(c0, u0), at(c1, u0), at(c1, u1), at(c0, u1)]; if (signedArea(q) < 0) q.reverse(); return q; };
    const box = (q, z0, hh, extra) => {
      const fs = boxSolid(q, z0, hh, null), tp = projPoly(q.map(p => [p[0], p[1], z0 + hh]));
      fs.push({ kind: 'flat', pts: tp.pts, path: tp.path, light: SUN[2], N: [0, 0, 1] });
      const mc = q.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
      return Object.assign({ faces: fs, depth: DEP(mc[0], mc[1]), noWin: true }, extra);
    };
    solids.push(box(quad(8, len), 0, 8.2, { tex: 'boards', wallCol: '#b98a5c', roofCol: '#6e7173' }));
    solids.push(box(quad(0, 8), 0, 4.8, { tex: 'boards', wallCol: '#c49466', roofCol: '#6e7173', foyer: true }));
    // corten corner tower and entrance canopy
    const tn = [-(c1[0] - c0[0]), -(c1[1] - c0[1])].map(v => v / Math.hypot(c1[0] - c0[0], c1[1] - c0[1]));
    const tc = [c1[0] + ue[0] * 1.2 - ue[0] * 2.6 + tn[0] * -1.3, c1[1] + ue[1] * 1.2 - ue[1] * 2.6 + tn[1] * -1.3];
    const sq = square(tc[0], tc[1], 2.6, ue[0], ue[1]);
    solids.push(box(sq, 0, 11.5, { wallCol: '#9c5330', roofCol: '#8a4a2c', corten: true }));
    const can = [at(c0, -3.2), at(c1, -3.2), at(c1, 0), at(c0, 0)].map((p, i) => i === 0 || i === 3 ? [p[0] + (c1[0] - c0[0]) * 0.25, p[1] + (c1[1] - c0[1]) * 0.25] : p);
    if (signedArea(can) < 0) can.reverse();
    solids.push(box(can, 3.6, 0.45, { wallCol: '#9c5330', roofCol: '#94502e', corten: true }));
    // café terrace in front of the foyer
    const deck = [at(c0, -6.5), at(c1, -6.5), at(c1, -0.3), at(c0, -0.3)].map((p, i) => i === 0 || i === 3 ? [p[0] + (c1[0] - c0[0]) * 0.3, p[1] + (c1[1] - c0[1]) * 0.3] : p);
    const dp = projPoly(deck.map(p => [p[0], p[1], 0.05]));
    solids.unshift({ draw: 'deck', dp, depth: -1e9 });
    peak = 12.5; flatRoof = false;
  } else if (style === 'skip') {
    return;
  } else if (style === 'grandstand') {
    // two-storey base with rooms, raked seating towards the pitch and a sloping roof over everything
    const walls = boxSolid(foot, 0, 7, null);
    const tp = projPoly(foot.map(p => [p[0], p[1], 7]));
    walls.push({ kind: 'flat', pts: tp.pts, path: tp.path, light: SUN[2], N: [0, 0, 1] });
    solids.push({ faces: walls, depth: DEP(cx, cy) });
    const Bk = [[776.3, 606.1], [773.7, 645.1]], Fr = [[784.0, 604.0], [780.8, 645.7]];
    const stand = mkFace([[Fr[0][0], Fr[0][1], 1.0], [Fr[1][0], Fr[1][1], 1.0], [Bk[1][0], Bk[1][1], 7.0], [Bk[0][0], Bk[0][1], 7.0]], 'roof', [770, 625, 0]);
    const ends = [mkFace([[Fr[0][0], Fr[0][1], 0], [Fr[0][0], Fr[0][1], 1.0], [Bk[0][0], Bk[0][1], 7.0], [Bk[0][0], Bk[0][1], 0]], 'wall', [778, 625, 3]), mkFace([[Fr[1][0], Fr[1][1], 0], [Bk[1][0], Bk[1][1], 0], [Bk[1][0], Bk[1][1], 7.0], [Fr[1][0], Fr[1][1], 1.0]], 'wall', [778, 625, 3])].filter(Boolean);
    const front = mkFace([[Fr[0][0], Fr[0][1], 0], [Fr[1][0], Fr[1][1], 0], [Fr[1][0], Fr[1][1], 1.0], [Fr[0][0], Fr[0][1], 1.0]], 'wall', [770, 625, 0]);
    solids.push({ faces: ends.concat(front ? [front] : []), depth: DEP(780, 625) + 0.5, wallCol: '#d9d4c8', noWin: true });
    if (stand) solids.push({ draw: 'stand', stand, Fr, Bk, depth: DEP(780, 625) + 0.6 });
    const RB = [[764.0, 603.0], [761.5, 648.5]], RF = [[786.5, 602.0], [783.0, 648.5]];
    const roofTop = mkFace([[RF[0][0], RF[0][1], 10.0], [RF[1][0], RF[1][1], 10.0], [RB[1][0], RB[1][1], 11.2], [RB[0][0], RB[0][1], 11.2]], 'roof', [775, 625, 0]);
    const fascia = mkFace([[RF[0][0], RF[0][1], 9.6], [RF[1][0], RF[1][1], 9.6], [RF[1][0], RF[1][1], 10.0], [RF[0][0], RF[0][1], 10.0]], 'wall', [775, 625, 10]);
    solids.push({ draw: 'posts', posts: [0.08, 0.36, 0.64, 0.92].map(t => [RF[0][0] + (RF[1][0] - RF[0][0]) * t - 0.8, RF[0][1] + (RF[1][1] - RF[0][1]) * t]), depth: DEP(780, 625) + 0.7 });
    solids.push({ faces: [roofTop, fascia].filter(Boolean), depth: DEP(780, 625) + 0.8, roofCol: '#8f9496', wallCol: '#e6e2d8', noWin: true });
    peak = 12; flatRoof = false;
  } else if (style === 'mill') {
    const F = ov.frame, ca = Math.cos(F.ang * Math.PI / 180), sa = Math.sin(F.ang * Math.PI / 180);
    const L2W = (u, v) => [F.cx + u * ca - v * sa, F.cy + u * sa + v * ca];
    for (const [u0, v0, u1, v1, hh, roofKind] of ov.blocks) {
      const q = [L2W(u0, v0), L2W(u1, v0), L2W(u1, v1), L2W(u0, v1)];
      if (signedArea(q) < 0) q.reverse();
      const W = Math.min(u1 - u0, v1 - v0);
      if (roofKind === 'tower') {
        const fs = boxSolid(q, 0, hh, null).concat(pyramid(q, hh, 3.2, null));
        solids.push({ faces: fs, depth: DEP(...L2W((u0 + u1) / 2, (v0 + v1) / 2)), roofCol: '#6f7275' });
        peak = Math.max(peak, hh + 3.2);
      } else {
        const R = rectRoof(q, hh, Math.min(W * 0.32, 7), 0, 0);
        solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy) });
        peak = Math.max(peak, hh + Math.min(W * 0.32, 7));
      }
    }
    // company name painted along the main facade
    const s0 = L2W(-11, 13.6), s1 = L2W(19, 13.6);
    solids.push({ draw: 'sign', a: s0, b: s1, z: ov.h - 1.0, text: 'T. H. & V. MASTNÝ · MECHANICKÁ TKALCOVNA', depth: DEP(...L2W(4, 14)) + 50 });
    winStyle = 'mill'; flatRoof = false;
  } else if (style === 'husuv') {
    // front block towards ulice 5. května, dominant tower, nave bent away by about 40°
    const front = [[734.6, 173.3], [739.5, 176.4], [748.5, 172.2], [749.2, 171.0], [748.9, 169.8], [747.0, 166.0], [747.7, 165.2], [743.2, 161.8], [741.2, 164.6], [739.2, 163.1], [734.8, 169.1], [736.7, 170.6]];
    if (signedArea(front) < 0) front.reverse();
    const fw = boxSolid(front, 0, 7.6, null), ft = projPoly(front.map(p => [p[0], p[1], 7.6]));
    fw.push({ kind: 'flat', pts: ft.pts, path: ft.path, light: SUN[2], N: [0, 0, 1] });
    solids.push({ faces: fw, depth: DEP(742, 169) });
    const nave = [[739.5, 176.4], [748.5, 172.2], [755.5, 189.8], [746.8, 193.4]];
    const R = rectRoof(nave, 6.4, 1.6, 0, 0);
    solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy), winTall: true });
    const ux = 0.59, uy = -0.81, tcx = 740.6, tcy = 165.4, TH = 19;
    const tw = boxSolid(square(tcx, tcy, 4.0, ux, uy), 0, TH, null), tt = projPoly(square(tcx, tcy, 4.0, ux, uy).map(p => [p[0], p[1], TH]));
    tw.push({ kind: 'flat', pts: tt.pts, path: tt.path, light: SUN[2], N: [0, 0, 1] });
    solids.push({ faces: tw, depth: DEP(tcx, tcy) + 3, noWin: true, slits: true, hussCross: [tcx, tcy, TH] });
    peak = TH + 4; flatRoof = false;
  } else if (style === 'blocks') {
    const F = ov.frame, ca = Math.cos(F.ang * Math.PI / 180), sa = Math.sin(F.ang * Math.PI / 180);
    const L2W = (u, v) => [F.cx + u * ca - v * sa, F.cy + u * sa + v * ca];
    for (const [u0, v0, u1, v1, hh, kind, rh0] of ov.blocks) {
      const q = [L2W(u0, v0), L2W(u1, v0), L2W(u1, v1), L2W(u0, v1)];
      if (signedArea(q) < 0) q.reverse();
      const mc = L2W((u0 + u1) / 2, (v0 + v1) / 2);
      if (kind === 'flat') {
        const fs = boxSolid(q, 0, hh, null), tp = projPoly(q.map(p => [p[0], p[1], hh]));
        fs.push({ kind: 'flat', pts: tp.pts, path: tp.path, light: SUN[2], N: [0, 0, 1] });
        solids.push({ faces: fs, depth: DEP(mc[0], mc[1]), noWin: hh < 4.5 });
        peak = Math.max(peak, hh);
      } else {
        const R = rectRoof(q, hh, rh0, 0, 0);
        solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy), tallWin: kind === 'hall' });
        peak = Math.max(peak, hh + rh0);
      }
    }
    if (ov.relief) {
      const [ru0, ru1, rv, rz0, rz1] = ov.relief;
      solids.push({ draw: 'relief', a: L2W(ru0, rv), b: L2W(ru1, rv), z0: rz0, z1: rz1, depth: DEP(...L2W((ru0 + ru1) / 2, rv)) + 30 });
    }
    flatRoof = false;
  } else if (style === 'chalet') {
    // Swiss-chalet hunting lodge: plastered ground floor, timbered upper floor, wide overhanging gable roof, carved galleries
    const parts = [];
    if (b.parts) b.parts.forEach(pf => { const q = []; for (let i = 0; i < pf.length; i += 2) q.push([pf[i] / 10, pf[i + 1] / 10]); parts.push(q); });
    else parts.push(obb(foot));
    for (const q0 of parts) {
      const q = q0.slice(); if (signedArea(q) < 0) q.reverse();
      const W = Math.min(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]));
      const qc = q.reduce((s2, p) => [s2[0] + p[0] / 4, s2[1] + p[1] / 4], [0, 0]), dep = DEP(qc[0], qc[1]);
      const zf = Math.min(3.3, h * 0.48), rh = Math.min(W * 0.42, 5.5);
      solids.push({ faces: boxSolid(q, 0, zf, null), depth: dep, wallCol: '#e9ddc0' });
      solids.push({ faces: boxSolid(q, zf, h - zf, null), depth: dep + 0.01, wallCol: '#8f5f3d', tex: 'boards', gallery: zf });
      const R = rectRoof(insetPoly(q, -1.3), h, rh, 0, 0);
      solids.push({ faces: R.faces.filter(f => f.kind !== 'wall'), depth: dep + 0.02, roofCol: '#6c5a4c', wallCol: '#8f5f3d', tex: 'boards', barge: true });
      peak = Math.max(peak, h + rh);
    }
    flatRoof = false;
  } else if (style === 'hipPoly') {
    const base = ov.poly.slice();
    if (signedArea(base) < 0) base.reverse();
    const walls = boxSolid(base, 0, h, null);
    const inner = insetPoly(base, ov.d);
    const rf = frustum(base, h, inner, h + ov.d * 0.95);
    rf.forEach(f => f.mans = true);
    const top = projPoly(inner.map(p => [p[0], p[1], h + ov.d * 0.95]));
    solids.push({ faces: walls.concat(rf).sort((p, q) => p.depth - q.depth).concat([{ kind: 'flat', pts: top.pts, path: top.path, light: SUN[2], N: [0, 0, 1] }]), depth: DEP(cx, cy) });
    peak = h + ov.d; flatRoof = false; flatCol = roof;
    if (ov.dome) { solids.push({ draw: 'dome', dome: { e: ov.dome.e, n: ov.dome.n, z: h + ov.d * 0.95, r: ov.dome.r }, depth: DEP(ov.dome.e, ov.dome.n) + 40 }); peak = h + ov.d + 9; }
  } else if (style === 'hip4') {
    const R4 = obb(foot);
    const W = Math.min(Math.hypot(R4[1][0] - R4[0][0], R4[1][1] - R4[0][1]), Math.hypot(R4[2][0] - R4[1][0], R4[2][1] - R4[1][1]));
    const R = rectRoof(R4, h, ov.rh || Math.min(W * 0.42, 7), (mA, mB, W2) => W2 * 0.5, (mA, mB, W2) => W2 * 0.5);
    solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy) });
    peak = h + (ov.rh || 7); flatRoof = false;
    if (ov.lantern) {
      const lc = [(R.RA[0] + R.RB[0]) / 2, (R.RA[1] + R.RB[1]) / 2], z0 = R.RA[2] - 0.3, rr = 1.05, N8 = 8;
      const ring = (rad, z) => { const a2 = []; for (let i = 0; i < N8; i++) { const t = (i + 0.5) / N8 * Math.PI * 2; a2.push([lc[0] + Math.cos(t) * rad, lc[1] + Math.sin(t) * rad, z]); } return a2; };
      const lo = ring(rr, z0), hi = ring(rr, z0 + 1.9), panes = [];
      for (let i = 0; i < N8; i++) { const j = (i + 1) % N8, f = mkFace([lo[i], lo[j], hi[j], hi[i]], 'wall', [lc[0], lc[1], z0 + 1]); if (f) { f.ci = i; panes.push(f); } }
      panes.sort((p, q) => p.depth - q.depth);
      const cap = []; for (let i = 0; i < N8; i++) { const j = (i + 1) % N8, f = mkFace([ring(rr + 0.25, z0 + 1.9)[i], ring(rr + 0.25, z0 + 1.9)[j], [lc[0], lc[1], z0 + 3.0]], 'roof', [lc[0], lc[1], z0 + 1.9]); if (f) cap.push(f); }
      solids.push({ draw: 'lantern', panes, cap, top: [lc[0], lc[1], z0 + 3.0], depth: DEP(R.cx, R.cy) + 20 });
      peak = h + (ov.rh || 7) + 3.5;
    }
  } else if (style === 'mansard') {
    const base = b.r === 'f' ? foot : foot;
    const walls = boxSolid(base, 0, h, null);
    const m1 = 3.4, d1 = 1.5;
    const inner = insetPoly(base, d1);
    const mf = frustum(base, h, inner, h + m1);
    mf.forEach(f => f.mans = true);
    const top = projPoly(inner.map(p => [p[0], p[1], h + m1]));
    const inner2 = insetPoly(inner, 1.2);
    const cap = frustum(inner, h + m1, inner2, h + m1 + 0.9);
    const top2 = projPoly(inner2.map(p => [p[0], p[1], h + m1 + 0.9]));
    solids.push({ faces: walls.concat(mf).sort((p, q) => p.depth - q.depth).concat(cap, [{ kind: 'flat', pts: top2.pts, path: top2.path, light: SUN[2], N: [0, 0, 1] }]), depth: DEP(cx, cy) });
    peak = h + m1 + 1; flatRoof = false;
  } else if (style === 'belfry') {
    const R4 = obb(foot);
    const ux0 = R4[1][0] - R4[0][0], uy0 = R4[1][1] - R4[0][1], l0 = Math.hypot(ux0, uy0), ux = ux0 / l0, uy = uy0 / l0;
    const bcx = (R4[0][0] + R4[2][0]) / 2, bcy = (R4[0][1] + R4[2][1]) / 2;
    const s = Math.max(4, Math.min(6.5, l0, Math.hypot(R4[2][0] - R4[1][0], R4[2][1] - R4[1][1])));
    const sq = k => square(bcx, bcy, s * k, ux, uy);
    solids.push({ faces: boxSolid(sq(1), 0, 5.4, null), depth: DEP(bcx, bcy), wallCol: '#8b6b4b', tex: 'boards', noWin: true });
    solids.push({ faces: frustum(sq(1.32), 5.4, sq(0.74), 7.2), depth: DEP(bcx, bcy) + 0.01, roofCol: '#6f655c' });
    solids.push({ faces: boxSolid(sq(0.74), 7.2, 3.3, null), depth: DEP(bcx, bcy) + 0.02, wallCol: '#7a5b40', tex: 'boards', open: true, noWin: true });
    solids.push({ faces: pyramid(sq(0.9), 10.5, 6.4, null), depth: DEP(bcx, bcy) + 0.03, roofCol: '#6f655c', cross: [bcx, bcy, 16.9] });
    peak = 19.5; flatRoof = false;
  } else if (b.r === 'm' && !style) {
    // several wings, each with its own saddle roof
    b.parts.forEach((pf, k) => {
      let part = []; for (let i = 0; i < pf.length; i += 2) part.push([pf[i] / 10, pf[i + 1] / 10]);
      if (signedArea(part) < 0) part.reverse();
      const W = Math.min(Math.hypot(part[1][0] - part[0][0], part[1][1] - part[0][1]), Math.hypot(part[2][0] - part[1][0], part[2][1] - part[1][1]));
      const rh = Math.min(W * ((b.t === 'barn' || b.t === 'farm_auxiliary') ? 0.42 : 0.5), 8);
      const R = rectRoof(part, h, rh, 0, 0);
      solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy) });
      peak = Math.max(peak, h + rh);
    });
    flatRoof = false;
  } else if (flatRoof || style === 'store') {
    const walls = boxSolid(foot, 0, h, null);
    const tp = projPoly(foot.map(p => [p[0], p[1], h]));
    walls.push({ kind: 'flat', pts: tp.pts, path: tp.path, light: SUN[2], N: [0, 0, 1] });
    solids.push({ faces: walls, depth: DEP(cx, cy) });
  } else {
    const W = (() => { const [A, B, Cc] = foot; return Math.min(Math.hypot(B[0] - A[0], B[1] - A[1]), Math.hypot(Cc[0] - B[0], Cc[1] - B[1])); })();
    let rh = Math.min(W * 0.5, 8);
    if (b.t === 'barn' || b.t === 'farm_auxiliary') rh = Math.min(W * 0.42, 6);
    if (style === 'log') { rh = Math.min(W * 0.62, 7.5); wall = ['#7d5c40', '#86654a', '#6f523a'][Math.floor(r() * 3)]; gableCol = '#a5835a'; roof = ['#6c665e', '#77706a'][Math.floor(r() * 2)]; tex = 'log'; winStyle = 'log'; }
    const hipD = (mA, mB, W2, L) => (b.r === 'h' ? Math.min(W2 / 2, L / 2 - 0.5) : 0);
    const R = rectRoof(foot, h, rh, hipD, hipD);
    solids.push({ faces: R.faces, depth: DEP(R.cx, R.cy), ridge: [R.RA, R.RB] });
    peak = h + rh;
    if (b.sp === 'turret' && !ov) {
      const [RA, RB] = [R.RA, R.RB];
      const tx = (RA[0] + RB[0]) / 2, ty = (RA[1] + RB[1]) / 2, zt = RA[2] - 1.2;
      const l = Math.hypot(RB[0] - RA[0], RB[1] - RA[1]) || 1, ux = (RB[0] - RA[0]) / l || 1, uy = (RB[1] - RA[1]) / l || 0;
      solids.push({ faces: boxSolid(square(tx, ty, 2.4, ux, uy), zt, 3.2, null).concat(pyramid(square(tx, ty, 3, ux, uy), zt + 3.2, 3.2, null)), depth: DEP(tx, ty) + 0.02, roofCol: '#7fa294', noWin: true });
      peak = zt + 6.4;
    }
  }
  // bbox
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  foot.forEach(p => {
    const X = PX(p[0], p[1]), Yb = PY(p[0], p[1], 0), Yt = PY(p[0], p[1], peak);
    x0 = Math.min(x0, X - 3); x1 = Math.max(x1, X + 3); y0 = Math.min(y0, Yt); y1 = Math.max(y1, Yb);
  });
  const sh = peak * 0.55, sdx = -SUN[0] / Math.hypot(SUN[0], SUN[1]) * sh, sdy = -SUN[1] / Math.hypot(SUN[0], SUN[1]) * sh;
  const sp = hull(foot.concat(foot.map(p => [p[0] + sdx, p[1] + sdy])));
  const shadow = new Path2D(); sp.forEach((p, i) => i ? shadow.lineTo(PX(p[0], p[1]), PY(p[0], p[1], 0)) : shadow.moveTo(PX(p[0], p[1]), PY(p[0], p[1], 0))); shadow.closePath();
  sp.forEach(p => { const X = PX(p[0], p[1]), Y = PY(p[0], p[1], 0); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); });
  solids.sort((a, b2) => a.depth - b2.depth);
  BLDS.push({
    type: 'b', id: b.i, t: b.t, n: ov ? ov.n : b.n, noLabel: ov && ov.noLabel, k: ov ? 'landmark' : b.k, desc: ov && ov.desc, lv, h, wall, roof, gableCol, tex, winStyle, solids, shadow,
    depth: DEP(cx, cy), bb: [x0, y0, x1, y1], e: cx, nn: cy, peak, win: (ov && ov.style === 'mill') || (!NOWIN.has(b.t) && h >= 3),
    roofSnow: !flatRoof, flatCol, style,
  });
});

/* --- monuments --- */
(function () {
  const add = (name, kind) => {
    const p = RAW.pois.find(q => q.n === name); if (!p) return;
    const e = p.x / 10, n = p.y / 10, X = PX(e, n), Y = PY(e, n, 0);
    const H = kind === 'plague' ? 11 : kind === 'hus' ? 6.5 : 4;
    MONS.push({ type: 'm', kind, e, n, X, Y, depth: DEP(e, n), bb: [X - 5, Y - H * ZK - 3, X + 5, Y + 4], name });
  };
  add('Morový sloup', 'plague');
  add('Mistr Jan Hus', 'hus');
  add('Svatý Jan Nepomucký', 'statue');
})();
function hull(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}

/* --- trees --- */
const T = RAW.trees;
for (let i = 0; i < T.length; i += 3) {
  const e = T[i], n = T[i + 1], k = T[i + 2];
  const s = hash(i * 7919 + 13);
  const r = rng(s);
  const size = k === 1 ? 9 + r() * 7 : k === 3 ? 1.6 + r() * 1.2 : 2.6 + r() * 1.9;
  const X = PX(e, n), Y = PY(e, n, 0);
  const hgt = k === 1 ? size : k === 3 ? size * 1.6 : size * 2 + 2.6;
  TREES.push({ type: 't', e, nn: n, k, s, size, X, Y, depth: DEP(e, n), bb: [X - 6, Y - hgt * ZK - 3, X + 7, Y + 3] });
}

/* ---------- spatial grid ---------- */
const CELL = 256;
function Grid() { this.m = new Map(); }
Grid.prototype.add = function (o) {
  const [x0, y0, x1, y1] = o.bb;
  for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
    for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
      const k = gx * 100000 + gy; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(o);
    }
};
let stampN = 1;
Grid.prototype.query = function (x0, y0, x1, y1) {
  const out = [], st = ++stampN;
  for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
    for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
      const a = this.m.get(gx * 100000 + gy); if (!a) continue;
      for (const o of a) {
        if (o._st === st) continue; o._st = st;
        if (o.bb[2] < x0 || o.bb[0] > x1 || o.bb[3] < y0 || o.bb[1] > y1) continue;
        out.push(o);
      }
    }
  return out;
};
const GA = new Grid(), GL = new Grid(), GO = new Grid();
/* --- school sports ground behind ZŠ T. G. Masaryka: running oval, football pitch, tennis courts --- */
(function () {
  const O = [797.3, -310.4], U = [0.567, -0.824], V = [-0.853, -0.505];
  const L = (u, v) => [O[0] + U[0] * u + V[0] * v, O[1] + U[1] * u + V[1] * v];
  const P2 = (u, v) => { const p = L(u, v); return [PX(p[0], p[1]), PY(p[0], p[1], 0)]; };
  const poly = pts => { const p = new Path2D(); pts.forEach(([u, v], i) => { const q = P2(u, v); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); }); p.closePath(); return p; };
  const line = (u0, v0, u1, v1) => { const a = P2(u0, v0), b = P2(u1, v1); return [a[0], a[1], b[0], b[1]]; };
  const cu = 62, cv = 20, Ls = 32;
  const stadium = R => { const pts = []; for (let i = 0; i <= 20; i++) { const a = -Math.PI / 2 + i / 20 * Math.PI; pts.push([cu + Ls / 2 + Math.cos(a) * R, cv + Math.sin(a) * R]); } for (let i = 0; i <= 20; i++) { const a = Math.PI / 2 + i / 20 * Math.PI; pts.push([cu - Ls / 2 + Math.cos(a) * R, cv + Math.sin(a) * R]); } return pts; };
  const stadiumPath = R => poly(stadium(R));
  const track = new Path2D(); track.addPath(stadiumPath(18.2)); track.addPath(stadiumPath(13));
  const infield = stadiumPath(13);
  const lanes = [14.3, 15.6, 16.9].map(stadiumPath);
  const rectPath = (u0, v0, u1, v1) => poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  const field = { u0: cu - 21, u1: cu + 21, v0: cv - 11, v1: cv + 11 };
  const courtsBase = rectPath(1, 3, 26, 37);
  const courts = [[2, 13], [14, 25]];
  const corners = [P2(0, 0), P2(98, 0), P2(98, 40), P2(0, 40)];
  const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
  const obj = { ord: 1e6, c: 'sportground', custom: true, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], ring: [] };
  obj.draw = () => {
    const winter = season === 'winter', r = rng(777);
    const tint = h => winter ? rgb(mix(col(h).c, night ? [60, 66, 90] : [236, 240, 242], 0.65)) : col(h).s;
    const white = night ? 'rgba(205,215,235,.55)' : winter ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.92)';
    ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
    // running track
    wash(track, tint('#ad5a47'), 0.92, r, 1.2, 'evenodd');
    // infield grass with mowing stripes
    wash(infield, tint('#9fc46a'), 0.9, r, 0.8);
    ctx.globalCompositeOperation = 'source-over';
    if (SC >= 0.9 && !winter) {
      ctx.save(); ctx.clip(infield); ctx.globalAlpha = night ? 0.1 : 0.22; ctx.fillStyle = night ? '#9fb0c8' : '#e6f0c8';
      for (let u = cu - 31; u < cu + 31; u += 8) ctx.fill(rectPath(u, 0, u + 4, 40));
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (SC >= 0.8) {
      ctx.strokeStyle = white; ctx.lineWidth = PXU * 0.9; lanes.forEach(p => ctx.stroke(p));
      // football pitch markings
      const f = field, segs = [
        line(f.u0, f.v0, f.u1, f.v0), line(f.u1, f.v0, f.u1, f.v1), line(f.u1, f.v1, f.u0, f.v1), line(f.u0, f.v1, f.u0, f.v0),
        line(cu, f.v0, cu, f.v1),
        line(f.u0, cv - 6, f.u0 + 7, cv - 6), line(f.u0 + 7, cv - 6, f.u0 + 7, cv + 6), line(f.u0 + 7, cv + 6, f.u0, cv + 6),
        line(f.u1, cv - 6, f.u1 - 7, cv - 6), line(f.u1 - 7, cv - 6, f.u1 - 7, cv + 6), line(f.u1 - 7, cv + 6, f.u1, cv + 6),
      ];
      ctx.strokeStyle = white; ctx.lineWidth = PXU * 1.1; ctx.beginPath();
      for (const [x0, y0, x1, y1] of segs) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      const circ = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; circ.push(P2(cu + Math.cos(a) * 4.5, cv + Math.sin(a) * 4.5)); }
      circ.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
      ctx.stroke();
      // goals
      for (const gu of [f.u0 - 0.8, f.u1 + 0.8]) { const a = P2(gu, cv - 2.5), b = P2(gu, cv + 2.5); ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 2.3); ctx.lineTo(b[0], b[1] - 2.3); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    // tennis courts (clay)
    ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
    wash(courtsBase, tint('#cf7b4e'), 0.9, r, 1);
    ctx.globalCompositeOperation = 'source-over';
    if (SC >= 0.8) {
      const segs = [];
      for (const [a, b] of courts) {
        const v0 = 8, v1 = 32, vm = 20, s0 = a + 1.4, s1 = b - 1.4, mid = (a + b) / 2;
        segs.push(line(a, v0, b, v0), line(b, v0, b, v1), line(b, v1, a, v1), line(a, v1, a, v0));
        segs.push(line(s0, v0, s0, v1), line(s1, v0, s1, v1));
        segs.push(line(s0, vm - 6.4, s1, vm - 6.4), line(s0, vm + 6.4, s1, vm + 6.4), line(mid, vm - 6.4, mid, vm + 6.4));
      }
      ctx.strokeStyle = white; ctx.lineWidth = PXU * 0.9; ctx.beginPath();
      for (const [x0, y0, x1, y1] of segs) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      ctx.stroke();
      // nets
      ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.1;
      for (const [a, b] of courts) { const p = P2(a - 0.5, 20), q = P2(b + 0.5, 20); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 1.1); ctx.lineTo(q[0], q[1] - 1.1); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      // fence
      ctx.setLineDash([PXU * 3, PXU * 2]); ctx.strokeStyle = inkC(0.55); ctx.lineWidth = PXU * 0.9; ctx.stroke(courtsBase); ctx.setLineDash([]);
    }
    ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.9;
    ctx.stroke(stadiumPath(18.2));
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  // no trees on the track, pitch or courts
  for (let i = TREES.length - 1; i >= 0; i--) {
    const t = TREES[i], de = t.e - O[0], dn = t.nn - O[1], u = de * U[0] + dn * U[1], v = de * V[0] + dn * V[1];
    if (u > -2 && u < 100 && v > -2 && v < 42) TREES.splice(i, 1);
  }
  // hide the generic soccer pitch that sits inside the new infield
  AREAS.forEach(a => { if (a.c !== 'pitch') return; const r = a.ring; let e = 0, n = 0; for (let i = 0; i < r.length; i += 2) { e += r[i] / 10; n += r[i + 1] / 10; } e /= r.length / 2; n /= r.length / 2; if (Math.hypot(e - 815.4, n + 373.4) < 8) a.hidden = true; });
  AREAS.push(obj);
})();
/* --- bus station: surface, platforms, shelters and parked buses --- */
const XOBJ = [];
(function () {
  const ST = [[640.7, 149.1], [662.6, 169.5], [764.1, 76.4], [736.1, 43.5]];
  const P1 = [[722.7, 89.5], [682.3, 132.9]], P2 = [[719.2, 111.1], [678.0, 155.4]];
  const dl = Math.hypot(P1[1][0] - P1[0][0], P1[1][1] - P1[0][1]);
  const A = [(P1[1][0] - P1[0][0]) / dl, (P1[1][1] - P1[0][1]) / dl], N = [A[1], -A[0]];   // N points north-east (towards platform 2)
  const pr = (e, n, z = 0) => [PX(e, n), PY(e, n, z)];
  const pathOf = (pts, z = 0) => { const p = new Path2D(); pts.forEach(([e, n], i) => { const q = pr(e, n, z); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); }); p.closePath(); return p; };
  const island = (L, w) => { const [a, b] = L; return [[a[0] - N[0] * w - A[0] * 1, a[1] - N[1] * w - A[1] * 1], [b[0] - N[0] * w + A[0] * 1, b[1] - N[1] * w + A[1] * 1], [b[0] + N[0] * w + A[0] * 1, b[1] + N[1] * w + A[1] * 1], [a[0] + N[0] * w - A[0] * 1, a[1] + N[1] * w - A[1] * 1]]; };
  const isl = [island(P1, 1.7), island(P2, 1.7)];
  const surface = pathOf(ST);
  const islTop = isl.map(p => pathOf(p, 0.2)), islBase = isl.map(p => pathOf(p, 0));
  const lanes = [P1, P2].map(([a, b]) => [[a[0] + N[0] * 4.9, a[1] + N[1] * 4.9], [b[0] + N[0] * 4.9, b[1] + N[1] * 4.9]]);
  const xs = ST.map(p => PX(p[0], p[1])), ys = ST.map(p => PY(p[0], p[1], 0));
  AREAS.push({
    ord: 1e6 + 1, c: 'busstation', custom: true, ring: [], bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    draw() {
      const r = rng(4242), winter = season === 'winter';
      ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
      wash(surface, winter ? '#e2e2de' : '#cbc8c0', 0.85, r, 1);
      ctx.globalCompositeOperation = 'source-over';
      if (SC >= 0.8) {
        ctx.setLineDash([PXU * 5, PXU * 4]); ctx.strokeStyle = night ? 'rgba(210,215,230,.45)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = PXU * 1;
        ctx.beginPath(); lanes.forEach(([a, b]) => { const p = pr(...a), q = pr(...b); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }); ctx.stroke(); ctx.setLineDash([]);
      }
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = col(winter ? '#cfcfca' : '#9b978e').s; ctx.fill(islBase[i]);
        washFace(islTop[i], winter ? '#f1f2f2' : '#dcd7cb', 1, r);
        ctx.strokeStyle = inkC(0.7); ctx.lineWidth = PXU * 0.9; ctx.stroke(islTop[i]);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  });
  // no trees on the station
  for (let i = TREES.length - 1; i >= 0; i--) { const t = TREES[i]; const de = t.e - 640.7, dn = t.nn - 149.1; const u = de * -A[0] + dn * -A[1], v = de * N[0] + dn * N[1]; if (u > -70 && u < 5 && v > -8 && v < 30 && pip(PX(t.e, t.nn), PY(t.e, t.nn, 0), new Float32Array(ST.flatMap(p => [PX(p[0], p[1]), PY(p[0], p[1], 0)])))) TREES.splice(i, 1); }

  const mkObj = (e, n, rad, hgt, draw, shadowR) => { const X = PX(e, n), Y = PY(e, n, 0); return { type: 'x', e, nn: n, X, Y, depth: DEP(e, n), bb: [X - rad, Y - hgt * ZK - 3, X + rad, Y + rad * S + 2], draw, shadowR }; };
  // shelters at the numbered stops
  const stops = [[717, 96, 1], [700, 114, 2], [682, 133, 3], [719, 111, 4], [703, 129, 5], [685, 148, 6]];
  stops.forEach(([e, n, k]) => {
    const L = k <= 3 ? P1 : P2, a = L[0];
    const t = (e - a[0]) * A[0] + (n - a[1]) * A[1];
    const ce = a[0] + A[0] * t - N[0] * 0.5, cn = a[1] + A[1] * t - N[1] * 0.5;
    const foot = [[ce - A[0] * 2 - N[0] * 0.7, cn - A[1] * 2 - N[1] * 0.7], [ce + A[0] * 2 - N[0] * 0.7, cn + A[1] * 2 - N[1] * 0.7], [ce + A[0] * 2 + N[0] * 0.7, cn + A[1] * 2 + N[1] * 0.7], [ce - A[0] * 2 + N[0] * 0.7, cn - A[1] * 2 + N[1] * 0.7]];
    if (signedArea(foot) < 0) foot.reverse();
    const walls = boxSolid(foot, 0.2, 2.5, null), roofP = projPoly(insetPoly(foot, -0.25).map(p => [p[0], p[1], 2.75]));
    XOBJ.push(mkObj(ce, cn, 4, 3.2, function () {
      if (SC < 0.8) return;
      const r = rng(k * 99);
      for (const f of walls) {
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = night ? 'rgba(120,140,170,.35)' : 'rgba(170,200,215,.45)'; ctx.fill(f.path);
        ctx.strokeStyle = inkC(0.75); ctx.lineWidth = PXU * 0.8; ctx.stroke(f.path);
      }
      washFace(roofP.path, '#6f7377', 0.9, r); ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.9; ctx.stroke(roofP.path);
      if (night) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(this.X, this.Y - 2, 0, this.X, this.Y - 2, 6); g.addColorStop(0, 'rgba(255,230,170,.4)'); g.addColorStop(1, 'rgba(255,230,170,0)'); ctx.fillStyle = g; ctx.fillRect(this.X - 6, this.Y - 8, 12, 12); ctx.globalCompositeOperation = 'source-over'; }
      if (SC >= 2.2) { const q = pr(ce + N[0] * 0.9, cn + N[1] * 0.9, 3.4); ctx.font = '700 1.3px Caveat, cursive'; ctx.textAlign = 'center'; ctx.lineWidth = PXU * 3; ctx.strokeStyle = night ? 'rgba(25,28,45,.9)' : 'rgba(248,242,226,.95)'; ctx.strokeText(String(k), q[0], q[1]); ctx.fillStyle = night ? '#f3ead6' : '#3a2f25'; ctx.fillText(String(k), q[0], q[1]); }
    }, 0));
  });
  // buses waiting at platforms 1, 5 and the drop-off stop
  const BUSCOL = [['#f2efe6', '#3f6f9a'], ['#efe2a8', '#2f5f7a'], ['#e9ecef', '#b4483a']];
  const buses = [[P1, 8, 0], [P2, 26, 1], [[[736, 70], [728, 79]], 0, 2]];
  buses.forEach(([L, along, ci], bi) => {
    const a = L[0];
    const ce = a[0] + A[0] * (along + 6) + N[0] * 3.4, cn = a[1] + A[1] * (along + 6) + N[1] * 3.4;
    const hl = 6, hw = 1.27;
    const foot = [[ce - A[0] * hl - N[0] * hw, cn - A[1] * hl - N[1] * hw], [ce + A[0] * hl - N[0] * hw, cn + A[1] * hl - N[1] * hw], [ce + A[0] * hl + N[0] * hw, cn + A[1] * hl + N[1] * hw], [ce - A[0] * hl + N[0] * hw, cn - A[1] * hl + N[1] * hw]];
    if (signedArea(foot) < 0) foot.reverse();
    const body = boxSolid(foot, 0.35, 2.85, null);
    const top = projPoly(insetPoly(foot, 0.15).map(p => [p[0], p[1], 3.2]));
    const [cBody, cStripe] = BUSCOL[ci];
    XOBJ.push(mkObj(ce, cn, 8, 3.4, function () {
      if (SC < 0.45) return;
      const r = rng(500 + bi);
      for (const f of body) {
        washFace(f.path, cBody, 0.55 + 0.45 * Math.min(1, f.light * 1.6), r);
        const { a: wa, b: wb, z0 } = f.wall, len = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
        const band = (t0, t1, za, zb, fill) => { const q = [wpt(wa, wb, t0, za), wpt(wa, wb, t1, za), wpt(wa, wb, t1, zb), wpt(wa, wb, t0, zb)]; ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
        if (SC >= 0.8) {
          band(0, 1, z0 + 0.25, z0 + 0.6, col(cStripe).s);
          if (len > 5) { band(0.03, 0.97, z0 + 1.15, z0 + 2.35, night ? '#ffe2a0' : '#5e6f7a'); if (SC >= 1.6) { const segs = []; for (let t = 0.03 + 1.3 / len; t < 0.97; t += 1.3 / len) { const p = wpt(wa, wb, t, z0 + 1.15), q = wpt(wa, wb, t, z0 + 2.35); segs.push([p[0], p[1], q[0], q[1]]); } lineSet(segs, 0.5, 0.7); } }
          else band(0.08, 0.92, z0 + 0.9, z0 + 2.45, night ? '#3a4458' : '#7f929c');
          if (len > 5) for (const tw of [0.18, 0.78]) { const c = wpt(wa, wb, tw, 0.45); ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.5, 0.48 * ZK, 0, 0, Math.PI * 2); ctx.fillStyle = '#2b2622'; ctx.fill(); }
        }
        ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.9; ctx.stroke(f.path);
      }
      washFace(top.path, cBody, 1, r); ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.9; ctx.stroke(top.path);
    }, 2.5));
  });
})();
/* --- park between the bus station and Tylovo divadlo --- */
(function () {
  const RING = [[780.5, 93.7], [778.6, 94.0], [776.6, 92.0], [771.3, 96.7], [770.6, 98.5], [768.8, 100.0], [767.3, 100.2], [763.4, 103.9], [764.6, 107.0], [761.3, 110.2], [759.3, 110.2], [757.2, 107.8], [754.7, 109.7], [752.8, 109.3], [746.3, 102.4], [746.0, 100.6], [748.3, 98.0], [748.4, 95.5], [764.6, 80.9], [765.1, 79.3], [764.2, 78.3], [665.6, 168.8], [691.0, 190.3], [721.9, 150.8], [734.5, 138.2], [783.4, 93.6], [787.3, 87.5]];
  const O = [665.6, 168.8], A = [0.736, -0.677], N = [0.677, 0.736];
  const L = (a, c) => [O[0] + A[0] * a + N[0] * c, O[1] + A[1] * a + N[1] * c];
  const pr = (e, n) => [PX(e, n), PY(e, n, 0)];
  const ringPath = new Path2D(); RING.forEach(([e, n], i) => { const q = pr(e, n); i ? ringPath.lineTo(q[0], q[1]) : ringPath.moveTo(q[0], q[1]); }); ringPath.closePath();
  const ringFlat = new Float32Array(RING.flatMap(([e, n]) => pr(e, n)));
  const inPark = (e, n) => { const q = pr(e, n); return pip(q[0], q[1], ringFlat); };
  // paths: a winding main walk from Pivovarská towards the theatre, a cross path and a small round plaza
  const curve = (pts, steps = 12) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let s = 0; s < steps; s++) { const t = s / steps, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))); } } out.push(pts[pts.length - 1]); return out; };
  const main = curve([[4, 16], [30, 19], [58, 12], [84, 9], [104, 14], [118, 9]]).map(([a, c]) => L(a, c));
  const cross = curve([[58, -1], [58, 12], [61, 26]]).map(([a, c]) => L(a, c));
  const plaza = L(58, 12);
  const toPath = pts => { const p = new Path2D(); pts.forEach(([e, n], i) => { const q = pr(e, n); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); }); return p; };
  const mainP = toPath(main), crossP = toPath(cross);
  const circ = (cx, cy, rad) => { const p = new Path2D(); for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI * 2, q = pr(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); } p.closePath(); return p; };
  const plazaP = circ(plaza[0], plaza[1], 5.5), bedP = circ(plaza[0], plaza[1], 2.4);
  const benches = [[50, 15.5], [66, 7.5], [92, 12.5], [28, 21.5]].map(([a, c]) => L(a, c));
  const near = (e, n, pts, d) => pts.some((p, i) => i && (() => { const [ax, ay] = pts[i - 1], [bx, by] = p, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((e - ax) * dx + (n - ay) * dy) / l2)); return Math.hypot(e - ax - dx * t, n - ay - dy * t) < d; })());
  const xs = RING.map(p => PX(p[0], p[1])), ys = RING.map(p => PY(p[0], p[1], 0));
  AREAS.push({
    ord: 1e6 + 2, c: 'park2', custom: true, ring: [], bb: [Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2],
    draw() {
      const pal = P(), r = rng(9191), winter = season === 'winter';
      ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
      wash(ringPath, pal.park, 0.9, r, 0.9);
      ctx.globalCompositeOperation = 'source-over';
      const gravel = col(winter ? '#e6e4dd' : '#ecdcb4').s;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = inkC(0.45); ctx.lineWidth = 3.0 + PXU * 1.6; ctx.stroke(mainP); ctx.stroke(crossP);
      ctx.fillStyle = inkC(0.45); ctx.save(); ctx.translate(0, 0); ctx.fill(circ(plaza[0], plaza[1], 5.5 + PXU)); ctx.restore();
      ctx.strokeStyle = gravel; ctx.lineWidth = 3.0; ctx.stroke(mainP); ctx.stroke(crossP);
      ctx.fillStyle = gravel; ctx.fill(plazaP);
      if (SC >= 0.8) {
        ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
        ctx.fillStyle = col(winter ? '#e9ecea' : '#9cbf6a').s; ctx.fill(bedP);
        ctx.globalCompositeOperation = 'source-over';
        if (!winter && season !== 'autumn') { const fl = ['#e2706a', '#f2c94c', '#f4f0f6', '#c76fa8']; for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 2.1, q = pr(plaza[0] + Math.cos(a) * d, plaza[1] + Math.sin(a) * d); ctx.fillStyle = fl[i % 4]; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(PXU * 1.2, 0.18), 0, 6.28); ctx.fill(); } }
        ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.8; ctx.stroke(bedP);
        // benches
        for (const [e, n] of benches) { const q = pr(e, n); ctx.fillStyle = night ? '#4a3d32' : '#8a6644'; ctx.fillRect(q[0] - 0.9, q[1] - 0.9, 1.8, 0.55); ctx.strokeStyle = inkC(0.7); ctx.lineWidth = PXU * 0.7; ctx.strokeRect(q[0] - 0.9, q[1] - 0.9, 1.8, 0.55); }
      }
      ctx.globalAlpha = 1;
    },
  });
  // replace the scattered garden trees with park trees that keep off the paths
  for (let i = TREES.length - 1; i >= 0; i--) if (inPark(TREES[i].e, TREES[i].nn)) TREES.splice(i, 1);
  const r = rng(31337);
  for (let a = 2; a < 125; a += 7) for (let c = 1; c < 34; c += 7) {
    const aa = a + (r() - .5) * 4, cc = c + (r() - .5) * 4, [e, n] = L(aa, cc);
    if (!inPark(e, n) || near(e, n, main, 3.6) || near(e, n, cross, 3.4) || Math.hypot(e - plaza[0], n - plaza[1]) < 8.5 || r() < 0.35) continue;
    const k = r() < 0.3 ? 2 : (r() < 0.12 ? 1 : 0), s = hash(Math.round(e * 10) * 7 + Math.round(n * 10)), rr = rng(s);
    const size = k === 1 ? 9 + rr() * 6 : 2.8 + rr() * 1.8, X = PX(e, n), Y = PY(e, n, 0), hgt = k === 1 ? size : size * 2 + 2.6;
    TREES.push({ type: 't', e, nn: n, k, s, size, X, Y, depth: DEP(e, n), bb: [X - 6, Y - hgt * ZK - 3, X + 7, Y + 3] });
  }
})();
/* --- Letní stadion generála Ludvíka Svobody: athletics oval with six lanes, main pitch, artificial-turf pitch, five tennis courts, basketball --- */
(function () {
  const pr = (e, n, z = 0) => [PX(e, n), PY(e, n, z)];
  const frame = (C0, U, V) => ({ P: (u, v) => pr(C0[0] + U[0] * u + V[0] * v, C0[1] + U[1] * u + V[1] * v), W: (u, v) => [C0[0] + U[0] * u + V[0] * v, C0[1] + U[1] * u + V[1] * v] });
  const polyP = (F, pts) => { const p = new Path2D(); pts.forEach(([u, v], i) => { const q = F.P(u, v); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); }); p.closePath(); return p; };
  const rectP = (F, u0, v0, u1, v1) => polyP(F, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  const seg = (F, u0, v0, u1, v1) => { const a = F.P(u0, v0), b = F.P(u1, v1); return [a[0], a[1], b[0], b[1]]; };
  const strokeSegs = (segs, style, w) => { ctx.strokeStyle = style; ctx.lineWidth = PXU * w; ctx.beginPath(); for (const [a, b, c, d] of segs) { ctx.moveTo(a, b); ctx.lineTo(c, d); } ctx.stroke(); };
  const circleP = (F, cu, cv, rad, a0 = 0, a1 = Math.PI * 2) => { const p = new Path2D(); for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24, q = F.P(cu + Math.cos(a) * rad, cv + Math.sin(a) * rad); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); } return p; };
  const pitchMarks = (F, cu, cv, L, Wd) => {
    const u0 = cu - L / 2, u1 = cu + L / 2, v0 = cv - Wd / 2, v1 = cv + Wd / 2;
    const s = [seg(F, u0, v0, u1, v0), seg(F, u1, v0, u1, v1), seg(F, u1, v1, u0, v1), seg(F, u0, v1, u0, v0), seg(F, cu, v0, cu, v1)];
    for (const [ua, dir] of [[u0, 1], [u1, -1]]) {
      s.push(seg(F, ua, cv - 20, ua + dir * 16.5, cv - 20), seg(F, ua + dir * 16.5, cv - 20, ua + dir * 16.5, cv + 20), seg(F, ua + dir * 16.5, cv + 20, ua, cv + 20));
      s.push(seg(F, ua, cv - 9, ua + dir * 5.5, cv - 9), seg(F, ua + dir * 5.5, cv - 9, ua + dir * 5.5, cv + 9), seg(F, ua + dir * 5.5, cv + 9, ua, cv + 9));
    }
    return s;
  };
  const goals = (F, cu, cv, L) => { for (const gu of [cu - L / 2 - 0.6, cu + L / 2 + 0.6]) { const a = F.P(gu, cv - 3.7), b = F.P(gu, cv + 3.7); ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 2.4 * ZK); ctx.lineTo(b[0], b[1] - 2.4 * ZK); ctx.lineTo(b[0], b[1]); ctx.stroke(); } };
  const objs = [];
  const add = (pts, draw) => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); objs.push({ ord: 1e6 + 10 + objs.length, c: 'stadium', custom: true, ring: [], bb: [Math.min(...xs) - 4, Math.min(...ys) - 6, Math.max(...xs) + 4, Math.max(...ys) + 4], draw }); };
  const white = () => night ? 'rgba(205,215,235,.55)' : season === 'winter' ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.92)';
  const tint = h => season === 'winter' ? rgb(mix(col(h).c, night ? [60, 66, 90] : [236, 240, 242], 0.65)) : col(h).s;
  const blend = () => { ctx.globalCompositeOperation = night ? 'source-over' : 'multiply'; };
  const normal = () => { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; };

  // athletics oval (OSM outline of the main ground) with the main football pitch inside
  const OF = frame([839.5, 628.0], [-0.087, 0.996], [0.996, 0.087]);
  const HS = 39.5;
  const stad = R => { const p = []; for (let i = 0; i <= 22; i++) { const a = -Math.PI / 2 + i / 22 * Math.PI; p.push([HS + Math.cos(a) * R, Math.sin(a) * R]); } for (let i = 0; i <= 22; i++) { const a = Math.PI / 2 + i / 22 * Math.PI; p.push([-HS + Math.cos(a) * R, Math.sin(a) * R]); } return p; };
  const ROUT = 40.5, RIN = 33.2;
  const trackP = new Path2D(); trackP.addPath(polyP(OF, stad(ROUT))); trackP.addPath(polyP(OF, stad(RIN)));
  const infieldP = polyP(OF, stad(RIN));
  const terrP = new Path2D(); terrP.addPath(polyP(OF, stad(47.5))); terrP.addPath(polyP(OF, stad(ROUT + 0.3)));
  const laneP = [1, 2, 3, 4, 5].map(k => polyP(OF, stad(RIN + k * 1.22)));
  const terrL = [42.5, 44.2, 45.9].map(R => polyP(OF, stad(R)));
  add(stad(48).map(([u, v]) => OF.P(u, v)), () => {
    const r = rng(1951);
    blend(); wash(terrP, tint('#a9bd74'), 0.8, r, 0.6, 'evenodd'); normal();
    if (SC >= 1.0) { ctx.strokeStyle = inkC(0.22); ctx.lineWidth = PXU * 0.8; terrL.forEach(p => ctx.stroke(p)); }
    blend(); wash(trackP, tint('#a8604a'), 0.92, r, 1.2, 'evenodd'); wash(infieldP, tint('#97bf62'), 0.9, r, 0.8); normal();
    if (SC >= 0.9 && season !== 'winter') { ctx.save(); ctx.clip(infieldP); ctx.globalAlpha = night ? 0.1 : 0.22; ctx.fillStyle = night ? '#9fb0c8' : '#e6f0c8'; for (let u = -75; u < 75; u += 10) ctx.fill(rectP(OF, u, -40, u + 5, 40)); ctx.restore(); ctx.globalAlpha = 1; }
    if (SC >= 0.8) {
      ctx.strokeStyle = white(); ctx.lineWidth = PXU * 0.8; laneP.forEach(p => ctx.stroke(p));
      strokeSegs(pitchMarks(OF, 0, 0, 100, 62), white(), 1.1);
      ctx.strokeStyle = white(); ctx.lineWidth = PXU * 1.1; ctx.stroke(circleP(OF, 0, 0, 9.15));
      goals(OF, 0, 0, 100);
    }
    ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.9; ctx.stroke(polyP(OF, stad(ROUT)));
  });

  // artificial-turf pitch (opened 2013)
  const AF = frame([875.1, 730.0], [0.379, -0.925], [0.926, 0.379]);
  const afP = rectP(AF, 0, 0, 111.4, 72.9);
  add([[0, 0], [111.4, 0], [111.4, 72.9], [0, 72.9]].map(([u, v]) => AF.P(u, v)), () => {
    const r = rng(2013);
    blend(); wash(afP, tint('#6fae58'), 0.92, r, 1); normal();
    if (SC >= 0.8) { strokeSegs(pitchMarks(AF, 55.7, 36.45, 102, 64), white(), 1.1); ctx.strokeStyle = white(); ctx.lineWidth = PXU * 1.1; ctx.stroke(circleP(AF, 55.7, 36.45, 9.15)); goals(AF, 55.7, 36.45, 102); ctx.setLineDash([PXU * 3, PXU * 2]); ctx.strokeStyle = inkC(0.5); ctx.lineWidth = PXU * 0.9; ctx.stroke(afP); ctx.setLineDash([]); }
  });

  // five clay tennis courts
  const TF = frame([680.8, 646.6], [0.724, 0.690], [0.691, -0.722]);
  const tbase = rectP(TF, 0, 0, 84.8, 35.3);
  add([[0, 0], [84.8, 0], [84.8, 35.3], [0, 35.3]].map(([u, v]) => TF.P(u, v)), () => {
    const r = rng(1367);
    blend(); wash(tbase, tint('#cf7b4e'), 0.9, r, 1); normal();
    if (SC >= 0.8) {
      const s = [];
      for (let i = 0; i < 5; i++) {
        const cu = 84.8 / 5 * (i + 0.5), a = cu - 5.485, b = cu + 5.485, sa = cu - 4.115, sb = cu + 4.115, v0 = 17.65 - 11.885, v1 = 17.65 + 11.885;
        s.push(seg(TF, a, v0, b, v0), seg(TF, b, v0, b, v1), seg(TF, b, v1, a, v1), seg(TF, a, v1, a, v0), seg(TF, sa, v0, sa, v1), seg(TF, sb, v0, sb, v1), seg(TF, sa, 17.65 - 6.4, sb, 17.65 - 6.4), seg(TF, sa, 17.65 + 6.4, sb, 17.65 + 6.4), seg(TF, cu, 17.65 - 6.4, cu, 17.65 + 6.4));
      }
      strokeSegs(s, white(), 0.9);
      ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.1;
      for (let i = 0; i < 5; i++) { const cu = 84.8 / 5 * (i + 0.5), p = TF.P(cu - 6.4, 17.65), q = TF.P(cu + 6.4, 17.65); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 1.1); ctx.lineTo(q[0], q[1] - 1.1); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.setLineDash([PXU * 3, PXU * 2]); ctx.strokeStyle = inkC(0.55); ctx.lineWidth = PXU * 0.9; ctx.stroke(tbase); ctx.setLineDash([]);
    }
  });

  // two asphalt basketball courts
  [[[789.2, 522.3], [801.1, 533.4], [769.8, 543.0]], [[824.2, 506.0], [822.2, 534.1], [808.4, 504.9]]].forEach(([c0, c1, c3], k) => {
    const lu = Math.hypot(c3[0] - c0[0], c3[1] - c0[1]), lv = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    const F = frame(c0, [(c3[0] - c0[0]) / lu, (c3[1] - c0[1]) / lu], [(c1[0] - c0[0]) / lv, (c1[1] - c0[1]) / lv]);
    const base = rectP(F, 0, 0, lu, lv);
    add([[0, 0], [lu, 0], [lu, lv], [0, lv]].map(([u, v]) => F.P(u, v)), () => {
      const r = rng(88 + k);
      washFace(base, season === 'winter' ? '#e4e4e0' : '#a9a7a1', 1, r); normal();
      if (SC >= 1.0) {
        const m = 1.2, s = [seg(F, m, m, lu - m, m), seg(F, lu - m, m, lu - m, lv - m), seg(F, lu - m, lv - m, m, lv - m), seg(F, m, lv - m, m, m), seg(F, lu / 2, m, lu / 2, lv - m)];
        strokeSegs(s, white(), 0.9);
        ctx.strokeStyle = white(); ctx.lineWidth = PXU * 0.9; ctx.stroke(circleP(F, lu / 2, lv / 2, 1.8));
        ctx.stroke(circleP(F, m, lv / 2, 6, -Math.PI / 2, Math.PI / 2)); ctx.stroke(circleP(F, lu - m, lv / 2, 6, Math.PI / 2, Math.PI * 1.5));
        ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.1;
        for (const hu of [0.4, lu - 0.4]) { const p = F.P(hu, lv / 2); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 3.05 * ZK); ctx.stroke(); ctx.fillStyle = '#e8e4da'; ctx.fillRect(p[0] - 0.9, p[1] - 3.9 * ZK, 1.8, 1.05 * ZK); ctx.strokeRect(p[0] - 0.9, p[1] - 3.9 * ZK, 1.8, 1.05 * ZK); }
        ctx.setLineDash([PXU * 3, PXU * 2]); ctx.strokeStyle = inkC(0.5); ctx.lineWidth = PXU * 0.8; ctx.stroke(base); ctx.setLineDash([]);
      }
    });
  });

  // hide the generic pitches these replace and keep trees off the playing surfaces
  const hideNear = [[839, 628], [929.9, 692.2], [723.7, 663.1], [785.4, 538.2], [815.3, 519.5]];
  AREAS.forEach(a => { if (a.c !== 'pitch') return; const rr = a.ring; let e = 0, n = 0; for (let i = 0; i < rr.length; i += 2) { e += rr[i] / 10; n += rr[i + 1] / 10; } e /= rr.length / 2; n /= rr.length / 2; if (hideNear.some(([x, y]) => Math.hypot(e - x, n - y) < 12)) a.hidden = true; });
  const inside = (e, n) => {
    const d = (F0, U0, V0, lu, lv) => { const de = e - F0[0], dn = n - F0[1], u = de * U0[0] + dn * U0[1], v = de * V0[0] + dn * V0[1]; return u > -3 && u < lu + 3 && v > -3 && v < lv + 3; };
    const de = e - 839.5, dn = n - 628, u = de * -0.087 + dn * 0.996, v = de * 0.996 + dn * 0.087;
    const du = Math.max(0, Math.abs(u) - HS);
    return Math.hypot(du, v) < 48 || d([875.1, 730.0], [0.379, -0.925], [0.926, 0.379], 111.4, 72.9) || d([680.8, 646.6], [0.724, 0.690], [0.691, -0.722], 84.8, 35.3);
  };
  for (let i = TREES.length - 1; i >= 0; i--) if (inside(TREES[i].e, TREES[i].nn)) TREES.splice(i, 1);
  objs.forEach(o => AREAS.push(o));
})();
/* --- K70 ski jump with the chalice-shaped observation gallery (2007) --- */
(function () {
  const TW = [-942.0, -152.6];                       // tower (OSM node)
  const TO = [-1027.9, -144.3];                      // take-off edge
  const ST = [-947.5, -152.0];                       // start of the in-run beside the tower
  const pr = (e, n, z) => [PX(e, n), PY(e, n, z)];
  const LAND = [[-1049.2, -134.5], [-1027.7, -141.8], [-1027.9, -144.3], [-1028.2, -146.8], [-1050.7, -149.9], [-1147.0, -138.1], [-1145.1, -122.3]];
  const LA = [(-1146 - TO[0]) / 118.8, (-130 - TO[1]) / 118.8], LN = [-LA[1], LA[0]];
  // landing hill markings
  const landP = new Path2D(); LAND.forEach(([e, n], i) => { const q = pr(e, n, 0); i ? landP.lineTo(q[0], q[1]) : landP.moveTo(q[0], q[1]); }); landP.closePath();
  const lx = LAND.map(p => PX(p[0], p[1])), ly = LAND.map(p => PY(p[0], p[1], 0));
  AREAS.push({
    ord: 1e6 + 30, c: 'jumpland', custom: true, ring: [], bb: [Math.min(...lx) - 2, Math.min(...ly) - 2, Math.max(...lx) + 2, Math.max(...ly) + 2],
    draw() {
      const r = rng(70), winter = season === 'winter';
      ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
      wash(landP, winter ? '#f2f4f5' : '#93b862', 0.9, r, 0.8);
      ctx.globalCompositeOperation = 'source-over';
      if (SC < 0.8) return;
      ctx.save(); ctx.clip(landP);
      for (let d = 35; d <= 100; d += 5) {
        const c = [TO[0] + LA[0] * d, TO[1] + LA[1] * d], a = pr(c[0] + LN[0] * 14, c[1] + LN[1] * 14, 0), b = pr(c[0] - LN[0] * 14, c[1] - LN[1] * 14, 0);
        ctx.strokeStyle = d === 70 ? (night ? '#d98a7c' : '#c0392b') : (winter ? 'rgba(80,110,160,.35)' : 'rgba(255,255,255,.55)');
        ctx.lineWidth = PXU * (d === 70 ? 2.2 : 0.9); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
    },
  });
  // in-run: raised deck on posts, falling from the start beside the tower to the take-off table
  const N = 16, len = Math.hypot(TO[0] - ST[0], TO[1] - ST[1]), U = [(TO[0] - ST[0]) / len, (TO[1] - ST[1]) / len], W = [-U[1], U[0]];
  const zAt = t => 3.2 + 19.3 * Math.pow(1 - t, 1.55);
  const pts = []; for (let i = 0; i <= N; i++) { const t = i / N; pts.push([ST[0] + U[0] * len * t, ST[1] + U[1] * len * t, zAt(t)]); }
  const side = W[1] < 0 ? 1 : -1;   // edge facing the viewer (south)
  const edge = (k, dz = 0) => pts.map(([e, n, z]) => pr(e + W[0] * 1.6 * k, n + W[1] * 1.6 * k, z + dz));
  const mk = arr => { const p = new Path2D(); arr.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); return p; };
  const topL = edge(-side), topR = edge(side), botR = edge(side, -1.0);
  const deckTop = mk(topL.concat(topR.slice().reverse())); deckTop.closePath();
  const deckSide = mk(topR.concat(botR.slice().reverse())); deckSide.closePath();
  const grooves = [-0.55, 0.55].map(o => mk(pts.map(([e, n, z]) => pr(e + W[0] * o, n + W[1] * o, z + 0.02))));
  const allx = topL.concat(topR).map(q => q[0]), ally = topL.concat(topR).map(q => q[1]);
  const mid = pts[N >> 1];
  XOBJ.push({
    type: 'x', e: mid[0], nn: mid[1], X: PX(mid[0], mid[1]), Y: PY(mid[0], mid[1], 0), depth: DEP(mid[0], mid[1]) - 3,
    bb: [Math.min(...allx) - 3, Math.min(...ally) - 3, Math.max(...allx) + 3, PY(mid[0], mid[1], 0) + 25],
    draw() {
      if (SC < 0.35) return;
      const r = rng(707), winter = season === 'winter';
      // posts
      ctx.strokeStyle = inkC(0.75); ctx.lineWidth = PXU * 1.2; ctx.beginPath();
      for (let i = 1; i < N; i += 2) { const [e, n, z] = pts[i]; for (const k of [-1, 1]) { const a = pr(e + W[0] * 1.3 * k, n + W[1] * 1.3 * k, 0), b = pr(e + W[0] * 1.3 * k, n + W[1] * 1.3 * k, z - 0.9); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } }
      ctx.stroke();
      if (SC >= 1) { ctx.strokeStyle = inkC(0.35); ctx.lineWidth = PXU * 0.7; ctx.beginPath(); for (let i = 1; i < N - 1; i += 2) { const [e, n, z] = pts[i], [e2, n2, z2] = pts[i + 2]; const a = pr(e + W[0] * 1.3 * side, n + W[1] * 1.3 * side, 0.3), b = pr(e2 + W[0] * 1.3 * side, n2 + W[1] * 1.3 * side, z2 - 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); }
      washFace(deckSide, '#9ba1a5', 0.6, r); ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.9; ctx.stroke(deckSide);
      washFace(deckTop, winter ? '#f3f5f6' : '#d6d3cb', 1, r); ctx.stroke(deckTop);
      if (SC >= 1) { ctx.strokeStyle = winter ? 'rgba(120,140,170,.5)' : inkC(0.4); ctx.lineWidth = PXU * 0.8; grooves.forEach(g => ctx.stroke(g)); }
    },
  });
  // observation tower: steel shaft with stairs and a chalice-shaped gallery at 28 m
  const SEG = 18, R0 = 1.9, R1 = 7.1, Z0 = 21.4, Z1 = 28.06, ZR = 29.2;
  const ring = (rad, z) => { const a = []; for (let i = 0; i < SEG; i++) { const t = i / SEG * Math.PI * 2; a.push([TW[0] + Math.cos(t) * rad, TW[1] + Math.sin(t) * rad, z]); } return a; };
  const lower = ring(R0, Z0), upper = ring(R1, Z1), rail = ring(R1, ZR);
  const cupFaces = [];
  for (let i = 0; i < SEG; i++) { const j = (i + 1) % SEG; const f = mkFace([lower[i], lower[j], upper[j], upper[i]], 'wall', [TW[0], TW[1], Z0 - 4]); if (f) cupFaces.push(f); }
  cupFaces.sort((a, b) => a.depth - b.depth);
  const topRing = projPoly(upper), railP = projPoly(rail), innerRing = projPoly(ring(R1 - 1.6, Z1));
  const shaft = boxSolid(square(TW[0], TW[1], 3.4, 1, 0), 0, Z0 + 0.4, null);
  XOBJ.push({
    type: 'x', e: TW[0], nn: TW[1], X: PX(TW[0], TW[1]), Y: PY(TW[0], TW[1], 0), depth: DEP(TW[0], TW[1]) + 2,
    bb: [PX(TW[0], TW[1]) - 9, PY(TW[0], TW[1], ZR) - 6, PX(TW[0], TW[1]) + 9, PY(TW[0], TW[1], 0) + 4],
    draw() {
      const r = rng(2007), winter = season === 'winter', steel = '#b9bec2';
      if (SC < 0.35) { const x = this.X; ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 1.5; ctx.beginPath(); ctx.moveTo(x, this.Y); ctx.lineTo(x, PY(TW[0], TW[1], Z0)); ctx.stroke(); ctx.fillStyle = col(steel).s; ctx.fill(topRing.path); return; }
      for (const f of shaft) {
        washFace(f.path, steel, 0.55 + 0.45 * Math.min(1, f.light * 1.6), r);
        if (SC >= 0.9) { const { a, b, z0, h } = f.wall, segs = []; for (let z = z0; z < z0 + h - 0.5; z += 3.6) { const p1 = wpt(a, b, 0, z), p2 = wpt(a, b, 1, z + 3.6), p3 = wpt(a, b, 1, z), p4 = wpt(a, b, 0, z + 3.6); segs.push([p1[0], p1[1], p2[0], p2[1]], [p3[0], p3[1], p4[0], p4[1]]); } lineSet(segs, 0.45, 0.7); }
        inkPoly(f.pts, r, 0.8, 1);
      }
      // inside of the cup seen from above, then its outer skin
      washFace(topRing.path, winter ? '#eef1f2' : '#d4d6d3', 0.85, r);
      washFace(innerRing.path, '#8d9397', 0.45, r);
      for (const f of cupFaces) { washFace(f.path, steel, 0.55 + 0.45 * Math.min(1, f.light * 1.4), r); ctx.strokeStyle = inkC(0.45); ctx.lineWidth = PXU * 0.7; ctx.stroke(f.path); }
      ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU; ctx.stroke(topRing.path);
      // railing
      if (SC >= 0.8) {
        ctx.strokeStyle = inkC(0.7); ctx.lineWidth = PXU * 0.8; ctx.stroke(railP.path);
        const segs = []; for (let i = 0; i < SEG; i++) { const a = upper[i], b = rail[i]; if (DEP(a[0], a[1]) < DEP(TW[0], TW[1]) - 2) continue; const p = pr(a[0], a[1], a[2]), q = pr(b[0], b[1], b[2]); segs.push([p[0], p[1], q[0], q[1]]); } lineSet(segs, 0.7, 0.8);
      }
      if (night) { ctx.globalCompositeOperation = 'lighter'; const c = pr(TW[0], TW[1], Z1), g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 9); g.addColorStop(0, 'rgba(255,225,160,.25)'); g.addColorStop(1, 'rgba(255,225,160,0)'); ctx.fillStyle = g; ctx.fillRect(c[0] - 9, c[1] - 9, 18, 18); ctx.globalCompositeOperation = 'source-over'; }
    },
  });
  // no trees on the landing hill, under the in-run or around the tower
  for (let i = TREES.length - 1; i >= 0; i--) {
    const t = TREES[i], de = t.e - TO[0], dn = t.nn - TO[1];
    const ul = de * LA[0] + dn * LA[1], vl = de * LN[0] + dn * LN[1];
    const de2 = t.e - ST[0], dn2 = t.nn - ST[1], ui = de2 * U[0] + dn2 * U[1], vi = de2 * W[0] + dn2 * W[1];
    if ((ul > -3 && ul < 125 && Math.abs(vl) < 17) || (ui > -6 && ui < len + 3 && Math.abs(vi) < 6) || Math.hypot(t.e - TW[0], t.nn - TW[1]) < 10) TREES.splice(i, 1);
  }
})();
/* --- 41 m brick factory chimney of the Mastný mill --- */
(function () {
  const C = [572.8, -469.5], H = 41, R0 = 1.35, R1 = 0.85;
  const X = PX(C[0], C[1]), Y = PY(C[0], C[1], 0);
  XOBJ.push({
    type: 'x', e: C[0], nn: C[1], X, Y, depth: DEP(C[0], C[1]), shadowR: 0,
    bb: [X - 4, PY(C[0], C[1], H) - 3, X + 4, Y + 3],
    draw() {
      if (SC < 0.3) return;
      const r = rng(3644);
      const base = boxSolid(square(C[0], C[1], 3.6, 1, 0), 0, 3.2, null);
      for (const f of base) { washFace(f.path, '#a85f45', 0.5 + 0.5 * Math.min(1, f.light * 1.6), r); inkPoly(f.pts, r, 0.75, 0.9); }
      const yb = PY(C[0], C[1], 3.2), yt = PY(C[0], C[1], H);
      const p = new Path2D();
      p.moveTo(X - R0, yb); p.lineTo(X - R1, yt); p.ellipse(X, yt, R1, R1 * S, 0, Math.PI, 0); p.lineTo(X + R0, yb); p.ellipse(X, yb, R0, R0 * S, 0, 0, Math.PI); p.closePath();
      ctx.fillStyle = paper(); ctx.fill(p);
      ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
      const g = ctx.createLinearGradient(X - R0, 0, X + R0, 0);
      g.addColorStop(0, shade('#b0654a', 1)); g.addColorStop(0.6, shade('#b0654a', 0.8)); g.addColorStop(1, shade('#b0654a', 0.4));
      ctx.fillStyle = g; ctx.globalAlpha = 0.92; ctx.fill(p); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (SC >= 1.2) {
        const segs = []; for (let z = 4; z < H - 1; z += 1.1) { const t = (z - 3.2) / (H - 3.2), rr = R0 + (R1 - R0) * t, y = PY(C[0], C[1], z); segs.push([X - rr, y, X + rr, y]); }
        lineSet(segs, 0.2, 0.6);
      }
      // dark crown band
      const yc = PY(C[0], C[1], H - 2.2), rc = R1 + 0.08;
      ctx.fillStyle = shade('#5d4a40', 0.8); ctx.fillRect(X - rc - 0.12, yc - 0.6, (rc + 0.12) * 2, 0.9);
      ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU; ctx.stroke(p);
      ctx.beginPath(); ctx.ellipse(X, yt, R1, R1 * S, 0, 0, Math.PI * 2); ctx.fillStyle = '#2b2622'; ctx.fill(); ctx.stroke();
    },
  });
  for (let i = TREES.length - 1; i >= 0; i--) if (Math.hypot(TREES[i].e - C[0], TREES[i].nn - C[1]) < 5) TREES.splice(i, 1);
})();
/* --- swimming pool "Obora": irregular basin with an island, non-swimmer part, beach volleyball, playground, minigolf --- */
(function () {
  const POOL = [[243.8, -996.7], [248.4, -992.9], [260.1, -986.6], [267.2, -984.5], [283.9, -984.8], [283.9, -984.1], [299.6, -984.4], [303.0, -986.6], [304.4, -989.7], [308.9, -1028.8], [307.8, -1034.5], [305.1, -1035.8], [287.1, -1035.8], [286.8, -1034.9], [276.0, -1034.5], [268.8, -1033.0], [261.5, -1029.5], [250.1, -1023.1], [246.7, -1020.3]];
  const pr = (e, n) => [PX(e, n), PY(e, n, 0)];
  const pathPts = (pts) => { const p = new Path2D(); pts.forEach(([e, n], i) => { const q = pr(e, n); i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]); }); p.closePath(); return p; };
  const poolP = pathPts(POOL);
  const r0 = rng(1930), ISL = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = 5.2 + (r0() - 0.5) * 1.6; ISL.push([279 + Math.cos(a) * rr * 1.15, -1010 + Math.sin(a) * rr]); }
  const islP = pathPts(ISL), islRim = pathPts(ISL.map(([e, n]) => [279 + (e - 279) * 1.12, -1010 + (n + 1010) * 1.12]));
  const shallowClip = pathPts([[230, -975], [262.5, -975], [262.5, -1045], [230, -1045]]);
  const rect = (cx, cy, w, h) => pathPts([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]);
  const seg = (a, b) => { const p = pr(...a), q = pr(...b); return [p[0], p[1], q[0], q[1]]; };
  // beach volleyball + nohejbal sand area, playground, minigolf
  const sand = rect(196, -958, 40, 15), vb = [[176 + 2, -958], 16, 8], nh = [[198 + 8, -958], 18, 9];
  const PLAY = [[156, -968], [172, -965], [178, -978], [168, -990], [152, -985]], playP = pathPts(PLAY);
  const mini = []; for (let i = 0; i < 6; i++) mini.push([270 + i * 5, -961 + (i % 2) * 1.5]);
  const xs = [], ys = []; [...POOL, ...PLAY, [176, -951], [216, -965], [300, -954]].forEach(([e, n]) => { const q = pr(e, n); xs.push(q[0]); ys.push(q[1]); });
  AREAS.push({
    ord: 1e6 + 40, c: 'pool', custom: true, ring: [], bb: [Math.min(...xs) - 6, Math.min(...ys) - 6, Math.max(...xs) + 6, Math.max(...ys) + 6],
    over() {
      const r = rng(1930), winter = season === 'winter';
      // concrete rim
      ctx.lineJoin = 'round'; ctx.strokeStyle = inkC(0.7); ctx.lineWidth = 3.4; ctx.stroke(poolP);
      ctx.strokeStyle = winter ? '#e9ebec' : '#e4ddd0'; ctx.lineWidth = 2.6; ctx.stroke(poolP);
      // water: deeper turquoise, lighter non-swimmer part
      if (winter) { washFace(poolP, '#dfe8ec', 0.9, r); }
      else {
        ctx.fillStyle = paper(); ctx.fill(poolP);
        ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
        ctx.fillStyle = col('#5eb4c8').s; ctx.globalAlpha = 0.9; ctx.fill(poolP);
        ctx.save(); ctx.clip(poolP); ctx.fillStyle = col('#a6dde0').s; ctx.globalAlpha = 0.85; ctx.fill(shallowClip); ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (SC >= 0.8) {
          ctx.save(); ctx.clip(poolP); ctx.strokeStyle = night ? 'rgba(170,200,230,.35)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = PXU * 1.1; ctx.beginPath();
          for (let i = 0; i < 46; i++) { const e = 244 + r() * 64, n = -1035 + r() * 50, q = pr(e, n), w = 1.4 + r() * 2.2; ctx.moveTo(q[0], q[1]); ctx.quadraticCurveTo(q[0] + w / 2, q[1] - 0.5, q[0] + w, q[1]); }
          ctx.stroke(); ctx.restore();
          // floating rope between swimmers and non-swimmers
          for (let n = -987.5; n > -1031; n -= 1.6) { const q = pr(262.5, n), k = Math.round((n + 987.5) / 1.6); ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(0.32, PXU * 1.2), 0, 6.28); ctx.fillStyle = k % 2 ? '#f4f1ea' : '#c0392b'; ctx.fill(); }
        }
      }
      // island with grass and shrubs
      ctx.fillStyle = winter ? '#e7e9ea' : '#cfc8b8'; ctx.fill(islRim); ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.9; ctx.stroke(islRim);
      washFace(islP, winter ? '#f2f4f5' : '#8fb85c', 1, r);
      if (SC >= 0.8 && !winter) for (const [de, dn, rr] of [[-1.5, 1, 1.4], [1.8, -0.6, 1.1], [0.2, -1.8, 0.9]]) { const q = pr(279 + de, -1010 + dn); ctx.beginPath(); ctx.arc(q[0], q[1] - rr * 0.6, rr, 0, 6.28); ctx.fillStyle = col('#6f9a4a').s; ctx.fill(); ctx.strokeStyle = inkC(0.5); ctx.lineWidth = PXU * 0.8; ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
    draw() {
      const r = rng(1931), winter = season === 'winter';
      // sand courts
      washFace(sand, winter ? '#eef0ef' : '#ead7a4', 0.95, r);
      if (SC >= 0.8) {
        const lines = [];
        for (const [[cx, cy], w, h] of [vb, nh]) { const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2; lines.push(seg([x0, y0], [x1, y0]), seg([x1, y0], [x1, y1]), seg([x1, y1], [x0, y1]), seg([x0, y1], [x0, y0])); }
        ctx.strokeStyle = night ? 'rgba(80,110,160,.6)' : 'rgba(47,95,140,.75)'; ctx.lineWidth = PXU * 1.0; ctx.beginPath(); for (const [a, b, c, d] of lines) { ctx.moveTo(a, b); ctx.lineTo(c, d); } ctx.stroke();
        ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.1;
        for (const [[cx, cy], , h, hn] of [[vb[0], 16, vb[2], 2.4], [nh[0], 18, nh[2], 1.1]]) { const a = pr(cx, cy - h / 2 - 0.6), b = pr(cx, cy + h / 2 + 0.6); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - hn * ZK); ctx.lineTo(b[0], b[1] - hn * ZK); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      }
      // playground
      washFace(playP, winter ? '#eceeed' : '#e8d9b0', 0.9, r);
      if (SC >= 1.0) {
        ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.1;
        const s0 = pr(160, -975), s1 = pr(166, -975);           // swing frame
        ctx.beginPath(); ctx.moveTo(s0[0] - 0.8, s0[1]); ctx.lineTo(s0[0], s0[1] - 2.4 * ZK); ctx.lineTo(s0[0] + 0.8, s0[1]); ctx.moveTo(s1[0] - 0.8, s1[1]); ctx.lineTo(s1[0], s1[1] - 2.4 * ZK); ctx.lineTo(s1[0] + 0.8, s1[1]); ctx.moveTo(s0[0], s0[1] - 2.4 * ZK); ctx.lineTo(s1[0], s1[1] - 2.4 * ZK); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s0[0] + 2, s0[1] - 2.4 * ZK); ctx.lineTo(s0[0] + 2, s0[1] - 0.6 * ZK); ctx.moveTo(s0[0] + 4, s0[1] - 2.4 * ZK); ctx.lineTo(s0[0] + 4, s0[1] - 0.6 * ZK); ctx.stroke();
        const t0 = pr(170, -983);                                 // slide
        ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t0[0], t0[1] - 2.2 * ZK); ctx.lineTo(t0[0] + 4.2, t0[1] - 0.2); ctx.stroke();
        ctx.fillStyle = '#c0392b'; ctx.fillRect(t0[0] - 0.8, t0[1] - 2.6 * ZK, 1.6, 0.5 * ZK);
      }
      // minigolf lanes
      for (const [e, n] of mini) {
        const lane = rect(e, n, 1.6, 7.5); washFace(lane, winter ? '#e6e9e8' : '#5f9a6a', 1, r); ctx.strokeStyle = inkC(0.7); ctx.lineWidth = PXU * 0.8; ctx.stroke(lane);
        if (SC >= 1.4) { const h = pr(e, n + 2.8); ctx.beginPath(); ctx.arc(h[0], h[1], 0.22, 0, 6.28); ctx.fillStyle = '#1d1a16'; ctx.fill(); const t = pr(e, n - 2.9); ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0], t[1] - 1.2); ctx.strokeStyle = inkC(0.8); ctx.stroke(); ctx.fillStyle = '#e1b12c'; ctx.fillRect(t[0], t[1] - 1.2, 0.7, 0.4); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  });
  // hide the generic water area of the pool and keep trees off the water, courts, playground and minigolf
  AREAS.forEach(a => { if (a.c !== 'water' || !a.ring || !a.ring.length) return; let e = 0, n = 0; for (let i = 0; i < a.ring.length; i += 2) { e += a.ring[i] / 10; n += a.ring[i + 1] / 10; } e /= a.ring.length / 2; n /= a.ring.length / 2; if (Math.hypot(e - 278, n + 1010) < 12) a.hidden = true; });
  const poolFlat = new Float32Array(POOL.flatMap(([e, n]) => pr(e, n))), playFlat = new Float32Array(PLAY.flatMap(([e, n]) => pr(e, n)));
  for (let i = TREES.length - 1; i >= 0; i--) {
    const t = TREES[i], q = [PX(t.e, t.nn), PY(t.e, t.nn, 0)];
    const inBox = (x0, y0, x1, y1) => t.e > x0 && t.e < x1 && t.nn > y0 && t.nn < y1;
    if (pip(q[0], q[1], poolFlat) || pip(q[0], q[1], playFlat) || inBox(174, -967, 218, -949) || inBox(265, -968, 300, -954) || (t.e > 240 && t.e < 312 && t.nn > -1039 && t.nn < -981)) TREES.splice(i, 1);
  }
})();
AREAS.forEach(a => GA.add(a));
LINES.forEach(l => { l.bb = [l.bb[0] - 6, l.bb[1] - 6, l.bb[2] + 6, l.bb[3] + 6]; GL.add(l); });
BLDS.forEach(b => GO.add(b));
// Trees are numerous; index them in short background tasks so the map can become interactive first.
let treeIndex = 0;
function indexTreesInBackground() {
  const started = performance.now();
  while (treeIndex < TREES.length && performance.now() - started < 8) {
    GO.add(TREES[treeIndex++]);
  }
  if (treeIndex < TREES.length) {
    setTimeout(indexTreesInBackground, 0);
  } else {
    // Earlier tiles were rendered without the complete tree layer; rebuild them once.
    cache.clear();
    requestDraw();
  }
}
setTimeout(indexTreesInBackground, 0);
MONS.forEach(m => GO.add(m));
XOBJ.forEach(x => GO.add(x));
const LAMPOBJ = LAMPS.map(([e, n]) => { const X = PX(e, n), Y = PY(e, n, 0); return { X, Y, bb: [X - 12, Y - 12, X + 12, Y + 12] }; });
const GLp = new Grid(); LAMPOBJ.forEach(l => GLp.add(l));

/* ---------- paper textures ---------- */
function makeNoise(size, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const im = g.createImageData(size, size);
  fn(im.data, size); g.putImageData(im, 0, 0); return c;
}
function periodicNoise(size, cells, seed) {
  const r = rng(seed), lat = [];
  for (let i = 0; i < cells * cells; i++) lat.push(r());
  const L = (x, y) => lat[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / size * cells, fy = y / size * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
    return (L(ix, iy) * (1 - tx) + L(ix + 1, iy) * tx) * (1 - ty) + (L(ix, iy + 1) * (1 - tx) + L(ix + 1, iy + 1) * tx) * ty;
  };
}
const GRAIN = makeNoise(256, (d, sz) => {
  const r = rng(5), n1 = periodicNoise(sz, 32, 9), n2 = periodicNoise(sz, 64, 11);
  for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
    const v = 243 + n1(x, y) * 6 + n2(x, y) * 4 + r() * 6;
    const i = (y * sz + x) * 4; d[i] = Math.min(255, v + 3); d[i + 1] = Math.min(255, v + 1); d[i + 2] = Math.min(255, v - 4); d[i + 3] = 255;
  }
});
const BLOOM = makeNoise(512, (d, sz) => {
  const n1 = periodicNoise(sz, 4, 21), n2 = periodicNoise(sz, 8, 23), n3 = periodicNoise(sz, 16, 27);
  for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
    const v = n1(x, y) * 0.55 + n2(x, y) * 0.3 + n3(x, y) * 0.15;
    const t = Math.max(0, Math.min(1, (v - 0.35) * 1.6));
    const i = (y * sz + x) * 4;
    d[i] = 255 - t * 9; d[i + 1] = 255 - t * 11; d[i + 2] = 255 - t * 20; d[i + 3] = 255;
  }
});
document.body.style.backgroundImage = `url(${GRAIN.toDataURL()})`;

/* ---------- tile renderer ---------- */
const TILE = 512;
let ctx, SC, PXU;            // SC: device px per world unit; PXU: world units per device px
const LVL_MIN = -3, LVL_MAX = 3;

function paper() { return night ? '#3c4154' : season === 'winter' ? '#f4f3ee' : '#f6efdc'; }
function inkC(a) { return night ? `rgba(12,10,8,${a})` : `rgba(58,47,37,${a})`; }

function wash(path, hcol, alpha, r, edge = 1, fillRule = 'nonzero') {
  ctx.fillStyle = typeof hcol === 'string' && hcol[0] === '#' ? col(hcol).s : hcol;
  const j = PXU * 1.1;
  if (SC < 0.35) { ctx.globalAlpha = alpha; ctx.fill(path, fillRule); }
  else {
    ctx.globalAlpha = alpha * 0.62; ctx.translate((r() - .5) * j * 2, (r() - .5) * j * 2); ctx.fill(path, fillRule);
    const dx = (r() - .5) * j * 2, dy = (r() - .5) * j * 2;
    ctx.translate(dx, dy); ctx.globalAlpha = alpha * 0.5; ctx.fill(path, fillRule);
    ctx.setTransform(SC, 0, 0, SC, ctx._ox, ctx._oy);
  }
  if (edge && SC >= 0.35) {
    ctx.globalAlpha = alpha * 0.4 * edge; ctx.strokeStyle = darker(hcol[0] === '#' ? hcol : '#999999', 0.25); ctx.lineWidth = PXU * 1.4; ctx.stroke(path);
  }
  ctx.globalAlpha = 1;
}

function inkPoly(pts, r, alpha = 0.85, w = 1) {
  const n = pts.length / 2;
  ctx.strokeStyle = inkC(alpha);
  ctx.lineWidth = PXU * w * (SC < 0.6 ? 0.7 : SC < 1.5 ? 0.85 : 1.05);
  ctx.beginPath();
  const over = SC >= 0.6;
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
    if (over) {
      const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L;
      const o1 = (0.3 + r() * 1.6) * PXU, o2 = (0.3 + r() * 1.6) * PXU, jj = (r() - .5) * 0.7 * PXU;
      ctx.moveTo(ax - ux * o1 - uy * jj, ay - uy * o1 + ux * jj);
      ctx.lineTo(bx + ux * o2 - uy * jj, by + uy * o2 + ux * jj);
    } else {
      i ? ctx.lineTo(ax, ay) : ctx.moveTo(ax, ay);
    }
  }
  if (!over) ctx.closePath();
  ctx.stroke();
}

function hatch(path, bb, alpha) {
  ctx.save(); ctx.clip(path);
  ctx.strokeStyle = inkC(alpha); ctx.lineWidth = PXU * 0.7; ctx.beginPath();
  const sp = PXU * 3.2;
  for (let x = bb[0] - (bb[3] - bb[1]); x < bb[2]; x += sp) { ctx.moveTo(x, bb[3]); ctx.lineTo(x + (bb[3] - bb[1]) * 1.2, bb[1]); }
  ctx.stroke(); ctx.restore();
}
function ptsBB(p) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } return [x0, y0, x1, y1]; }

const P = () => PAL[season];

function drawArea(a) {
  const pal = P(), r = rng(a.seed);
  let c = pal[a.c] || pal.ground;
  if (Array.isArray(c)) c = c[a.seed % c.length];
  const blend = night ? 'source-over' : 'multiply';
  ctx.globalCompositeOperation = blend;
  wash(a.path, c, a.c === 'water' ? 0.95 : a.c === 'residential' || a.c === 'industrial' ? 0.6 : 0.8, r, a.c === 'water' ? 1.6 : 0.8, 'evenodd');
  if (a.c === 'farmland' && SC >= 0.25) {
    // plough rows
    ctx.save(); ctx.clip(a.path, 'evenodd');
    const ang = r() * Math.PI, ux = Math.cos(ang), uy = Math.sin(ang);
    const [x0, y0, x1, y1] = a.bb, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
    ctx.strokeStyle = season === 'winter' ? inkC(0.08) : darker(c, 0.3); ctx.globalAlpha = season === 'winter' ? 1 : 0.35;
    ctx.lineWidth = PXU * 0.8; ctx.beginPath();
    const sp = Math.max(5, PXU * 4);
    for (let t = -R; t < R; t += sp) { ctx.moveTo(cx + ux * -R - uy * t, cy + uy * -R + ux * t); ctx.lineTo(cx + ux * R - uy * t, cy + uy * R + ux * t); }
    ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
  }
  if (a.c === 'water' && SC >= 0.8) {
    ctx.save(); ctx.clip(a.path, 'evenodd');
    ctx.strokeStyle = night ? 'rgba(170,190,220,.35)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = PXU * 1.1; ctx.globalCompositeOperation = 'source-over';
    const [x0, y0, x1, y1] = a.bb; ctx.beginPath();
    for (let i = 0; i < (x1 - x0) * (y1 - y0) / 900 && i < 60; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), w = 3 + r() * 6; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 0.8, x + w, y); }
    ctx.stroke(); ctx.restore();
  }
  if (a.c === 'cemetery' && SC >= 1) {
    ctx.save(); ctx.clip(a.path); ctx.strokeStyle = inkC(0.5); ctx.lineWidth = PXU * 0.8;
    const [x0, y0, x1, y1] = a.bb; ctx.beginPath();
    for (let x = x0; x < x1; x += 5) for (let y = y0; y < y1; y += 3.4) { const xx = x + (y * 1.7 % 5); ctx.moveTo(xx, y); ctx.lineTo(xx, y - 1.6); ctx.moveTo(xx - 0.6, y - 1.1); ctx.lineTo(xx + 0.6, y - 1.1); }
    ctx.stroke(); ctx.restore();
  }
  if ((a.c === 'pitch') && SC >= 0.7) {
    ctx.save(); ctx.clip(a.path); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = night ? 'rgba(200,210,230,.3)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = PXU * 1.2; ctx.stroke(a.path); ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawLineObj(l, pass) {
  const pal = P();
  if (l.t === 'water') {
    if (pass !== 0) return;
    const w = l.k === 'river' ? 7 : l.k === 'stream' ? 2.6 : 1.6;
    ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col(pal.water).s; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(w, PXU * 1.4); ctx.stroke(l.path);
    ctx.strokeStyle = col(pal.waterInk).s; ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(w * 0.35, PXU * 0.7); ctx.stroke(l.path);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return;
  }
  if (l.t === 'rail') {
    if (pass !== 2) return;
    ctx.lineCap = 'butt';
    if (l.k === 'abandoned') { ctx.setLineDash([PXU * 4, PXU * 4]); ctx.strokeStyle = inkC(0.35); ctx.lineWidth = PXU; ctx.stroke(l.path); ctx.setLineDash([]); return; }
    ctx.strokeStyle = inkC(0.85); ctx.lineWidth = Math.max(1.5, PXU * 1.2); ctx.stroke(l.path);
    if (SC >= 0.8) { ctx.setLineDash([PXU * 1, 2.4]); ctx.lineWidth = 3.4; ctx.strokeStyle = inkC(0.55); ctx.stroke(l.path); ctx.setLineDash([]); }
    return;
  }
  const w = ROADW[l.k] || 3;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (['path', 'footway', 'steps', 'track'].includes(l.k)) {
    if (pass !== 1) return;
    if (l.k === 'track') {
      ctx.strokeStyle = night ? 'rgba(90,80,70,.5)' : 'rgba(150,120,80,.5)'; ctx.lineWidth = Math.max(w, PXU * 1.2); ctx.setLineDash([PXU * 7, PXU * 3]);
    } else {
      ctx.strokeStyle = inkC(0.5); ctx.lineWidth = Math.max(PXU * 0.8, 0.6); ctx.setLineDash([PXU * 3, PXU * 2.5]);
    }
    ctx.stroke(l.path); ctx.setLineDash([]);
    return;
  }
  if (pass === 1) { // casing
    ctx.strokeStyle = inkC(SC < 0.5 ? 0.45 : 0.75); ctx.lineWidth = w + PXU * (SC < 0.5 ? 1.0 : 2.1); ctx.stroke(l.path);
  } else if (pass === 2) {
    ctx.strokeStyle = col(pal.road).s; ctx.lineWidth = Math.max(w, PXU * 1.2); ctx.stroke(l.path);
  }
}

function drawShadow(o) {
  if (night) return;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = season === 'winter' ? 'rgba(120,140,175,.28)' : 'rgba(110,115,150,.24)';
  if (o.type === 'b') ctx.fill(o.shadow);
  else if (o.type === 'x') { if (o.shadowR && SC >= 0.45) { ctx.beginPath(); ctx.ellipse(o.X + 1.5, o.Y - 0.8, 6.5, 2.2, -0.75, 0, Math.PI * 2); ctx.fill(); } }
  else if (o.type === 'm') { if (SC >= 0.6) { ctx.beginPath(); ctx.ellipse(o.X + 2.2, o.Y - 0.6, 3, 1.4, -0.3, 0, Math.PI * 2); ctx.fill(); } }
  else if (SC >= 0.35) {
    const R = o.k === 1 ? 2.2 : o.k === 3 ? 1.4 : o.size * 0.95;
    const off = o.k === 1 ? o.size * 0.45 : o.size * 0.7;
    ctx.beginPath(); ctx.ellipse(o.X + off * 0.95, o.Y - off * 0.15, R * 1.6, R * 0.8, -0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

const wpt = (a, b, t, z) => { const e = a[0] + (b[0] - a[0]) * t, n = a[1] + (b[1] - a[1]) * t; return [PX(e, n), PY(e, n, z)]; };
function windowQuads(f, lv, r, style) {
  const { a, b, z0, h } = f.wall;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sp = style === 'tall' ? 5.2 : style === 'log' ? 3.4 : style === 'mill' ? 2.7 : 3.1, w = style === 'tall' ? 1.7 : style === 'log' ? 0.9 : style === 'mill' ? 1.2 : 1.0;
  if (L < sp * 0.85) return [];
  const n = Math.floor((L - 0.8) / sp);
  if (n < 1) return [];
  const gap = L / n, out = [];
  const levels = style === 'tall' || style === 'log' ? 1 : style === 'mill' ? Math.max(1, Math.floor((h - 0.6) / 4.1)) : Math.max(1, Math.min(lv, Math.floor((h - 0.4) / 2.9)));
  for (let k = 0; k < levels; k++) {
    const zb = style === 'tall' ? z0 + 2.8 : style === 'mill' ? z0 + k * 4.1 + 1.0 : z0 + k * 3 + 1.0, zt = style === 'tall' ? z0 + 8.6 : zb + (style === 'log' ? 1.15 : style === 'mill' ? 2.2 : 1.45);
    for (let i = 0; i < n; i++) {
      const t0 = ((i + 0.5) * gap - w / 2) / L, t1 = t0 + w / L;
      const p0 = wpt(a, b, t0, zb), p1 = wpt(a, b, t1, zb), p2 = wpt(a, b, t1, zt), p3 = wpt(a, b, t0, zt);
      out.push([p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], r()]);
    }
  }
  return out;
}
function lineSet(segs, alpha, w = 0.7) {
  ctx.strokeStyle = inkC(alpha); ctx.lineWidth = PXU * w; ctx.beginPath();
  for (const [x0, y0, x1, y1] of segs) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  ctx.stroke();
}
function washFace(path, base, k, r, alphaMul = 1) {
  const blend = night ? 'source-over' : 'multiply';
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = paper(); ctx.fill(path);
  ctx.globalCompositeOperation = blend; ctx.fillStyle = shade(base, k);
  if (SC < 0.5) { ctx.globalAlpha = 0.95 * alphaMul; ctx.fill(path); }
  else {
    ctx.globalAlpha = 0.7 * alphaMul; ctx.fill(path);
    ctx.globalAlpha = 0.4 * alphaMul; ctx.translate((r() - .5) * PXU * 1.6, (r() - .5) * PXU * 1.6); ctx.fill(path); ctx.setTransform(SC, 0, 0, SC, ctx._ox, ctx._oy);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawBuilding(o) {
  const pal = P(), r = rng(o.id);
  for (const s of o.solids) {
    if (s.draw === 'thGable') { drawTHGable(s, o, r); continue; }
    if (s.draw === 'thFacade') { drawTheatreFacade(s, o, r); continue; }
    if (s.draw === 'dome') { drawDome(s.dome, r); continue; }
    if (s.draw === 'lantern') {
      const glass = ['#c0392b', '#2e6da4', '#e1b12c', '#3c9d5d'];
      for (const f of s.panes) {
        ctx.fillStyle = paper(); ctx.fill(f.path);
        ctx.globalAlpha = night ? 1 : 0.8; ctx.fillStyle = night ? glass[f.ci % 4] : shade(glass[f.ci % 4], 0.6 + 0.4 * Math.min(1, f.light * 1.6)); ctx.fill(f.path); ctx.globalAlpha = 1;
        ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.8; ctx.stroke(f.path);
      }
      if (night) { ctx.globalCompositeOperation = 'lighter'; const c = pr2(s.top[0], s.top[1], s.top[2] - 2), g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 7); g.addColorStop(0, 'rgba(255,215,140,.45)'); g.addColorStop(1, 'rgba(255,215,140,0)'); ctx.fillStyle = g; ctx.fillRect(c[0] - 7, c[1] - 7, 14, 14); ctx.globalCompositeOperation = 'source-over'; }
      for (const f of s.cap) { washFace(f.path, season === 'winter' ? '#eef2f4' : '#7fa294', 0.6 + 0.4 * Math.min(1, f.light * 1.4), r); ctx.strokeStyle = inkC(0.75); ctx.lineWidth = PXU * 0.8; ctx.stroke(f.path); }
      if (SC >= 0.8) { const t = pr2(...s.top); ctx.strokeStyle = inkC(0.9); ctx.lineWidth = PXU * 1.1; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(t[0], t[1] - 1.4); ctx.stroke(); ctx.beginPath(); ctx.arc(t[0], t[1] - 1.5, 0.2, 0, 6.28); ctx.fillStyle = '#c79a3c'; ctx.fill(); }
      continue;
    }
    if (s.draw === 'relief') {
      if (SC < 1.0) continue;
      let o0 = pr2(s.a[0], s.a[1], s.z0), o1 = pr2(s.b[0], s.b[1], s.z0); const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      if (o1[0] < o0[0]) [o0, o1] = [o1, o0];
      ctx.save(); ctx.transform((o1[0] - o0[0]) / len, (o1[1] - o0[1]) / len, 0, -ZK, o0[0], o0[1]);
      const hgt = s.z1 - s.z0;
      ctx.fillStyle = night ? '#4a4e5e' : '#efe9dc'; ctx.fillRect(0, 0, len, hgt);
      ctx.strokeStyle = inkC(0.75); ctx.lineWidth = PXU * 1.2 / Math.max(1, ZK); ctx.strokeRect(0, 0, len, hgt);
      if (SC >= 1.6) {
        ctx.strokeStyle = night ? 'rgba(220,225,240,.6)' : 'rgba(95,85,72,.85)'; ctx.lineWidth = 0.22; ctx.lineCap = 'round';
        const fig = (x, pose) => {
          const hy = hgt * 0.78;
          ctx.beginPath(); ctx.arc(x, hy, 0.32, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, hy - 0.35); ctx.lineTo(x, hy - 2.1);
          ctx.moveTo(x, hy - 2.1); ctx.lineTo(x - 0.6, hy - 3.6 + pose * 0.2); ctx.moveTo(x, hy - 2.1); ctx.lineTo(x + 0.6, hy - 3.6 - pose * 0.2);
          ctx.moveTo(x, hy - 0.8); ctx.lineTo(x - 1.0 * (pose ? 1 : -1), hy + 0.6); ctx.moveTo(x, hy - 0.8); ctx.lineTo(x + 1.0 * (pose ? 1 : -1), hy + 0.6);
          ctx.stroke();
        };
        for (let i = 0; i < 4; i++) fig(len * (0.15 + i * 0.235), i % 2);
      }
      ctx.restore(); continue;
    }
    if (s.draw === 'sign') { if (SC >= 2.0) { let o0 = pr2(s.a[0], s.a[1], s.z), o1 = pr2(s.b[0], s.b[1], s.z); if (o1[0] < o0[0]) [o0, o1] = [o1, o0]; const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]); ctx.save(); ctx.transform((o1[0] - o0[0]) / len, (o1[1] - o0[1]) / len, 0, ZK, o0[0], o0[1]); ctx.font = '700 0.85px "Alegreya Sans", sans-serif'; ctx.fillStyle = night ? 'rgba(240,230,205,.8)' : 'rgba(70,52,40,.85)'; ctx.textBaseline = 'middle'; ctx.fillText(s.text, 0, 0, len); ctx.restore(); } continue; }
    if (s.draw === 'stand') { washFace(s.stand.path, season === 'winter' ? '#eceeee' : '#bdb7ab', 0.75, r); if (SC >= 1.0) { const segs = []; for (let k = 1; k < 10; k++) { const t = k / 10, z = 1.0 + 6 * t; const p = [s.Fr[0][0] + (s.Bk[0][0] - s.Fr[0][0]) * t, s.Fr[0][1] + (s.Bk[0][1] - s.Fr[0][1]) * t], q = [s.Fr[1][0] + (s.Bk[1][0] - s.Fr[1][0]) * t, s.Fr[1][1] + (s.Bk[1][1] - s.Fr[1][1]) * t]; segs.push([PX(p[0], p[1]), PY(p[0], p[1], z), PX(q[0], q[1]), PY(q[0], q[1], z)]); } lineSet(segs, 0.4, 0.7); } inkPoly(s.stand.pts, r, 0.75, 1); continue; }
    if (s.draw === 'posts') { if (SC >= 0.8) { ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU * 1.4; for (const [e, n] of s.posts) { const a = PY(e, n, 0), b = PY(e, n, 10); ctx.beginPath(); ctx.moveTo(PX(e, n), a); ctx.lineTo(PX(e, n), b); ctx.stroke(); } } continue; }
    if (s.draw === 'deck') { washFace(s.dp.path, season === 'winter' ? '#e8e6e0' : '#a77a52', 0.9, r); if (SC >= 1.4) { ctx.save(); ctx.clip(s.dp.path); const bb = ptsBB(s.dp.pts), segs = []; for (let x = bb[0]; x < bb[2]; x += 0.6) segs.push([x, bb[1], x + (bb[3] - bb[1]) * 0.8, bb[3]]); lineSet(segs, 0.3, 0.6); ctx.restore(); } ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.8; ctx.stroke(s.dp.path); continue; }
    if (s.custom) {
      washFace(s.fg.path, o.wall, 0.62, r);
      inkPoly(s.fg.pts, r, 0.78, 1);
      if (s.cross && SC >= 0.8) drawCross(s.cross);
      continue;
    }
    for (const f of s.faces) {
      const isRoof = f.kind === 'roof' || f.kind === 'flat';
      let base;
      if (isRoof) base = pal.roofSnow && f.kind === 'roof' ? '#eef2f4' : (s.roofCol || (f.kind === 'flat' ? o.flatCol : o.roof));
      else base = s.wallCol || (f.kind === 'gable' && o.gableCol) || o.wall;
      if (pal.roofSnow && f.kind === 'flat') base = '#e9edee';
      const k = isRoof ? 0.62 + 0.38 * Math.min(1, f.light * 1.3) : 0.5 + 0.5 * Math.min(1, f.light * 1.6);
      washFace(f.path, base, k, r);
      if (SC >= 1.6 && !isRoof && f.light < 0.3) hatch(f.path, ptsBB(f.pts), night ? 0.25 : 0.22);
      // surface textures
      if (SC >= 1.3 && f.wall && (o.tex === 'log' || s.tex === 'boards')) {
        const { a, b, z0, h } = f.wall, segs = [];
        if (o.tex === 'log') for (let z = z0 + 0.34; z < z0 + h; z += 0.34) { const p = wpt(a, b, 0, z), q = wpt(a, b, 1, z); segs.push([p[0], p[1], q[0], q[1]]); }
        else { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0.5 / L; t < 1; t += 0.55 / L) { const p = wpt(a, b, t, z0), q = wpt(a, b, t, z0 + h); segs.push([p[0], p[1], q[0], q[1]]); } }
        lineSet(segs, o.tex === 'log' ? 0.32 : 0.28);
      }
      if (s.gallery && f.wall && SC >= 1.2) {
        const { a, b, z0 } = f.wall, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 13) {
          const zr0 = z0 + 0.15, zr1 = z0 + 1.05, segs = [];
          const p0 = wpt(a, b, 0, zr0), p1 = wpt(a, b, 1, zr0), q0 = wpt(a, b, 0, zr1), q1 = wpt(a, b, 1, zr1);
          segs.push([p0[0], p0[1], p1[0], p1[1]], [q0[0], q0[1], q1[0], q1[1]]);
          for (let t = 0.3 / L; t < 1; t += 0.32 / L) { const u = wpt(a, b, t, zr0), v = wpt(a, b, t, zr1); segs.push([u[0], u[1], v[0], v[1]]); }
          ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = night ? 'rgba(230,210,170,.5)' : 'rgba(240,226,190,.9)'; ctx.lineWidth = PXU * 1.6; ctx.beginPath(); for (const [x0, y0, x1, y1] of segs.slice(0, 2)) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); } ctx.stroke(); ctx.restore();
          lineSet(segs, 0.7, 0.7);
        }
      }
      if (s.barge && f.kind === 'gable' && SC >= 1.0) {
        const p = f.pts; // [eave, eave, apex]
        const edge = (x0, y0, x1, y1) => { const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.7)); ctx.beginPath(); for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + 0.35; i ? ctx.quadraticCurveTo(x - (x1 - x0) / n / 2, y + 0.35, x, y) : ctx.moveTo(x, y); } ctx.stroke(); };
        ctx.strokeStyle = night ? 'rgba(230,210,170,.55)' : 'rgba(245,232,200,.95)'; ctx.lineWidth = PXU * 1.4;
        edge(p[0], p[1], p[4], p[5]); edge(p[2], p[3], p[4], p[5]);
        ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.7; edge(p[0], p[1], p[4], p[5]); edge(p[2], p[3], p[4], p[5]);
      }
      if (SC >= 1.3 && f.kind === 'gable' && s.tex === 'boards') {
        ctx.save(); ctx.clip(f.path); const bb = ptsBB(f.pts), segs = [];
        for (let x = bb[0]; x < bb[2]; x += 0.45) segs.push([x, bb[1], x, bb[3]]);
        lineSet(segs, 0.3); ctx.restore();
      }
      if (SC >= 1.3 && f.kind === 'gable' && o.tex === 'log') {
        ctx.save(); ctx.clip(f.path); const bb = ptsBB(f.pts), segs = [];
        for (let x = bb[0]; x < bb[2]; x += 0.5) segs.push([x, bb[1], x, bb[3]]);
        lineSet(segs, 0.28); ctx.restore();
      }
      if (SC >= 2.4 && f.kind === 'roof' && !pal.roofSnow) {
        ctx.save(); ctx.clip(f.path); const bb = ptsBB(f.pts), segs = [];
        for (let y = bb[1]; y < bb[3]; y += 1.1) segs.push([bb[0], y, bb[2], y]);
        lineSet(segs, 0.16); ctx.restore();
      }
      // mansard dormer windows
      if (f.mans && SC >= 1.4) {
        const p = f.pts, len = Math.hypot(p[2] - p[0], p[3] - p[1]), n = Math.floor(len / 3.8);
        const bl = (t, u) => [p[0] + (p[2] - p[0]) * t + ((p[6] + (p[4] - p[6]) * t) - (p[0] + (p[2] - p[0]) * t)) * u, p[1] + (p[3] - p[1]) * t + ((p[7] + (p[5] - p[7]) * t) - (p[1] + (p[3] - p[1]) * t)) * u];
        for (let i = 0; i < n; i++) {
          const tc = (i + 0.5) / n, dt = 0.5 / len;
          const q = [bl(tc - dt, 0.22), bl(tc + dt, 0.22), bl(tc + dt, 0.72), bl(tc - dt, 0.72)];
          ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath();
          ctx.fillStyle = night && r() < 0.5 ? '#ffd27a' : night ? '#20283c' : '#6e7b86'; ctx.fill();
          ctx.strokeStyle = night ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = PXU * 0.8; ctx.stroke();
        }
      }
      // belfry openings
      if (s.open && f.wall && SC >= 0.8) {
        const { a, b, z0, h } = f.wall;
        const q = [wpt(a, b, 0.22, z0 + 0.4), wpt(a, b, 0.78, z0 + 0.4), wpt(a, b, 0.78, z0 + h - 0.6), wpt(a, b, 0.22, z0 + h - 0.6)];
        ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath();
        ctx.fillStyle = night ? '#120f0c' : 'rgba(46,38,32,.88)'; ctx.fill();
      }
      if (s.door && f.wall && SC >= 1.0 && f.light > 0.1) {
        const { a, b, z0 } = f.wall, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L > 8) {
          const q = [wpt(a, b, 0.3, z0 + 0.1), wpt(a, b, 0.7, z0 + 0.1), wpt(a, b, 0.7, z0 + 3.0), wpt(a, b, 0.3, z0 + 3.0)];
          ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath();
          ctx.fillStyle = night ? '#ffd98a' : '#7d8f99'; ctx.fill(); ctx.strokeStyle = inkC(0.7); ctx.lineWidth = PXU * 0.8; ctx.stroke();
          if (SC >= 1.6) { const segs = []; for (let t = 0.3 + 0.4 / 4; t < 0.7; t += 0.4 / 4) { const p = wpt(a, b, t, z0 + 0.1), q2 = wpt(a, b, t, z0 + 3.0); segs.push([p[0], p[1], q2[0], q2[1]]); } lineSet(segs, 0.55, 0.7); }
        }
      }
      if (s.entrance && f.wall && SC >= 1.2 && f.light > 0.1 && !s.door) {
        const { a, b, z0, h } = f.wall, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let t = 1.5 / L; t < 1 - 1.5 / L; t += 2.4 / L) {
          const q = [wpt(a, b, t, z0 + 1.2), wpt(a, b, t + 1.2 / L, z0 + 1.2), wpt(a, b, t + 1.2 / L, z0 + h - 1.0), wpt(a, b, t, z0 + h - 1.0)];
          ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath();
          ctx.fillStyle = night && r() < 0.6 ? '#ffd27a' : night ? '#20283c' : '#7d8f99'; ctx.fill(); ctx.strokeStyle = inkC(0.55); ctx.lineWidth = PXU * 0.7; ctx.stroke();
        }
      }
      if (s.ribbon && f.wall && SC >= 0.8) {
        const { a, b, z0, h } = f.wall, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L > 20) { const q = [wpt(a, b, 0.04, z0 + h - 2.2), wpt(a, b, 0.96, z0 + h - 2.2), wpt(a, b, 0.96, z0 + h - 0.8), wpt(a, b, 0.04, z0 + h - 0.8)]; ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath(); ctx.fillStyle = night ? '#ffe7b0' : '#8ea3ae'; ctx.fill(); ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.8; ctx.stroke(); }
        if (SC >= 1.3) { const segs = []; for (let z = z0 + 1.2; z < z0 + h - 2.4; z += 1.2) { const p = wpt(a, b, 0, z), q = wpt(a, b, 1, z); segs.push([p[0], p[1], q[0], q[1]]); } lineSet(segs, 0.18, 0.7); }
      }
      if (s.foyer && f.wall && SC >= 0.8 && f.light > 0.1) {
        const { a, b, z0 } = f.wall;
        const q = [wpt(a, b, 0.08, z0 + 0.2), wpt(a, b, 0.92, z0 + 0.2), wpt(a, b, 0.92, z0 + 3.4), wpt(a, b, 0.08, z0 + 3.4)];
        ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath();
        ctx.fillStyle = night ? '#ffdc96' : '#86a0ac'; ctx.fill(); ctx.strokeStyle = inkC(0.65); ctx.lineWidth = PXU * 0.8; ctx.stroke();
      }
      if (s.corten && SC >= 1.2 && f.wall) {
        ctx.save(); ctx.clip(f.path); ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
        const bb = ptsBB(f.pts); for (let i = 0; i < 10; i++) { const x = bb[0] + r() * (bb[2] - bb[0]), y = bb[1] + r() * (bb[3] - bb[1]); ctx.fillStyle = 'rgba(120,55,25,.25)'; ctx.beginPath(); ctx.ellipse(x, y, 0.5 + r(), 0.3 + r() * 0.8, 0, 0, 6.28); ctx.fill(); }
        ctx.restore(); ctx.globalCompositeOperation = 'source-over';
      }
      if (o.style === 'store' && f.wall && SC >= 0.6) {
        const { a, b, z0, h } = f.wall, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const quad = (t0, t1, za, zb) => { const q = [wpt(a, b, t0, za), wpt(a, b, t1, za), wpt(a, b, t1, zb), wpt(a, b, t0, zb)]; ctx.beginPath(); q.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath(); };
        if (L > 18 && f.light > 0.25) {
          quad(0.3, 0.78, z0 + 0.2, z0 + 3.6);
          ctx.fillStyle = night ? '#ffe2a0' : '#8fa6b2'; ctx.globalAlpha = night ? 0.95 : 0.85; ctx.fill(); ctx.globalAlpha = 1;
          if (SC >= 1.6) { const segs = []; for (let t = 0.3; t <= 0.781; t += 2.2 / L) { const p = wpt(a, b, t, z0 + 0.2), q = wpt(a, b, t, z0 + 3.6); segs.push([p[0], p[1], q[0], q[1]]); } lineSet(segs, 0.55, 0.8); }
          if (night) { ctx.globalCompositeOperation = 'lighter'; const c = wpt(a, b, 0.54, z0 + 1.6); const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], L * 0.4); g.addColorStop(0, 'rgba(255,210,130,.35)'); g.addColorStop(1, 'rgba(255,210,130,0)'); ctx.fillStyle = g; ctx.fillRect(c[0] - L * 0.4, c[1] - L * 0.4, L * 0.8, L * 0.8); ctx.globalCompositeOperation = 'source-over'; }
        }
        quad(0, 1, z0 + h - 1.1, z0 + h - 0.2);
        ctx.globalCompositeOperation = night ? 'source-over' : 'multiply'; ctx.fillStyle = shade('#b4483a', 0.6 + 0.4 * Math.min(1, f.light * 1.6)); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      } else
      if (f.kind === 'wall' && o.win && !s.noWin && SC >= 1.2) {
        const quads = windowQuads(f, o.lv, r, s.tallWin ? 'tall' : o.winStyle);
        for (const q of quads) {
          const lit = night && q[8] < 0.55;
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.lineTo(q[6], q[7]); ctx.closePath();
          ctx.fillStyle = lit ? (q[8] < 0.2 ? '#ffe7a3' : '#ffd27a') : night ? '#20283c' : (f.light > 0.3 ? '#8d9ba4' : '#6e7b86');
          ctx.globalAlpha = night ? 1 : 0.85; ctx.fill(); ctx.globalAlpha = 1;
          if (SC >= 2.2 || o.winStyle === 'log') { ctx.strokeStyle = night ? 'rgba(0,0,0,.6)' : (o.winStyle === 'log' ? 'rgba(255,255,255,.95)' : inkC(0.55)); ctx.lineWidth = PXU * (o.winStyle === 'log' ? 1.1 : 0.8); ctx.stroke(); }
          if (lit) {
            ctx.globalCompositeOperation = 'lighter';
            const cx = (q[0] + q[4]) / 2, cy = (q[1] + q[5]) / 2, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3.4);
            g.addColorStop(0, 'rgba(255,200,110,.38)'); g.addColorStop(1, 'rgba(255,200,110,0)');
            ctx.fillStyle = g; ctx.fillRect(cx - 3.4, cy - 3.4, 6.8, 6.8);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'wall' && o.win && !s.noWin && night && SC < 1.2 && SC >= 0.3) {
        if (r() < 0.6) {
          const p = f.pts; const cx = (p[0] + p[2] + p[4] + p[6]) / 4, cy = (p[1] + p[3] + p[5] + p[7]) / 4;
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,205,120,.75)';
          ctx.fillRect(cx - PXU * 1.2, cy - PXU * 1.2, PXU * 2.4, PXU * 2.4);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      inkPoly(f.pts, r, isRoof ? 0.8 : 0.72, 1);
      // tower clock
      if (s.clock && f.wall && SC >= 0.7) {
        const { a, b } = f.wall, L = Math.hypot(b[0] - a[0], b[1] - a[1]), R = 1.15;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) { const an = i / 20 * Math.PI * 2, p = wpt(a, b, 0.5 + Math.cos(an) * R / L, s.clock + Math.sin(an) * R); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.closePath(); ctx.fillStyle = night ? '#ffe9b0' : '#f8f4ea'; ctx.fill(); ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU; ctx.stroke();
        if (SC >= 1.5) {
          const c = wpt(a, b, 0.5, s.clock), h1 = wpt(a, b, 0.5 + 0.45 / L, s.clock + 0.35), h2 = wpt(a, b, 0.5 - 0.05 / L, s.clock + 0.85);
          lineSet([[c[0], c[1], h1[0], h1[1]], [c[0], c[1], h2[0], h2[1]]], 0.9, 0.9);
        }
      }
    }
    if (s.cross && SC >= 0.8) drawCross(s.cross);
    if (s.slits && SC >= 1.0) {
      for (const f of s.faces) { if (!f.wall || f.light < 0.05 && !night) {} if (!f.wall) continue; const { a, b, z0, h } = f.wall;
        const q = (t0, t1, za, zb2) => { const v = [wpt(a, b, t0, za), wpt(a, b, t1, za), wpt(a, b, t1, zb2), wpt(a, b, t0, zb2)]; ctx.beginPath(); v.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); };
        q(0.42, 0.58, z0 + 4, z0 + h - 5.5); ctx.fillStyle = night ? '#ffd98a' : '#7d8f99'; ctx.fill(); ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.7; ctx.stroke();
        q(0.25, 0.75, z0 + h - 3.6, z0 + h - 1.2); ctx.fillStyle = night ? '#120f0c' : 'rgba(46,38,32,.85)'; ctx.fill(); ctx.stroke(); }
    }
    if (s.hussCross && SC >= 0.7) {
      const [e, n, z] = s.hussCross, x = PX(e, n), y = PY(e, n, z);
      ctx.strokeStyle = inkC(0.95); ctx.lineWidth = PXU * 1.2; ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x, y - 4.2); ctx.moveTo(x - 0.8, y - 3.3); ctx.lineTo(x + 0.8, y - 3.3); ctx.moveTo(x - 1.15, y - 2.4); ctx.lineTo(x + 1.15, y - 2.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 0.75, y - 1.6); ctx.quadraticCurveTo(x - 0.7, y - 0.7, x, y - 0.6); ctx.quadraticCurveTo(x + 0.7, y - 0.7, x + 0.75, y - 1.6); ctx.closePath();
      ctx.fillStyle = night ? '#e0b860' : '#c79a3c'; ctx.fill(); ctx.stroke();
    }
    if (s.vane && SC >= 0.8) {
      const [e, n, z] = s.vane, x = PX(e, n), y = PY(e, n, z);
      ctx.strokeStyle = inkC(0.9); ctx.lineWidth = PXU * 1.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 3); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 1.1, 0.32, 0, 6.28); ctx.fillStyle = night ? '#c9a24e' : '#c79a3c'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 1.7, y - 2.6); ctx.lineTo(x, y - 2.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}
function drawTheatreFacade(s, o, r) {
  if (!s.ff) return;
  const brick = season === 'winter' ? '#9a5a45' : '#94503a';
  washFace(s.ff.path, brick, 0.55 + 0.45 * Math.min(1, s.ff.light * 1.6), r);
  // window and its plastered frame
  const win = s.fq(-3.0, 6.9, 2.8, 12.0), frame = s.fq(-3.6, 6.4, 3.4, 12.5);
  if (SC >= 0.8) {
    ctx.save(); ctx.clip(s.ff.path);
    // clinker grid running from the edges towards the window
    const segs = [];
    for (let z = 0.9; z < s.fz; z += 0.9) { const p = s.fpt(s.fu0, z), q = s.fpt(s.fu1, z); segs.push([p[0], p[1], q[0], q[1]]); }
    for (let u = s.fu0 + 0.9; u < s.fu1; u += 0.9) { const p = s.fpt(u, 0), q = s.fpt(u, s.fz); segs.push([p[0], p[1], q[0], q[1]]); }
    lineSet(segs, night ? 0.35 : 0.3, 0.75);
    ctx.restore();
  }
  washFace(frame, '#ece6d6', 0.95, r);
  ctx.fillStyle = night ? '#ffd98a' : '#9fb3bd'; ctx.fill(win);
  if (night) { ctx.globalCompositeOperation = 'lighter'; const c = s.fpt(-0.1, 9.4), g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 9); g.addColorStop(0, 'rgba(255,205,120,.4)'); g.addColorStop(1, 'rgba(255,205,120,0)'); ctx.fillStyle = g; ctx.fillRect(c[0] - 9, c[1] - 9, 18, 18); ctx.globalCompositeOperation = 'source-over'; }
  if (SC >= 1.4) {
    const segs = [];
    for (let u = -3.0 + 1.16; u < 2.8; u += 1.16) { const p = s.fpt(u, 6.9), q = s.fpt(u, 12.0); segs.push([p[0], p[1], q[0], q[1]]); }
    for (let z = 6.9 + 1.7; z < 12.0; z += 1.7) { const p = s.fpt(-3.0, z), q = s.fpt(2.8, z); segs.push([p[0], p[1], q[0], q[1]]); }
    lineSet(segs, 0.6, 0.8);
  }
  ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU; ctx.stroke(win); ctx.stroke(frame);
  inkPoly(s.ff.pts, r, 0.8, 1);
  // metal letters below the window, drawn in the facade plane
  if (SC >= 2.2) {
    const o0 = s.fpt(-3.2, 6.65), o1 = s.fpt(-2.2, 6.65);
    ctx.save();
    ctx.transform(o1[0] - o0[0], o1[1] - o0[1], 0, ZK, o0[0], o0[1]);
    ctx.font = '700 0.62px "Alegreya Sans", sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = night ? '#f5e7c4' : '#efe8d8';
    ctx.fillText('TYLOVO DIVADLO', 0, 0, 6.4);
    ctx.restore();
  }
}
function drawTHGable(s, o, r) {
  const pal = P();
  // painted craft emblems above first-floor windows
  if (SC >= 1.6) {
    const cols = ['#b8664a', '#4f7a8c', '#c79a3c', '#6b8f5a', '#8a5a7a'];
    s.shields.forEach((t, i) => {
      const z = s.z0 - 4.6;
      const p = [s.fe(t - 0.38, z + 0.95), s.fe(t + 0.38, z + 0.95), s.fe(t + 0.38, z + 0.35), s.fe(t, z), s.fe(t - 0.38, z + 0.35)].map(q => [PX(q[0], q[1]), PY(q[0], q[1], q[2])]);
      ctx.beginPath(); p.forEach((v, j) => j ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])); ctx.closePath();
      ctx.fillStyle = col(cols[i % cols.length]).s; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = inkC(0.7); ctx.lineWidth = PXU * 0.7; ctx.stroke();
    });
  }
  washFace(s.gable.path, pal.roofSnow ? o.wall : o.wall, 0.95, r);
  inkPoly(s.gable.pts, r, 0.8, 1);
  if (SC >= 1.2) { ctx.fillStyle = night ? '#ffd27a' : '#6e7b86'; ctx.fill(s.gwin.path); ctx.strokeStyle = night ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.9)'; ctx.lineWidth = PXU; ctx.stroke(s.gwin.path); }
  const tip = s.fe(0, s.z0 + 6.2), x = PX(tip[0], tip[1]), y = PY(tip[0], tip[1], tip[2]);
  if (SC >= 0.8) { ctx.strokeStyle = inkC(0.9); ctx.lineWidth = PXU * 1.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - 1.9, 0.25, 0, 6.28); ctx.fillStyle = '#c79a3c'; ctx.fill(); }
}
function pr2(e, n, z) { return [PX(e, n), PY(e, n, z)]; }
function drawCross([e, n, z]) {
  const x = PX(e, n), y = PY(e, n, z);
  ctx.strokeStyle = inkC(0.9); ctx.lineWidth = PXU * 1.1; ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y - 2.6); ctx.moveTo(x - 0.9, y - 1.8); ctx.lineTo(x + 0.9, y - 1.8); ctx.stroke();
}

function figure(x, y, hh, col, halo, r) {
  const p = new Path2D();
  p.moveTo(x - 0.27 * hh, y); p.quadraticCurveTo(x - 0.2 * hh, y - 0.5 * hh, x - 0.15 * hh, y - 0.76 * hh);
  p.lineTo(x + 0.15 * hh, y - 0.76 * hh); p.quadraticCurveTo(x + 0.2 * hh, y - 0.5 * hh, x + 0.27 * hh, y); p.closePath();
  p.moveTo(x + 0.12 * hh, y - 0.87 * hh); p.arc(x, y - 0.87 * hh, 0.12 * hh, 0, Math.PI * 2);
  washFace(p, col, 0.85, r);
  ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.8; ctx.stroke(p);
  if (halo && SC >= 1.2) { ctx.fillStyle = night ? '#ffdf8a' : '#c79a3c'; for (let i = 0; i < 5; i++) { const an = Math.PI + i / 4 * Math.PI; ctx.beginPath(); ctx.arc(x + Math.cos(an) * 0.24 * hh, y - 0.87 * hh + Math.sin(an) * 0.24 * hh, 0.05 * hh + PXU * 0.5, 0, 6.28); ctx.fill(); } }
}
function stoneBox(e, n, s, z0, hgt, col, r) {
  for (const f of boxSolid(square(e, n, s, 1, 0), z0, hgt, null)) { washFace(f.path, col, 0.5 + 0.5 * Math.min(1, f.light * 1.6), r); inkPoly(f.pts, r, 0.75, 0.9); }
  const tp = projPoly(square(e, n, s, 1, 0).map(p => [p[0], p[1], z0 + hgt]));
  washFace(tp.path, col, 1, r); inkPoly(tp.pts, r, 0.75, 0.9);
}
function drawMon(o) {
  if (SC < 0.6) return;
  const r = rng(o.e * 31 + o.n), { e, n, X, Y } = o;
  const stone = season === 'winter' ? '#e8e6e0' : '#dcd2bc';
  if (o.kind === 'plague') {
    stoneBox(e, n, 4.2, 0, 1.2, stone, r);
    stoneBox(e, n, 2.6, 1.2, 1.8, stone, r);
    // corner saints
    for (const [de, dn] of [[-1.6, 0], [0, 1.6]]) {
      figure(PX(e + de, n + dn), PY(e + de, n + dn, 1.2), 1.5 * ZK, '#cdbd94', true, r);
    }
    const z0 = 3.0, z1 = 8.6, w = 0.38;
    const col = new Path2D(); col.rect(X - w, Y - z1 * ZK, w * 2, (z1 - z0) * ZK);
    washFace(col, stone, 0.85, r); ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.9; ctx.stroke(col);
    const cap = new Path2D(); cap.rect(X - 0.62, Y - (z1 + 0.5) * ZK, 1.24, 0.5 * ZK); washFace(cap, stone, 0.9, r); ctx.stroke(cap);
    figure(X, Y - (z1 + 0.5) * ZK, 1.9 * ZK, '#d1bf8e', true, r);
    for (const [de, dn] of [[1.6, 0], [0, -1.6]]) figure(PX(e + de, n + dn), PY(e + de, n + dn, 1.2), 1.5 * ZK, '#cdbd94', true, r);
  } else if (o.kind === 'hus') {
    stoneBox(e, n, 3.2, 0, 0.5, '#bdb7ab', r);
    const z0 = 0.5, z1 = 5.6, w0 = 0.8, w1 = 0.5;
    const p = new Path2D(); p.moveTo(X - w0, Y - z0 * ZK); p.lineTo(X + w0, Y - z0 * ZK); p.lineTo(X + w1, Y - z1 * ZK); p.lineTo(X - w1, Y - z1 * ZK); p.closePath();
    washFace(p, '#a9a49a', 0.8, r); ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU * 0.9; ctx.stroke(p);
    const cap = new Path2D(); cap.rect(X - 0.75, Y - (z1 + 0.6) * ZK, 1.5, 0.6 * ZK); washFace(cap, '#a9a49a', 0.95, r); ctx.stroke(cap);
  } else {
    stoneBox(e, n, 1.3, 0, 2.2, stone, r);
    figure(X, Y - 2.2 * ZK, 1.7 * ZK, '#cdbd94', true, r);
  }
}

function drawDome(d, r) {
  const x = PX(d.e, d.n), y = PY(d.e, d.n, d.z), rx = d.r, ry = d.r * S;
  const drum = 3.4 * ZK, dh = d.r * 1.25 * ZK, top = y - drum;
  const blend = night ? 'source-over' : 'multiply';
  // drum
  const p1 = new Path2D();
  p1.ellipse(x, y, rx, ry, 0, 0, Math.PI); p1.lineTo(x - rx, top); p1.ellipse(x, top, rx, ry, 0, Math.PI, 0, true); p1.closePath();
  ctx.fillStyle = paper(); ctx.fill(p1);
  ctx.globalCompositeOperation = blend;
  let g1 = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g1.addColorStop(0, shade('#f2df9b', 1)); g1.addColorStop(0.55, shade('#f2df9b', 0.85)); g1.addColorStop(1, shade('#f2df9b', 0.45));
  ctx.fillStyle = g1; ctx.fill(p1);
  ctx.globalCompositeOperation = 'source-over';
  if (SC >= 1.2) {
    ctx.fillStyle = night ? '#ffd27a' : '#6e7b86';
    for (let i = -1; i <= 1; i++) { const wx = x + i * rx * 0.55; const wy = y + Math.sqrt(1 - (i * 0.55) ** 2) * ry; ctx.fillRect(wx - 0.45, wy - drum * 0.78, 0.9, drum * 0.45); }
  }
  ctx.strokeStyle = inkC(0.8); ctx.lineWidth = PXU; ctx.stroke(p1);
  // dome
  const p2 = new Path2D();
  p2.ellipse(x, top, rx * 0.96, ry * 0.96, 0, 0, Math.PI); p2.ellipse(x, top, rx * 0.96, dh, 0, Math.PI, Math.PI * 2); p2.closePath();
  ctx.fillStyle = paper(); ctx.fill(p2);
  ctx.globalCompositeOperation = blend;
  const g2 = ctx.createRadialGradient(x - rx * 0.35, top - dh * 0.6, 0, x, top - dh * 0.3, rx * 1.3);
  const dc = season === 'winter' ? '#e8eef1' : '#8fa9a0';
  g2.addColorStop(0, shade(dc, 1)); g2.addColorStop(1, shade(dc, 0.3));
  ctx.fillStyle = g2; ctx.fill(p2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU; ctx.stroke(p2);
  if (SC >= 1.2) {
    ctx.beginPath(); ctx.lineWidth = PXU * 0.75; ctx.strokeStyle = inkC(0.45);
    for (let i = -2; i <= 2; i++) { const f = i / 3; ctx.moveTo(x + rx * 0.96 * f, top + ry * 0.96 * Math.sqrt(1 - f * f)); ctx.quadraticCurveTo(x + rx * f * 0.8, top - dh * 0.75, x, top - dh); }
    ctx.stroke();
  }
  // lantern + finial
  const lw = rx * 0.22, lh = 1.6 * ZK, ly = top - dh + 0.2;
  ctx.fillStyle = shade('#f2df9b', 0.8); ctx.fillRect(x - lw, ly - lh, lw * 2, lh);
  ctx.strokeStyle = inkC(0.85); ctx.lineWidth = PXU; ctx.strokeRect(x - lw, ly - lh, lw * 2, lh);
  ctx.beginPath(); ctx.moveTo(x - lw * 1.2, ly - lh); ctx.quadraticCurveTo(x, ly - lh - lw * 1.6, x + lw * 1.2, ly - lh); ctx.closePath();
  ctx.fillStyle = shade(dc, 0.7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, ly - lh - lw * 0.8); ctx.lineTo(x, ly - lh - lw * 0.8 - 2); ctx.stroke();
}

function blob(cx, cy, R, r) {
  const p = new Path2D(); const n = 9, ph = r() * 6;
  for (let i = 0; i <= n; i++) {
    const a = ph + i / n * Math.PI * 2, rr = R * (0.86 + r() * 0.24);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.92;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath(); return p;
}

function drawTree(t) {
  const pal = P(), r = rng(t.s);
  const blend = night ? 'source-over' : 'multiply';
  const X = t.X, Y = t.Y;
  if (t.k === 1) { // conifer
    const H = t.size * ZK, W = t.size * 0.24 + 0.6;
    const c = pal.conifer[Math.floor(r() * pal.conifer.length)];
    if (SC < 0.45) {
      ctx.globalCompositeOperation = blend; ctx.fillStyle = col(c).s; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(X, Y - H); ctx.lineTo(X + W, Y - 1); ctx.lineTo(X - W, Y - 1); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return;
    }
    const p = new Path2D(); const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const top = Y - H + i * H * 0.24, bot = Y - H * 0.42 + i * H * 0.17 - 0.8, w = W * (0.55 + i * 0.25);
      p.moveTo(X + (r() - .5) * 0.3, top); p.lineTo(X + w + r() * 0.4, bot); p.quadraticCurveTo(X, bot + 0.9, X - w - r() * 0.4, bot); p.closePath();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = paper(); ctx.fill(p);
    ctx.globalCompositeOperation = blend; ctx.fillStyle = col(c).s; ctx.globalAlpha = 0.85; ctx.fill(p);
    ctx.fillStyle = shade(c, 0.3); ctx.globalAlpha = 0.45; ctx.save(); ctx.clip(p); ctx.fillRect(X + W * 0.05, Y - H, W * 2, H); ctx.restore();
    if (pal.roofSnow) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.85; ctx.fillStyle = night ? '#8a93ad' : '#f4f6f7'; ctx.save(); ctx.clip(p); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(X - W * 0.2, Y - H + i * H * 0.24 + H * 0.06, W * 0.45, H * 0.05, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (SC >= 0.9) { ctx.strokeStyle = inkC(0.6); ctx.lineWidth = PXU * 0.8; ctx.stroke(p); ctx.beginPath(); ctx.moveTo(X, Y - H * 0.28); ctx.lineTo(X, Y); ctx.stroke(); }
    return;
  }
  const R = t.size, trunk = t.k === 3 ? 0.3 : 2.2 + R * 0.25;
  const cy = Y - (trunk + R * 0.85) * ZK;
  let cols = t.k === 2 ? pal.blossom : t.k === 3 ? pal.bush : pal.leaves;
  if (pal.bare && t.k !== 3) {
    if (SC < 0.45) { ctx.strokeStyle = inkC(0.35); ctx.lineWidth = PXU; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, cy - R * 0.6); ctx.stroke(); return; }
    // bare winter tree
    ctx.strokeStyle = inkC(0.75); ctx.lineCap = 'round';
    const br = (x, y, a, len, w, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      ctx.lineWidth = Math.max(PXU * 0.6, w); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      if (d > 0) { br(x2, y2, a - 0.45 - r() * 0.3, len * 0.68, w * 0.62, d - 1); br(x2, y2, a + 0.45 + r() * 0.3, len * 0.68, w * 0.62, d - 1); }
    };
    br(X, Y, -Math.PI / 2 + (r() - .5) * 0.2, trunk * ZK + R * 0.4, 0.45, SC >= 1.2 ? 3 : 2);
    ctx.globalCompositeOperation = blend; ctx.globalAlpha = 0.18; ctx.fillStyle = night ? '#232838' : '#9a8c7c';
    ctx.beginPath(); ctx.ellipse(X, cy, R * 0.95, R * 0.9, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return;
  }
  const c1 = cols[Math.floor(r() * cols.length)];
  if (SC < 0.45) {
    ctx.globalCompositeOperation = blend; ctx.fillStyle = col(c1).s; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(X, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return;
  }
  // trunk
  if (t.k !== 3) { ctx.strokeStyle = inkC(0.75); ctx.lineWidth = Math.max(PXU * 0.9, 0.35); ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + (r() - .5) * 0.4, cy + R * 0.3); ctx.stroke(); }
  const p = new Path2D();
  const blobs = [];
  for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2, d = R * 0.38 * r(); blobs.push([X + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * 0.8, R * (0.58 + r() * 0.2)]); }
  blobs.forEach(([x, y, rr]) => p.addPath(blob(x, y, rr, r)));
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = paper(); ctx.globalAlpha = 0.9; ctx.fill(p); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = blend;
  ctx.fillStyle = col(c1).s; ctx.globalAlpha = 0.7; ctx.fill(p);
  // shade lower right
  ctx.save(); ctx.clip(p); ctx.fillStyle = shade(c1, 0.25); ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.ellipse(X + R * 0.55, cy + R * 0.4, R * 0.9, R * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.globalAlpha = 1;
  if (t.k === 2 && season === 'spring' && SC >= 0.8) {
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = night ? 'rgba(220,190,200,.5)' : 'rgba(255,250,248,.85)';
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * R * 0.85; ctx.beginPath(); ctx.arc(X + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, PXU * (0.9 + r() * 0.8), 0, 6.28); ctx.fill(); }
  }
  ctx.globalCompositeOperation = 'source-over';
  if (SC >= 0.9) {
    ctx.strokeStyle = inkC(0.55); ctx.lineWidth = PXU * 0.8; ctx.beginPath();
    const a0 = Math.PI * (0.05 + r() * 0.2);
    ctx.ellipse(X + R * 0.1, cy + R * 0.05, R * 1.02, R * 0.95, 0, a0, a0 + Math.PI * (0.8 + r() * 0.5));
    ctx.stroke();
  }
}

function drawLamp(l) {
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(l.X, l.Y, 0, l.X, l.Y, 11);
  g.addColorStop(0, 'rgba(255,214,140,.45)'); g.addColorStop(0.4, 'rgba(255,190,110,.15)'); g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g; ctx.fillRect(l.X - 11, l.Y - 11, 22, 22);
  ctx.fillStyle = 'rgba(255,235,180,.95)'; ctx.fillRect(l.X - PXU * 1.2, l.Y - PXU * 1.2, PXU * 2.4, PXU * 2.4);
  ctx.globalCompositeOperation = 'source-over';
}

function renderTile(k, ix, iy) {
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  ctx = c.getContext('2d');
  SC = Math.pow(2, k); PXU = 1 / SC;
  const tw = TILE / SC, ox = ix * tw, oy = iy * tw;
  const x0 = ox - 2, y0 = oy - 2, x1 = ox + tw + 2, y1 = oy + tw + 2;
  ctx._ox = -ox * SC; ctx._oy = -oy * SC;
  ctx.setTransform(SC, 0, 0, SC, ctx._ox, ctx._oy);
  ctx.save();
  ctx.clip(boundary);
  // paper + ground
  ctx.fillStyle = paper(); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalCompositeOperation = night ? 'source-over' : 'multiply';
  ctx.fillStyle = col(P().ground).s; ctx.globalAlpha = night ? 1 : 0.55; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // areas
  const areas = GA.query(x0, y0, x1, y1).sort((a, b) => a.ord - b.ord);
  for (const a of areas) { if (a.hidden) continue; if (a.custom) a.draw(); else drawArea(a); }
  // lines
  const lines = GL.query(x0, y0, x1, y1).sort((a, b) => a.ord - b.ord);
  for (const l of lines) drawLineObj(l, 0);
  for (const l of lines) if (l.t === 'road') drawLineObj(l, 1);
  for (const l of lines) drawLineObj(l, 2);
  for (const a of areas) if (a.over && !a.hidden) a.over();
  if (night && SC >= 0.25) for (const l of GLp.query(x0, y0, x1, y1)) drawLamp(l);
  // objects
  const objs = GO.query(x0, y0, x1, y1);
  for (const o of objs) drawShadow(o);
  objs.sort((a, b) => a.depth - b.depth);
  for (const o of objs) (o.type === 'b' ? drawBuilding(o) : o.type === 'm' ? drawMon(o) : o.type === 'x' ? o.draw() : drawTree(o));
  // paper texture
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(BLOOM, 'repeat'); ctx.globalAlpha = night ? 0.5 : 0.9; ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.globalAlpha = night ? 0.6 : 1; ctx.fillRect(0, 0, TILE, TILE);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // bleed edge
  ctx.setTransform(SC, 0, 0, SC, ctx._ox, ctx._oy);
  ctx.strokeStyle = night ? 'rgba(10,12,25,.5)' : 'rgba(150,140,95,.35)'; ctx.lineWidth = PXU * 2.5; ctx.stroke(boundary);
  ctx.strokeStyle = night ? 'rgba(10,12,25,.2)' : 'rgba(170,160,110,.12)'; ctx.lineWidth = PXU * 16; ctx.stroke(boundary);
  ctx.restore();
  return c;
}

/* ---------- view & tile cache ---------- */
const mapEl = document.getElementById('map'), cv = document.getElementById('tiles'), lv = document.getElementById('labels');
const g = cv.getContext('2d'), lg = lv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const view = { x: 0, y: 0, s: 1 };
const S_MIN = 0.1, S_MAX = 5;
const cache = new Map();
const CACHE_MAX = 90;
let queue = [], wanted = new Set();
function key(k, ix, iy) { return season + (night ? 'N' : 'D') + '|' + k + '|' + ix + '|' + iy; }

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = mapEl.clientWidth; H = mapEl.clientHeight;
  for (const c of [cv, lv]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  requestDraw();
}

function levelFor(s) { return Math.max(LVL_MIN, Math.min(LVL_MAX, Math.round(Math.log2(s * DPR) + 0.15))); }
function screenToWorld(sx, sy) { return [view.x + (sx - W / 2) / view.s, view.y + (sy - H / 2) / view.s]; }

let drawPending = false;
function requestDraw() { if (!drawPending) { drawPending = true; requestAnimationFrame(draw); } }

function tileCanvas(k, ix, iy) { const kk = key(k, ix, iy); const c = cache.get(kk); if (c) { cache.delete(kk); cache.set(kk, c); } return c; }

function draw() {
  drawPending = false;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  const k = levelFor(view.s);
  const sc = Math.pow(2, k), tw = TILE / sc;
  const [wx0, wy0] = screenToWorld(0, 0), [wx1, wy1] = screenToWorld(W, H);
  const ix0 = Math.floor(wx0 / tw), ix1 = Math.floor(wx1 / tw), iy0 = Math.floor(wy0 / tw), iy1 = Math.floor(wy1 / tw);
  const need = [];
  const f = view.s * DPR;
  g.imageSmoothingQuality = 'high';
  for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) {
    const ox = ix * tw, oy = iy * tw;
    if (ox > WX1 + 20 || ox + tw < WX0 - 20 || oy > WY1 + 20 || oy + tw < WY0 - 60) continue;
    const dx0 = Math.round((ox - view.x) * f + cv.width / 2), dy0 = Math.round((oy - view.y) * f + cv.height / 2);
    const dx1 = Math.round((ox + tw - view.x) * f + cv.width / 2), dy1 = Math.round((oy + tw - view.y) * f + cv.height / 2);
    const c = tileCanvas(k, ix, iy);
    if (c) { g.drawImage(c, dx0, dy0, dx1 - dx0, dy1 - dy0); continue; }
    need.push([k, ix, iy, Math.hypot((ox + tw / 2 - view.x), (oy + tw / 2 - view.y))]);
    // fallback: coarser ancestor
    let done = false;
    for (let j = 1; k - j >= LVL_MIN && !done; j++) {
      const ax = Math.floor(ix / (1 << j)), ay = Math.floor(iy / (1 << j));
      const a = tileCanvas(k - j, ax, ay);
      if (a) {
        const sub = TILE / (1 << j), sx = (ix - ax * (1 << j)) * sub, sy = (iy - ay * (1 << j)) * sub;
        g.drawImage(a, sx, sy, sub, sub, dx0, dy0, dx1 - dx0, dy1 - dy0); done = true;
      }
    }
    if (!done) { // finer children
      const ck = k + 1; if (ck <= LVL_MAX) for (let cx = 0; cx < 2; cx++) for (let cy = 0; cy < 2; cy++) {
        const ch = tileCanvas(ck, ix * 2 + cx, iy * 2 + cy);
        if (ch) { const hx = (dx1 - dx0) / 2, hy = (dy1 - dy0) / 2; g.drawImage(ch, dx0 + cx * hx, dy0 + cy * hy, hx, hy); }
      }
    }
  }
  need.sort((a, b) => a[3] - b[3]);
  queue = need;
  queueIndex = 0;
  drawLabels();
  if (queue.length) scheduleWork();
  else hideLoading();
}

let working = false, queueIndex = 0;
function scheduleWork() {
  if (working) return; working = true;
  const step = () => {
    const t0 = performance.now();
    while (queueIndex < queue.length && performance.now() - t0 < 14) {
      const [k, ix, iy] = queue[queueIndex++];
      const kk = key(k, ix, iy);
      if (cache.has(kk)) continue;
      cache.set(kk, renderTile(k, ix, iy));
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    working = false;
    requestDraw();
  };
  setTimeout(step, 0);
}

let loadingHidden = false;
function hideLoading() { if (loadingHidden) return; loadingHidden = true; const l = document.getElementById('loading'); l.style.opacity = 0; setTimeout(() => l.remove(), 700); }

/* ---------- labels ---------- */
const LABELS = [];
(function buildLabels() {
  const kindRank = { 'place:town': 0, 'place:village': 1, 'place:neighbourhood': 2, 'place:hamlet': 2, 'place:locality': 3 };
  for (const p of RAW.pois) {
    const e = p.x / 10, n = p.y / 10;
    if (p.k.startsWith('place:')) {
      const r = kindRank[p.k] ?? 3;
      LABELS.push({ t: p.n, e, n, z: 0, size: [40, 27, 22, 20][r], min: [0, 0.12, 0.35, 0.5][r], max: r === 0 ? 1.6 : 99, pri: r, style: 'place' });
    } else if (p.k === 'natural:peak' && p.e) {
      LABELS.push({ t: p.n + ', ' + Math.round(+p.e) + ' m', e, n, z: 0, size: 18, min: 0.3, pri: 4, style: 'peak' });
    } else if (['natural:water', 'leisure:sports_centre', 'landuse:cemetery', 'tourism:viewpoint', 'man_made:tower', 'historic:memorial', 'amenity:bus_station'].includes(p.k)) {
      if (p.k === 'tourism:viewpoint') continue;
      LABELS.push({ t: p.n.replace('Lomnice nad Popelkou, ', ''), e, n, z: 0, size: p.k === 'historic:memorial' ? 16 : 18, min: p.k === 'historic:memorial' ? 2.2 : 0.9, pri: 6, style: p.k === 'natural:water' ? 'water' : 'poi' });
    }
  }
  for (const b of BLDS) {
    if (!b.n || b.noLabel) continue;
    const major = ['landmark', 'amenity:school'].includes(b.k);
    LABELS.push({ t: b.n.replace(' Lomnice nad Popelkou', ''), e: b.e, n: b.nn, z: (b.style === 'husuv' ? b.peak + 3 : Math.min(b.peak, 16) + 1.5), size: major ? 20 : 16, min: major ? 0.7 : 2.0, pri: major ? 5 : 8, style: 'bld', bid: b.id });
  }
  const st = BLDS.find(b => b.t === 'train_station');
  if (st) LABELS.push({ t: 'Nádraží', e: st.e, n: st.nn, z: st.peak + 2, size: 18, min: 0.7, pri: 5, style: 'bld' });
  // streets & river names (longest segment)
  const seen = new Map();
  for (const l of LINES) {
    if (!l.n || (l.t !== 'road' && l.t !== 'water')) continue;
    let best = null, bl = 0;
    for (let i = 2; i < l.p.length; i += 2) {
      const ae = l.p[i - 2] / 10, an = l.p[i - 1] / 10, be = l.p[i] / 10, bn = l.p[i + 1] / 10, L = Math.hypot(be - ae, bn - an);
      if (L > bl) { bl = L; best = [ae, an, be, bn]; }
    }
    if (!best || bl < 25) continue;
    const e = (best[0] + best[2]) / 2, n = (best[1] + best[3]) / 2;
    const prev = seen.get(l.n) || [];
    if (prev.some(([pe, pn]) => Math.hypot(pe - e, pn - n) < (l.t === 'water' ? 600 : 250))) continue;
    prev.push([e, n]); seen.set(l.n, prev);
    const ax = PX(best[0], best[1]), ay = PY(best[0], best[1], 0), bx = PX(best[2], best[3]), by = PY(best[2], best[3], 0);
    let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    LABELS.push({ t: l.n, e, n, z: 0, size: l.t === 'water' ? 18 : 15, min: l.t === 'water' ? 0.6 : 1.3, pri: l.t === 'water' ? 7 : 9, style: l.t === 'water' ? 'river' : 'street', ang, segLen: Math.hypot(bx - ax, by - ay) });
  }
  LABELS.forEach(L => { if (L.t.startsWith('Vyhlídková věž')) { L.z = 32; L.min = 0.5; } L.X = PX(L.e, L.n); L.Y = PY(L.e, L.n, L.z); });
  LABELS.sort((a, b) => a.pri - b.pri);
})();

const ICONS = [];
const BUILDING_IMAGES = new Map([
  ['81195353', 'radnice.jpg'],
  ['81195484', 'kostel.jpg']
]);
function drawLabels() {
  lg.setTransform(DPR, 0, 0, DPR, 0, 0);
  lg.clearRect(0, 0, W, H);
  ICONS.length = 0;
  const boxes = [];
  const inkCol = night ? '#f3ead6' : '#3a2f25', halo = night ? 'rgba(25,28,45,.85)' : 'rgba(248,242,226,.9)';
  for (const L of LABELS) {
    if (view.s < L.min || view.s > (L.max || 99)) continue;
    const sx = (L.X - view.x) * view.s + W / 2, sy = (L.Y - view.y) * view.s + H / 2;
    if (sx < -200 || sx > W + 200 || sy < -50 || sy > H + 50) continue;
    const fs = L.size * (L.style === 'place' && L.pri === 0 ? Math.min(1.25, Math.max(0.8, 0.9 + view.s * 0.2)) : 1);
    lg.font = `${L.style === 'street' ? 600 : 700} ${fs}px Caveat, "Bradley Hand", cursive`;
    const w = lg.measureText(L.t).width;
    if (L.style === 'street' || L.style === 'river') { if (w > L.segLen * view.s * 1.1) continue; }
    const bw = L.ang ? Math.abs(Math.cos(L.ang)) * w + Math.abs(Math.sin(L.ang)) * fs : w;
    const bh = L.ang ? Math.abs(Math.sin(L.ang)) * w + Math.abs(Math.cos(L.ang)) * fs : fs;
    const ty = L.style === 'bld' ? sy - fs * 0.4 : sy;
    const box = [sx - bw / 2 - 4, ty - bh / 2 - 3, sx + bw / 2 + 4, ty + bh / 2 + 3];
    if (boxes.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    boxes.push(box);
    lg.save(); lg.translate(sx, ty); if (L.ang) lg.rotate(L.ang);
    lg.textAlign = 'center'; lg.textBaseline = 'middle';
    lg.lineJoin = 'round'; lg.strokeStyle = halo; lg.lineWidth = L.style === 'place' ? 5 : 4;
    lg.fillStyle = L.style === 'river' || L.style === 'water' ? (night ? '#a9c6d8' : '#3f6b80') : inkCol;
    if (L.style === 'bld') {
      lg.strokeText(L.t, 0, -2); lg.fillText(L.t, 0, -2);
      lg.strokeStyle = inkCol; lg.lineWidth = 1.2; lg.beginPath();
      lg.moveTo(0, fs * 0.45); lg.lineTo(0, fs * 0.4 + 6); lg.stroke();
      const imageFile = BUILDING_IMAGES.get(String(L.bid));
      if (imageFile) {
        const iy = fs * 0.45 + 16;
        lg.beginPath(); lg.arc(0, iy, 8, 0, Math.PI * 2);
        lg.fillStyle = night ? '#2b251f' : '#fbf7ea'; lg.fill();
        lg.strokeStyle = inkCol; lg.lineWidth = 1.4; lg.stroke();
        lg.font = 'italic 700 12px Georgia, "Times New Roman", serif';
        lg.fillStyle = inkCol; lg.textBaseline = 'middle'; lg.fillText('i', 0, iy + 0.5);
        ICONS.push({ x: sx, y: ty + iy, id: L.bid, file: imageFile });
      }
    } else { lg.strokeText(L.t, 0, 0); lg.fillText(L.t, 0, 0); }
    lg.restore();
  }
  if (selected) {
    const sx = (selected.X - view.x) * view.s + W / 2, sy = (selected.Y - view.y) * view.s + H / 2;
    lg.strokeStyle = night ? '#ffd27a' : '#b8664a'; lg.lineWidth = 2; lg.setLineDash([5, 4]);
    lg.beginPath(); lg.ellipse(sx, sy, Math.max(16, selected.rx * view.s), Math.max(9, selected.ry * view.s), 0, 0, Math.PI * 2); lg.stroke(); lg.setLineDash([]);
  }
}

/* ---------- interaction ---------- */
function clampView() {
  view.s = Math.max(S_MIN, Math.min(S_MAX, view.s));
  view.x = Math.max(WX0, Math.min(WX1, view.x));
  view.y = Math.max(WY0, Math.min(WY1, view.y));
}
function zoomAt(sx, sy, factor) {
  const [wx, wy] = screenToWorld(sx, sy);
  view.s *= factor; view.s = Math.max(S_MIN, Math.min(S_MAX, view.s));
  view.x = wx - (sx - W / 2) / view.s; view.y = wy - (sy - H / 2) / view.s;
  clampView(); requestDraw();
}
const pointers = new Map();
let lastPinch = null, moved = 0, downAt = null;
mapEl.addEventListener('pointerdown', e => {
  mapEl.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  mapEl.classList.add('drag'); moved = 0; downAt = [e.clientX, e.clientY]; lastPinch = null; cancelFly();
});
mapEl.addEventListener('pointermove', e => {
  if (!pointers.size) { const r = mapEl.getBoundingClientRect(); const over = ICONS.some(c => Math.hypot(c.x - (e.clientX - r.left), c.y - (e.clientY - r.top)) < 13); mapEl.style.cursor = over ? 'pointer' : ''; }
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 1) {
    view.x -= (e.clientX - prev[0]) / view.s; view.y -= (e.clientY - prev[1]) / view.s;
    moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    clampView(); requestDraw();
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (lastPinch) {
      const r = mapEl.getBoundingClientRect();
      view.x -= (mx - lastPinch.mx) / view.s; view.y -= (my - lastPinch.my) / view.s;
      zoomAt(mx - r.left, my - r.top, d / lastPinch.d);
    }
    lastPinch = { d, mx, my }; moved += 10;
  }
});
const endPtr = e => {
  pointers.delete(e.pointerId); lastPinch = null;
  if (!pointers.size) {
    mapEl.classList.remove('drag');
    if (moved < 6 && downAt) { const r = mapEl.getBoundingClientRect(); pick(e.clientX - r.left, e.clientY - r.top); }
  }
};
mapEl.addEventListener('pointerup', endPtr);
mapEl.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); lastPinch = null; mapEl.classList.remove('drag'); });
mapEl.addEventListener('wheel', e => {
  e.preventDefault(); cancelFly();
  const r = mapEl.getBoundingClientRect();
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * 0.0016));
}, { passive: false });
mapEl.addEventListener('dblclick', e => { const r = mapEl.getBoundingClientRect(); flyTo(...screenToWorld(e.clientX - r.left, e.clientY - r.top), view.s * 2); });
mapEl.addEventListener('keydown', e => {
  const step = 80 / view.s;
  if (e.key === 'ArrowLeft') view.x -= step; else if (e.key === 'ArrowRight') view.x += step;
  else if (e.key === 'ArrowUp') view.y -= step; else if (e.key === 'ArrowDown') view.y += step;
  else if (e.key === '+' || e.key === '=') return zoomAt(W / 2, H / 2, 1.5);
  else if (e.key === '-') return zoomAt(W / 2, H / 2, 1 / 1.5);
  else return;
  e.preventDefault(); clampView(); requestDraw();
});
document.getElementById('zin').onclick = () => flyTo(view.x, view.y, view.s * 1.8);
document.getElementById('zout').onclick = () => flyTo(view.x, view.y, view.s / 1.8);

let flyRaf = null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function cancelFly() { if (flyRaf) cancelAnimationFrame(flyRaf); flyRaf = null; }
function flyTo(x, y, s) {
  cancelFly();
  s = Math.max(S_MIN, Math.min(S_MAX, s));
  const a = { ...view }, t0 = performance.now(), dur = reduceMotion ? 0 : 650;
  const step = now => {
    const t = dur ? Math.min(1, (now - t0) / dur) : 1, k = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const ls = Math.log(a.s) + (Math.log(s) - Math.log(a.s)) * k;
    view.s = Math.exp(ls); view.x = a.x + (x - a.x) * k; view.y = a.y + (y - a.y) * k;
    clampView(); requestDraw();
    if (t < 1) flyRaf = requestAnimationFrame(step); else flyRaf = null;
  };
  flyRaf = requestAnimationFrame(step);
}

/* ---------- picking & info ---------- */
let selected = null;
const info = document.getElementById('info');
function pip(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length / 2 - 1; i < p.length / 2; j = i++) {
    const xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pick(sx, sy) {
  const ic = ICONS.find(c => Math.hypot(c.x - sx, c.y - sy) < 13);
  if (ic) { openBuildingImage(ic.file); return; }
  const [wx, wy] = screenToWorld(sx, sy);
  const cands = GO.query(wx - 1, wy - 1, wx + 1, wy + 1).filter(o => o.type === 'b');
  let best = null;
  for (const b of cands) {
    if (best && b.depth < best.depth) continue;
    if (b.solids.some(s => (s.faces || []).some(f => pip(wx, wy, f.pts)))) best = b;
  }
  if (!best) { closeInfo(); return; }
  showInfo(best);
}
function showInfo(b) {
  const kind = KIND_NAMES[b.t] || 'Budova';
  const imageFile = BUILDING_IMAGES.get(String(b.id));
  const infoImageBtn = document.getElementById('infoImageBtn');
  infoImageBtn.hidden = !imageFile;
  infoImageBtn.onclick = imageFile ? () => openBuildingImage(imageFile) : null;
  info.querySelector('h2').textContent = b.n || kind;
  const bits = [];
  if (b.n) bits.push(kind);
  if (b.lv && !['garage', 'garages', 'shed', 'roof'].includes(b.t)) bits.push(`${b.lv} ${b.lv === 1 ? 'podlaží' : 'podlaží'}`);
  if (b.desc) { bits.length = 0; bits.push(b.desc); }
  info.querySelector('p').textContent = (b.desc ? bits[0] + ' ' : (bits.length ? bits.join(', ') + ', ' : '')) + 'Číslo budovy ' + b.id + '.';
  info.classList.add('open');
  const x = PX(b.e, b.nn), y = PY(b.e, b.nn, 0);
  const sz = Math.max(b.bb[2] - b.bb[0], 10);
  selected = { X: x, Y: y, rx: sz * 0.55, ry: sz * 0.3 };
  requestDraw();
}
function closeInfo() { info.classList.remove('open'); selected = null; requestDraw(); }
info.querySelector('.x').onclick = closeInfo;

const photoModal = document.getElementById('photoModal');
const buildingPhoto = document.getElementById('buildingPhoto');
const photoCaption = document.getElementById('photoCaption');
const photoClose = document.getElementById('photoClose');
buildingPhoto.addEventListener('load', () => {
  const stage = document.getElementById('photoStage');
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('image-ready')));
});
const photoHistory = [];
let currentPhotoFile = null;
function openBuildingImage(file, addHistory = true) {
  if (addHistory) {
    if (photoModal.classList.contains('open') && currentPhotoFile) photoHistory.push(currentPhotoFile);
    else photoHistory.length = 0;
  }
  currentPhotoFile = file;
  const captions = { 'radnice.jpg': 'Radnice', 'radnice_prizemi.webp': 'Radnice – přízemí', 'radnice_prizemi_1.webp': 'Radnice – Farní úřad', 'radnice_1_patro.webp': 'Radnice – 1. patro', 'radnice_1_patro_1.webp': 'Radnice – 1. patro, pravá část', 'radnice_1_patro_2.webp': 'Radnice – kanceláře', 'kostel.jpg': 'Kostel sv. Mikuláše' };
  const stage = document.getElementById('photoStage');
  stage.classList.remove('image-ready');
  stage.dataset.building = file === 'radnice.jpg' ? 'radnice' : file === 'radnice_prizemi.webp' ? 'radnice-interior' : file === 'radnice_1_patro.webp' ? 'radnice-first-floor' : file === 'radnice_1_patro_2.webp' ? 'radnice-second-floor' : 'kostel';
  buildingPhoto.src = 'pic/' + file;
  buildingPhoto.alt = captions[file] || 'Fotografie budovy';
  photoCaption.textContent = captions[file] || '';
  photoModal.classList.add('open');
  photoModal.setAttribute('aria-hidden', 'false');
}
function closeBuildingImage() {
  photoModal.classList.remove('open');
  photoModal.setAttribute('aria-hidden', 'true');
  buildingPhoto.removeAttribute('src');
  currentPhotoFile = null;
  photoHistory.length = 0;
}
photoClose.onclick = closeBuildingImage;
document.getElementById('photoBack').onclick = () => {
  const previousFile = photoHistory.pop();
  if (previousFile) openBuildingImage(previousFile, false);
  else closeBuildingImage();
};
document.getElementById('photoMap').onclick = closeBuildingImage;
document.getElementById('doorRadnice').onclick = () => openBuildingImage('radnice_prizemi.webp');
document.querySelector('.waypoint-farni').onclick = () => openBuildingImage('radnice_prizemi_1.webp');
document.querySelector('.waypoint-patro').onclick = () => openBuildingImage('radnice_1_patro.webp');
document.querySelector('.waypoint-back-right').onclick = () => openBuildingImage('radnice_1_patro_1.webp');
document.querySelector('.waypoint-back-left').onclick = () => openBuildingImage('radnice_1_patro_2.webp');
document.querySelector('.waypoint-second-mayor').onclick = () => openBuildingImage('Starosta.webp');
document.querySelector('.waypoint-second-deputy').onclick = () => openBuildingImage('Mistostarosta.png');
photoModal.addEventListener('click', e => { if (e.target === photoModal) closeBuildingImage(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && photoModal.classList.contains('open')) closeBuildingImage(); });

/* ---------- places list ---------- */
const placesEl = document.getElementById('places'), placesBtn = document.getElementById('placesBtn');
const theatre = BLDS.find(b => b.n === 'Tylovo divadlo');
const PLACES = [];
const byId = id => BLDS.find(b => b.id === id);
const addB = (b, title, sub, s = 2.4) => b && PLACES.push({ title, sub, x: PX(b.e, b.nn), y: PY(b.e, b.nn, b.h / 2), s, b });
const addP = (name, title, sub, s = 1.6) => { const p = RAW.pois.find(q => q.n === name); if (p) PLACES.push({ title, sub, x: PX(p.x / 10, p.y / 10), y: PY(p.x / 10, p.y / 10, 0), s }); };
addB(byId(81195353), 'Radnice', 'Neogotická radnice s hodinovou věží', 2.4);
addB(byId(81195484), 'Kostel sv. Mikuláše', 'Pozdně barokní kostel bez věže', 2.4);
addB(byId(81195335), 'Zámek', 'Barokní zámek s mansardovou střechou', 2.4);
addB(byId(81196163), 'Městské muzeum', 'Šlechtův Hrubý dům', 2.6);
addB(byId(81194682), 'Základní škola T. G. Masaryka', 'Škola z roku 1932 na Školním náměstí', 2.2);
addB(byId(81195159), 'Střední škola', 'Areál střední školy', 2.2);
addP('Morový sloup', 'Morový sloup', 'Barokní sloup se sochami světců', 3.5);
addB(theatre, 'Tylovo divadlo', 'Funkcionalistické divadlo', 2.4);
if (KARLOV.length) { const m = KARLOV[0][Math.floor(KARLOV[0].length / 2)]; PLACES.push({ title: 'Karlovské náměstí', sub: 'Roubené domy s vyřezávanými štíty', x: PX(m[0], m[1]), y: PY(m[0], m[1], 0), s: 2.4 }); }
addB(byId(207217667), 'Dřevěná zvonice', 'Nejstarší stavba ve městě (1652)', 3);
addB(byId(207218071), 'Kaple sv. Jana Křtitele', 'Barokní hřbitovní kaple', 2.6);
addB(BLDS.find(b => b.t === 'train_station'), 'Nádraží', 'Železniční stanice', 2.2);
addP('Skokanský můstek K70', 'Skokanský můstek K70', 'S vyhlídkovou věží', 1.6);
addP('Koupaliště', 'Koupaliště', 'Sport a léto', 1.8);
addP('Letní stadion generála Ludvíka Svobody', 'Letní stadion', 'Fotbal a atletika', 1.6);
addP('Matoušův rybník', 'Matoušův rybník', 'Rybník', 1.6);
addP('Smetanova vyhlídka', 'Smetanova vyhlídka', 'Vrchol, 601 m', 0.9);
PLACES.forEach(p => {
  const btn = document.createElement('button'); btn.className = 'place';
  btn.innerHTML = `<b></b><span></span>`; btn.querySelector('b').textContent = p.title; btn.querySelector('span').textContent = p.sub;
  btn.onclick = () => { flyTo(p.x, p.y, p.s); if (p.b) showInfo(p.b); else closeInfo(); if (innerWidth < 620) togglePlaces(false); };
  placesEl.appendChild(btn);
});
function togglePlaces(v) { const open = v ?? !placesEl.classList.contains('open'); placesEl.classList.toggle('open', open); placesBtn.setAttribute('aria-expanded', open); }
placesBtn.onclick = () => togglePlaces();

/* ---------- season & time ---------- */
function setMode(s, n) {
  season = s; night = n;
  document.querySelectorAll('[data-season]').forEach(b => b.setAttribute('aria-pressed', b.dataset.season === s));
  document.querySelectorAll('[data-time]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.time === 'night') === n));
  try { localStorage.setItem('lomnice-mode', JSON.stringify([s, n])); } catch (e) { }
  // keep previous tiles only as fallback drawing (they belong to another key), so just redraw
  prewarm();
  requestDraw();
}
document.querySelectorAll('[data-season]').forEach(b => b.onclick = () => setMode(b.dataset.season, night));
document.querySelectorAll('[data-time]').forEach(b => b.onclick = () => setMode(season, b.dataset.time === 'night'));

let prewarmToken = 0;
function prewarm() {
  // Prepare only coarse tiles intersecting the current viewport; build them in short tasks.
  const token = ++prewarmToken, k = LVL_MIN, tw = TILE / Math.pow(2, k);
  const [x0, y0] = screenToWorld(0, 0), [x1, y1] = screenToWorld(W, H);
  const ix0 = Math.max(Math.floor((WX0 - 20) / tw), Math.floor(Math.min(x0, x1) / tw));
  const ix1 = Math.min(Math.floor((WX1 + 20) / tw), Math.floor(Math.max(x0, x1) / tw));
  const iy0 = Math.max(Math.floor((WY0 - 60) / tw), Math.floor(Math.min(y0, y1) / tw));
  const iy1 = Math.min(Math.floor((WY1 + 20) / tw), Math.floor(Math.max(y0, y1) / tw));
  const jobs = [];
  for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) {
    const kk = key(k, ix, iy);
    if (!cache.has(kk)) jobs.push([ix, iy, Math.hypot((ix + 0.5) * tw - view.x, (iy + 0.5) * tw - view.y)]);
  }
  jobs.sort((a, b) => a[2] - b[2]);
  let jobIndex = 0;
  const step = () => {
    if (token !== prewarmToken) return;
    const started = performance.now();
    while (jobIndex < jobs.length && performance.now() - started < 7) {
      const [ix, iy] = jobs[jobIndex++], kk = key(k, ix, iy);
      if (!cache.has(kk)) {
        cache.set(kk, renderTile(k, ix, iy));
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      }
    }
    if (jobIndex < jobs.length) setTimeout(step, 0);
    else requestDraw();
  };
  if (jobs.length) setTimeout(step, 0);
}

const home = () => { flyTo(PX(790, -80), PY(790, -80, 0) - 15, Math.min(W, H) < 600 ? 1.9 : 2.5); };
document.getElementById('home').onclick = home;


/* ---------- fullscreen (or a full-window tab when embedded without permission) ---------- */
(function () {
  const btn = document.getElementById('fsBtn'), root = document.documentElement;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  const canFs = !!(req && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  const toast = msg => { const t = document.createElement('div'); t.className = 'sheet'; t.textContent = msg; t.setAttribute('role', 'status');
    Object.assign(t.style, { left: '14px', top: 'calc(env(safe-area-inset-top,0px) + 14px)', padding: '10px 14px', maxWidth: '320px', zIndex: 30, fontSize: '15px' });
    document.body.appendChild(t); setTimeout(() => t.remove(), 4500); };
  const openTab = () => {
    let url = null;
    try {
      const pageSource = "<!doctype html>\n" + document.documentElement.outerHTML;
      const baseHref = new URL('.', location.href).href;
      const pageWithBase = pageSource.replace('<head>', '<head><base href="' + baseHref.replace(/"/g, '%22') + '">');
      url = URL.createObjectURL(new Blob([pageWithBase], { type: 'text/html' }));
    } catch (e) { }
    const w = url ? window.open(url, '_blank') : null;
    if (!w) toast('Prohlížeč nedovolil otevřít novou kartu. Zvětšete prosím rámeček s mapou na stránce.');
  };
  const sync = () => {
    const on = isFs();
    btn.querySelector('.fs-on').style.display = on ? 'none' : '';
    btn.querySelector('.fs-off').style.display = on ? '' : 'none';
    const label = on ? 'Ukončit celou obrazovku' : (canFs ? 'Celá obrazovka' : 'Otevřít mapu v celém okně');
    btn.setAttribute('aria-label', label); btn.title = label;
    resize();
  };
  btn.addEventListener('click', () => {
    if (isFs()) { try { exit.call(document); } catch (e) { } return; }
    if (canFs) {
      try { const p = req.call(root); if (p && p.catch) p.catch(() => (embedded ? openTab() : null)); }
      catch (e) { if (embedded) openTab(); }
    } else if (embedded) openTab();
  });
  if (!canFs && !embedded) btn.hidden = true;
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
})();
/* ---------- start ---------- */
try { const m = JSON.parse(localStorage.getItem('lomnice-mode')); if (m && PAL[m[0]]) { season = m[0]; night = !!m[1]; } } catch (e) { }
document.querySelectorAll('[data-season]').forEach(b => b.setAttribute('aria-pressed', b.dataset.season === season));
document.querySelectorAll('[data-time]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.time === 'night') === night));
window.addEventListener('resize', resize);
resize();
const t = theatre || BLDS[0];
view.x = PX(790, -80); view.y = PY(790, -80, 0) - 15; view.s = Math.min(W, H) < 600 ? 1.9 : 2.5;
setTimeout(() => { prewarm(); requestDraw(); }, 30);
if (document.fonts) document.fonts.ready.then(requestDraw);

window.__view = view; window.__draw = requestDraw; window.__queue = () => queue.length; window.__setMode = setMode;
})();

})
.catch(error => {
  console.error('Map data loading failed:', error);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'Mapu se nepodařilo načíst. Obnovte stránku nebo zkuste připojení.';
});
