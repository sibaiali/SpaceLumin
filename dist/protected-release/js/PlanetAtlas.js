/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (PlanetAtlas.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
const PLANET_PROFILES = [
{ sector: 1, name: 'Mercury', type: 'rocky', palette: ['#2f2c2a', '#5c5752', '#8d867e', '#bab2a7'], craters: 160,
radius: 70, rot: 0.24, tilt: 0.03, atmo: '#c9c2b8', atmoS: 0.25, sun: '#fff1d6', ambient: 0.05,
nebula: [0xf59e0b, 0x78716c, 0x38bdf8], clear: 0x06060a, moons: 0,
fact: 'Closest world to the Sun: 430 °C by day, −180 °C at night.' },
{ sector: 2, name: 'Venus', type: 'venus', palette: ['#7a4d16', '#b9863f', '#e2c27f', '#f6e6bd'],
radius: 90, rot: -0.2, tilt: 0.05, atmo: '#ffd08a', atmoS: 1.2, sun: '#fff0cf', ambient: 0.07,
nebula: [0xf59e0b, 0xfbbf24, 0xea580c], clear: 0x0b0703, moons: 0,
fact: 'Spins backwards: one Venus day lasts longer than its year.' },
{ sector: 3, name: 'Earth', type: 'earth', ocean: ['#031233', '#0a3a78', '#1f6fb8'], land: ['#2d5a25', '#5f7a35', '#9c8656', '#ddcfa4'],
sea: 0.52, iceLat: 0.8, clouds: 0.55, radius: 88, rot: 0.34, tilt: 0.41, atmo: '#5fb4ff', atmoS: 1.1, sun: '#fff6e6', ambient: 0.05,
nebula: [0x38bdf8, 0x6366f1, 0x10b981], clear: 0x020611, moons: 1,
fact: 'The only world known to host life. 71% of it is ocean.' },
{ sector: 4, name: 'Mars', type: 'mars', palette: ['#3f170a', '#7c3214', '#b9572a', '#de8b54'], craters: 50, iceLat: 0.86,
radius: 76, rot: 0.33, tilt: 0.44, atmo: '#ff9b6b', atmoS: 0.45, sun: '#fff0dc', ambient: 0.05,
nebula: [0xea580c, 0xb45309, 0x7c2d12], clear: 0x0a0402, moons: 2,
fact: 'Olympus Mons towers 22 km high, nearly 3× Mount Everest.' },
{ sector: 5, name: 'Jupiter', type: 'gas', palette: ['#5e3f2b', '#c09a74', '#efe2cc', '#a5653e', '#e5cfac'], bands: 13,
spot: { u: 0.32, v: 0.64, w: 0.075, h: 0.045, color: '#b4532c' }, radius: 125, rot: 0.55, tilt: 0.05,
atmo: '#f3d7b0', atmoS: 0.6, sun: '#fff4df', ambient: 0.05, nebula: [0xd97706, 0xf5d0a9, 0x7c3aed], clear: 0x070504, moons: 4,
ring: { inner: 1.35, outer: 1.6, palette: ['#8a7a64', '#5a4c3c'], alpha: 0.25 },
fact: 'The Great Red Spot is a storm wider than the entire Earth.' },
{ sector: 6, name: 'Saturn', type: 'gas', palette: ['#7d6238', '#cfb27c', '#ece0bd', '#ad905a'], bands: 10,
radius: 105, rot: 0.5, tilt: 0.47, atmo: '#f1dfb0', atmoS: 0.55, sun: '#fff4df', ambient: 0.05,
nebula: [0xfbbf24, 0xfde68a, 0x0ea5e9], clear: 0x070603, moons: 2,
ring: { inner: 1.25, outer: 2.35, palette: ['#e8d6ac', '#b9a27a', '#d9c597'], alpha: 0.85, gap: 0.62 },
fact: 'Its rings are 99% water ice yet only about 10 metres thick.' },
{ sector: 7, name: 'Uranus', type: 'ice', palette: ['#6fc6cc', '#97e0e3', '#c4f2f1'],
radius: 92, rot: 0.42, tilt: 1.71, atmo: '#9ff3f5', atmoS: 0.9, sun: '#f4faff', ambient: 0.06,
nebula: [0x22d3ee, 0x67e8f9, 0x6366f1], clear: 0x020a0d, moons: 2,
ring: { inner: 1.5, outer: 1.75, palette: ['#9aa8b0', '#4a5860'], alpha: 0.45 },
fact: 'Tilted 98°, Uranus rolls around the Sun on its side.' },
{ sector: 8, name: 'Neptune', type: 'ice', palette: ['#0e1f7a', '#1f42bf', '#3a68ec', '#7aa2ff'],
darkSpot: true, streaks: true, radius: 90, rot: 0.48, tilt: 0.49, atmo: '#5f8bff', atmoS: 1.0, sun: '#eef4ff', ambient: 0.06,
nebula: [0x1d4ed8, 0x3b82f6, 0x6366f1], clear: 0x01030d, moons: 1,
fact: 'Fastest winds in the Solar System: up to 2,100 km/h.' },
{ sector: 9, name: 'Kepler-452b', type: 'earth', ocean: ['#05213a', '#0d4a6a', '#2a7c8e'], land: ['#55662a', '#87783a', '#b5975a', '#dfc78e'],
sea: 0.6, iceLat: 0.86, clouds: 0.5, radius: 96, rot: 0.32, tilt: 0.3, atmo: '#8fd6ff', atmoS: 1.0, sun: '#fff5d8', ambient: 0.05,
nebula: [0x84cc16, 0x0ea5e9, 0xf59e0b], clear: 0x030805, moons: 1,
fact: "Earth's 'older cousin', 1,400 light-years away around a Sun-like star." },
{ sector: 10, name: 'TRAPPIST-1e', type: 'eyeball', ocean: ['#071a2c', '#0f3d5c', '#2b6f8a'], land: ['#4a3b2f', '#6e5a43'], ice: ['#f2dcd2', '#c8b1a8'],
radius: 74, rot: 0.3, tilt: 0.1, atmo: '#ff9a7a', atmoS: 0.8, sun: '#ff9466', ambient: 0.04,
nebula: [0xef4444, 0xf97316, 0x7f1d1d], clear: 0x090302, moons: 0,
fact: 'Orbits an ultra-cool red dwarf, so its sky glows salmon-red.' },
{ sector: 11, name: 'Proxima Centauri b', type: 'eyeball', ocean: ['#061423', '#0d3350', '#24617d'], land: ['#3d2f26', '#5e4b3a'], ice: ['#e9d6d0', '#b8a39d'],
radius: 78, rot: 0.28, tilt: 0.12, atmo: '#ff8467', atmoS: 0.7, sun: '#ff7a55', ambient: 0.04,
nebula: [0xdc2626, 0xfb923c, 0x4c1d95], clear: 0x080202, moons: 0,
fact: 'The nearest known exoplanet: just 4.24 light-years from us.' },
{ sector: 12, name: 'LHS 1140 b', type: 'snowball', palette: ['#9fb8d6', '#c9dcef', '#eef5ff'], crack: '#2a5a8c',
radius: 98, rot: 0.3, tilt: 0.2, atmo: '#bfe0ff', atmoS: 0.9, sun: '#ffb38a', ambient: 0.05,
nebula: [0x60a5fa, 0xe0f2fe, 0xf97316], clear: 0x02050a, moons: 0,
fact: 'A dense super-Earth that may hide a global ocean under ice.' },
{ sector: 13, name: 'TOI-700 d', type: 'earth', ocean: ['#02142f', '#073e74', '#1765a8'], land: ['#3c5a2a', '#6c6a35', '#9e7f52', '#cdb98a'],
sea: 0.66, iceLat: 0.78, clouds: 0.6, radius: 84, rot: 0.36, tilt: 0.2, atmo: '#7fc0ff', atmoS: 1.1, sun: '#ffbf8f', ambient: 0.05,
nebula: [0x0ea5e9, 0xf97316, 0x14b8a6], clear: 0x02060c, moons: 1,
fact: 'An Earth-sized world in its star’s habitable zone, found by TESS.' },
{ sector: 14, name: 'K2-18b · Hycean', type: 'gas', palette: ['#0a3644', '#106577', '#279fa5', '#7cd6cd'], bands: 7, soft: true,
radius: 112, rot: 0.42, tilt: 0.15, atmo: '#7fffe8', atmoS: 1.3, sun: '#ffc39a', ambient: 0.06,
nebula: [0x14b8a6, 0x2dd4bf, 0x0e7490], clear: 0x010808, moons: 0,
fact: 'A Hycean candidate: hydrogen sky above a possible planet-wide ocean.' },
{ sector: 15, name: 'Gliese 667 Cc', type: 'eyeball', ocean: ['#0b1d2a', '#16455a', '#3c7c86'], land: ['#5a4126', '#8a6a3c'], ice: ['#f5e6cf', '#cdb89a'],
radius: 86, rot: 0.3, tilt: 0.14, atmo: '#ffbf7a', atmoS: 0.85, sun: '#ffac66', ambient: 0.05,
nebula: [0xf97316, 0xfacc15, 0xb91c1c], clear: 0x080401, moons: 0,
fact: 'Lives in a triple-star system: three suns cross its sky.' },
{ sector: 16, name: 'HD 40307 g', type: 'rocky', palette: ['#3a2a1e', '#6b5034', '#9d7a4e', '#c9a777'], craters: 60,
radius: 104, rot: 0.3, tilt: 0.25, atmo: '#e9c48f', atmoS: 0.5, sun: '#ffd9a8', ambient: 0.05,
nebula: [0xb45309, 0xf59e0b, 0x65a30d], clear: 0x070502, moons: 2,
fact: 'A super-Earth about 7× our mass, 42 light-years away.' },
{ sector: 17, name: 'PSR B1257+12', type: 'lava', palette: ['#07080c', '#14161d', '#262a33'], glow: '#5ee7ff',
radius: 80, rot: 0.38, tilt: 0.3, atmo: '#7fe8ff', atmoS: 0.9, sun: '#9fdcff', ambient: 0.03, emissive: 1.2, pulsar: true,
nebula: [0x06b6d4, 0x6366f1, 0x0f172a], clear: 0x010206, moons: 0,
fact: 'Home of the first exoplanets ever found, circling a dead pulsar.' },
{ sector: 18, name: 'Vega Rim · Chaos', type: 'chaos', palette: ['#1b0b2e', '#4c1d6e', '#c2410c', '#f59e0b'],
radius: 82, rot: 0.45, tilt: 0.35, atmo: '#c4b5fd', atmoS: 0.9, sun: '#dbe7ff', ambient: 0.05, emissive: 0.7,
nebula: [0xa855f7, 0xf97316, 0x60a5fa], clear: 0x05020a, moons: 0,
ring: { inner: 1.5, outer: 3.2, palette: ['#a78bfa', '#fb923c', '#64748b'], alpha: 0.5, debris: true },
fact: 'Vega is wrapped in a vast dusty debris disk: planets still forming.' },
{ sector: 19, name: 'Cygnus X-1 Wake', type: 'blackhole', atmo: '#ffb35c', atmoS: 2.6,
radius: 60, rot: 0.2, tilt: 0.35, sun: '#bcd4ff', ambient: 0.0,
nebula: [0x3b82f6, 0xf97316, 0x1e1b4b], clear: 0x010104, moons: 0,
ring: { inner: 1.35, outer: 3.6, palette: ['#ffffff', '#ffd27a', '#ff7a2e', '#7a1d0a'], alpha: 1.0, disk: true },
fact: 'The first black hole ever confirmed: about 21 solar masses.' },
{ sector: 20, name: 'The Singularity', type: 'blackhole', atmo: '#c084fc', atmoS: 3.0,
radius: 72, rot: 0.25, tilt: 0.3, sun: '#e9d5ff', ambient: 0.0,
nebula: [0x7c3aed, 0xc026d3, 0x1e1b4b], clear: 0x030008, moons: 0,
ring: { inner: 1.3, outer: 3.9, palette: ['#ffffff', '#e9d5ff', '#a855f7', '#3b0764'], alpha: 1.0, disk: true },
fact: 'Past the event horizon not even light can escape.' }
];
class PlanetAtlas {
constructor() {
this.cache = new Map();
this.W = 512;
this.H = 256;
}
static getProfile(sector) {
const s = Math.max(1, Math.min(20, Math.floor(sector || 1)));
return PLANET_PROFILES[s - 1];
}
static createNoise(seed) {
let s = (seed * 2654435761) >>> 0 || 1;
const rnd = () => {
s ^= s << 13; s >>>= 0;
s ^= s >>> 17;
s ^= s << 5; s >>>= 0;
return s / 4294967296;
};
const p = new Uint16Array(256);
for (let i = 0; i < 256; i++) p[i] = i;
for (let i = 255; i > 0; i--) {
const j = Math.floor(rnd() * (i + 1));
const t = p[i]; p[i] = p[j]; p[j] = t;
}
const perm = new Uint16Array(512);
for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
const vals = new Float32Array(256);
for (let i = 0; i < 256; i++) vals[i] = rnd();
const lattice = (ix, iy) => vals[perm[(perm[ix & 255] + (iy & 255)) & 511]];
const noise = (x, y, period) => {
const xf = Math.floor(x);
const yf = Math.floor(y);
const tx = x - xf;
const ty = y - yf;
const sx = tx * tx * (3 - 2 * tx);
const sy = ty * ty * (3 - 2 * ty);
const x0 = ((xf % period) + period) % period;
const x1 = (x0 + 1) % period;
const a = lattice(x0, yf), b = lattice(x1, yf);
const c = lattice(x0, yf + 1), d = lattice(x1, yf + 1);
const ab = a + (b - a) * sx;
const cd = c + (d - c) * sx;
return ab + (cd - ab) * sy;
};
const fbm = (x, y, period, oct = 5) => {
let sum = 0, amp = 0.5, f = 1, norm = 0;
for (let o = 0; o < oct; o++) {
sum += amp * noise(x * f, y * f, period * f);
norm += amp;
amp *= 0.5;
f *= 2;
}
return sum / norm;
};
return { fbm, rnd };
}
static rgb(hex) {
const h = hex.replace('#', '');
return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
static samplePalette(pal, t) {
t = Math.max(0, Math.min(0.9999, t));
const f = t * (pal.length - 1);
const i = Math.floor(f);
const k = f - i;
const a = pal[i];
const b = pal[Math.min(pal.length - 1, i + 1)];
return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
static mix(a, b, k) {
return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
static smooth(e0, e1, x) {
const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
return t * t * (3 - 2 * t);
}
*/
getTextures(sector) {
const s = Math.max(1, Math.min(20, sector | 0));
if (this.cache.has(s)) return this.cache.get(s);
const profile = PlanetAtlas.getProfile(s);
const result = {
map: this.buildSurface(profile, s),
clouds: profile.clouds ? this.buildClouds(profile, s) : null,
ring: profile.ring ? this.buildRing(profile.ring, s) : null
};
this.cache.set(s, result);
return result;
}
getMoonTexture() {
if (this.cache.has('moon')) return this.cache.get('moon');
const tex = this.buildSurface({ type: 'rocky', palette: ['#3d3d40', '#6a6a6e', '#9a9a9e', '#c8c8cc'], craters: 90 }, 99);
this.cache.set('moon', tex);
return tex;
}
makeCanvas() {
const canvas = document.createElement('canvas');
canvas.width = this.W;
canvas.height = this.H;
return canvas;
}
toTexture(canvas) {
const tex = new THREE.CanvasTexture(canvas);
tex.wrapS = THREE.RepeatWrapping;
tex.wrapT = THREE.ClampToEdgeWrapping;
tex.anisotropy = 4;
tex.needsUpdate = true;
return tex;
}
buildSurface(profile, seed) {
const W = this.W, H = this.H;
const canvas = this.makeCanvas();
const ctx = canvas.getContext('2d');
if (profile.type === 'blackhole') {
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, W, H);
return this.toTexture(canvas);
}
const img = ctx.createImageData(W, H);
const d = img.data;
const { fbm, rnd } = PlanetAtlas.createNoise(seed * 97 + 13);
const P = PlanetAtlas;
const pal = (profile.palette || ['#777777', '#999999']).map(P.rgb);
for (let y = 0; y < H; y++) {
const v = y / H;
const lat = Math.abs(v - 0.5) * 2;
for (let x = 0; x < W; x++) {
const u = x / W;
let col;
switch (profile.type) {
case 'rocky': {
const n = fbm(u * 8, v * 4, 8, 5);
const n2 = fbm(u * 32 + 7, v * 16, 32, 3);
col = P.samplePalette(pal, n * 0.85 + n2 * 0.35 - 0.1);
break;
}
case 'venus': {
const warp = fbm(u * 4, v * 6, 4, 4);
const swirl = fbm(u * 6 + warp * 2, v * 9, 6, 5);
const band = 0.5 + 0.5 * Math.sin((v + warp * 0.18) * 22 + swirl * 5);
col = P.samplePalette(pal, band * 0.55 + swirl * 0.5);
break;
}
case 'earth': {
const ocean = profile.ocean.map(P.rgb);
const land = profile.land.map(P.rgb);
const h = fbm(u * 6, v * 3, 6, 6);
const sea = profile.sea || 0.52;
if (h < sea) {
col = P.samplePalette(ocean, Math.pow(h / sea, 2.2));
} else {
const e = (h - sea) / (1 - sea);
const dry = fbm(u * 10 + 4, v * 5, 10, 3);
const desertBand = 1 - Math.abs(lat - 0.32) * 4;
col = P.samplePalette(land, Math.min(1, e * 1.9 + Math.max(0, desertBand) * dry * 0.6));
}
const iceEdge = (profile.iceLat || 0.8) + (fbm(u * 12, v * 6, 12, 3) - 0.5) * 0.15;
if (lat > iceEdge) col = P.mix(col, [236, 242, 248], P.smooth(iceEdge, iceEdge + 0.06, lat));
break;
}
case 'mars': {
const n = fbm(u * 7, v * 3.5, 7, 6);
const maria = fbm(u * 4 + 9, v * 2, 4, 4);
col = P.samplePalette(pal, n * 0.9 + 0.1);
if (maria > 0.56) col = P.mix(col, pal[0], (maria - 0.56) * 2.2);
const iceEdge = (profile.iceLat || 0.86) + (fbm(u * 10, v * 5, 10, 3) - 0.5) * 0.08;
if (lat > iceEdge) col = P.mix(col, [240, 236, 230], P.smooth(iceEdge, iceEdge + 0.04, lat));
break;
}
case 'gas': {
const turb = fbm(u * 5, v * 12, 5, 5);
const fine = fbm(u * 24, v * 48, 24, 2);
const bands = profile.bands || 10;
const warp = profile.soft ? 0.6 : 1.6;
const b = v * bands + (turb - 0.5) * warp;
const t = (Math.sin(b * Math.PI) * 0.5 + 0.5) * 0.75 + fine * 0.25;
col = P.samplePalette(pal, t);
if (profile.spot) {
const sp = profile.spot;
let du = u - sp.u;
if (du > 0.5) du -= 1;
if (du < -0.5) du += 1;
const dd = (du / sp.w) ** 2 + ((v - sp.v) / sp.h) ** 2;
if (dd < 1.4) {
const k = P.smooth(1.4, 0.2, dd);
const swirlC = P.mix(P.rgb(sp.color), [240, 214, 180], 0.5 + 0.5 * Math.sin(dd * 14 + turb * 6));
col = P.mix(col, swirlC, k * 0.9);
}
}
col = P.mix(col, [0, 0, 0], Math.pow(lat, 5) * 0.35);
break;
}
case 'ice': {
const turb = fbm(u * 4, v * 10, 4, 4);
const t = 0.5 + 0.22 * Math.sin(v * 14 + turb * 3) + (turb - 0.5) * 0.3;
col = P.samplePalette(pal, t);
if (profile.darkSpot) {
let du = u - 0.62;
if (du > 0.5) du -= 1;
const dd = (du / 0.06) ** 2 + ((v - 0.62) / 0.04) ** 2;
if (dd < 1) col = P.mix(col, [8, 14, 60], (1 - dd) * 0.85);
}
if (profile.streaks) {
const s2 = fbm(u * 10 + 3, v * 40, 10, 3);
if (s2 > 0.68) col = P.mix(col, [235, 245, 255], (s2 - 0.68) * 2.6);
}
break;
}
case 'eyeball': {
const ocean = profile.ocean.map(P.rgb);
const land = profile.land.map(P.rgb);
const ice = profile.ice.map(P.rgb);
const lon = (u - 0.5) * Math.PI * 2;
const la = (0.5 - v) * Math.PI;
let dist = Math.acos(Math.max(-1, Math.min(1, Math.cos(la) * Math.cos(lon)))) / Math.PI;
const n = fbm(u * 8, v * 4, 8, 5);
dist += (n - 0.5) * 0.14;
if (dist < 0.24) col = P.samplePalette(ocean, 1 - dist / 0.24 * 0.7 + (n - 0.5) * 0.3);
else if (dist < 0.36) col = P.samplePalette(land, n);
else {
col = P.samplePalette(ice, n);
col = P.mix(col, [24, 22, 30], P.smooth(0.55, 0.95, dist) * 0.8);
}
break;
}
case 'snowball': {
const n = fbm(u * 6, v * 3, 6, 5);
col = P.samplePalette(pal, n);
const r = 1 - Math.abs(fbm(u * 10 + 5, v * 5, 10, 4) * 2 - 1);
if (r > 0.93) col = P.mix(col, P.rgb(profile.crack), (r - 0.93) * 12);
break;
}
case 'lava': {
const n = fbm(u * 7, v * 3.5, 7, 5);
col = P.samplePalette(pal, n);
const r = 1 - Math.abs(fbm(u * 9 + 2, v * 4.5, 9, 5) * 2 - 1);
const g = P.smooth(0.86, 0.98, r);
if (g > 0) col = P.mix(col, P.rgb(profile.glow), g);
break;
}
case 'chaos': {
const warp = fbm(u * 5, v * 5, 5, 4);
const n = fbm(u * 7 + warp * 3, v * 7, 7, 5);
col = P.samplePalette(pal, n * 1.15 - 0.05);
const r = 1 - Math.abs(fbm(u * 12, v * 6, 12, 3) * 2 - 1);
if (r > 0.9) col = P.mix(col, [255, 200, 120], (r - 0.9) * 8);
break;
}
default:
col = P.samplePalette(pal, fbm(u * 6, v * 3, 6, 4));
}
const i = (y * W + x) * 4;
d[i] = col[0];
d[i + 1] = col[1];
d[i + 2] = col[2];
d[i + 3] = 255;
}
}
ctx.putImageData(img, 0, 0);
const craters = profile.craters || 0;
for (let c = 0; c < craters; c++) {
const cx = rnd() * W;
const cy = H * 0.08 + rnd() * H * 0.84;
const r = 1.5 + Math.pow(rnd(), 3) * 20;
for (const off of [0, -W, W]) {
const g = ctx.createRadialGradient(cx + off, cy, 0, cx + off, cy, r);
g.addColorStop(0, 'rgba(0,0,0,0.38)');
g.addColorStop(0.75, 'rgba(0,0,0,0.18)');
g.addColorStop(0.9, 'rgba(255,255,255,0.16)');
g.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = g;
ctx.beginPath();
ctx.arc(cx + off, cy, r, 0, Math.PI * 2);
ctx.fill();
}
}
return this.toTexture(canvas);
}
buildClouds(profile, seed) {
const W = this.W, H = this.H;
const canvas = this.makeCanvas();
const ctx = canvas.getContext('2d');
const img = ctx.createImageData(W, H);
const d = img.data;
const { fbm } = PlanetAtlas.createNoise(seed * 31 + 7);
const th = 1 - (profile.clouds || 0.5);
for (let y = 0; y < H; y++) {
const v = y / H;
for (let x = 0; x < W; x++) {
const u = x / W;
const warp = fbm(u * 4, v * 4, 4, 3);
const c = fbm(u * 8 + warp * 1.5, v * 5, 8, 5);
const a = PlanetAtlas.smooth(th, th + 0.22, c);
const i = (y * W + x) * 4;
d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
d[i + 3] = Math.round(a * 235);
}
}
ctx.putImageData(img, 0, 0);
return this.toTexture(canvas);
}
*/
buildRing(ring, seed) {
const W = 512, H = 128;
const canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
const img = ctx.createImageData(W, H);
const d = img.data;
const { fbm } = PlanetAtlas.createNoise(seed * 53 + 3);
const pal = ring.palette.map(PlanetAtlas.rgb);
for (let y = 0; y < H; y++) {
const r = y / (H - 1);
const radial = fbm(3.7, r * 40, 8, 4);
for (let x = 0; x < W; x++) {
const u = x / W;
let col, a;
if (ring.disk) {
const streak = fbm(u * 16, r * 6, 16, 4);
col = PlanetAtlas.samplePalette(pal, Math.pow(r, 0.7) + (streak - 0.5) * 0.25);
a = Math.pow(1 - r, 1.4) * (0.55 + streak * 0.6) * PlanetAtlas.smooth(0, 0.05, r);
} else if (ring.debris) {
const clump = fbm(u * 24, r * 10, 24, 4);
col = PlanetAtlas.samplePalette(pal, clump);
a = PlanetAtlas.smooth(0.45, 0.75, clump) * Math.sin(r * Math.PI) * ring.alpha;
} else {
col = PlanetAtlas.samplePalette(pal, radial);
a = (0.35 + radial * 0.75) * Math.sin(Math.min(1, r) * Math.PI) ** 0.4 * ring.alpha;
if (ring.gap && Math.abs(r - ring.gap) < 0.035) a *= 0.08;
}
const i = (y * W + x) * 4;
d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
d[i + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
}
}
ctx.putImageData(img, 0, 0);
const tex = new THREE.CanvasTexture(canvas);
tex.wrapS = THREE.RepeatWrapping;
tex.needsUpdate = true;
return tex;
}
}
