/*! © 2026 Lumin Flow Studios. All Rights Reserved. Proprietary & Confidential (SymbolBadges.js) | Seal: LFS-2026-9F8A4D2C-7E1B63A0-SPACELUMIN-V43-SEAL */
*/
*/
const SymbolBadges = (() => {
const cache = new Map();
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
function hexToCss(color) {
if (typeof color === 'string') return color;
return '#' + color.toString(16).padStart(6, '0');
}
*/
function getTexture(glyph, color, style = 'food') {
const css = hexToCss(color);
const key = `${glyph}|${css}|${style}`;
if (cache.has(key)) return cache.get(key);
const size = 128;
const canvas = document.createElement('canvas');
canvas.width = size;
canvas.height = size;
const ctx = canvas.getContext('2d');
const c = size / 2;
const glow = ctx.createRadialGradient(c, c, size * 0.28, c, c, size * 0.5);
glow.addColorStop(0, css + 'aa');
glow.addColorStop(1, css + '00');
ctx.fillStyle = glow;
ctx.beginPath();
ctx.arc(c, c, size * 0.5, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = style === 'hostile' ? 'rgba(24, 4, 10, 0.82)' : 'rgba(3, 7, 18, 0.78)';
ctx.beginPath();
ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
ctx.fill();
ctx.lineWidth = 6;
ctx.strokeStyle = css;
ctx.beginPath();
ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
ctx.stroke();
if (style === 'hostile' || style === 'hazard') {
ctx.lineWidth = 4;
ctx.strokeStyle = '#ef4444';
for (let i = 0; i < 4; i++) {
const a0 = i * Math.PI / 2 + 0.22;
ctx.beginPath();
ctx.arc(c, c, size * 0.44, a0, a0 + Math.PI / 2 - 0.44);
ctx.stroke();
}
}
ctx.font = `${Math.round(size * 0.42)}px ${EMOJI_FONT}`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = '#ffffff';
ctx.fillText(glyph, c, c + size * 0.03);
const texture = new THREE.CanvasTexture(canvas);
texture.needsUpdate = true;
cache.set(key, texture);
return texture;
}
function createSprite(glyph, color, scale = 20, style = 'food') {
const material = new THREE.SpriteMaterial({
map: getTexture(glyph, color, style),
transparent: true,
depthTest: false,
depthWrite: false
});
const sprite = new THREE.Sprite(material);
sprite.scale.set(scale, scale, 1);
sprite.renderOrder = 50;
return sprite;
}
return { getTexture, createSprite };
})();
