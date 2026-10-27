/*!
 * Copyright (c) 2026 Lumin Flow Studios. All Rights Reserved.
 * LUMIN FLOW: UTOPIA RUN (SPACELUMIN) — PROPRIETARY & CONFIDENTIAL
 * Protected Intellectual Property: PredictiveAI, NystromKernel, NeuroFlow, KernelMapper, Director.
 * Unauthorized copying, reverse-engineering, scraping, or redistribution is strictly prohibited.
 */
/**
 * SymbolBadges.js - Camera-facing symbol badges for food (collectibles) and enemy species.
 * Textures are rendered once per (glyph, color, style) and shared between all sprites.
 */

const SymbolBadges = (() => {
    const cache = new Map();
    const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

    function hexToCss(color) {
        if (typeof color === 'string') return color;
        return '#' + color.toString(16).padStart(6, '0');
    }

    /**
     * @param {string} glyph   Emoji / symbol drawn in the badge
     * @param {string|number} color Ring color
     * @param {'food'|'hostile'|'hazard'} style
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

        // Soft outer glow
        const glow = ctx.createRadialGradient(c, c, size * 0.28, c, c, size * 0.5);
        glow.addColorStop(0, css + 'aa');
        glow.addColorStop(1, css + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(c, c, size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Dark glass disc
        ctx.fillStyle = style === 'hostile' ? 'rgba(24, 4, 10, 0.82)' : 'rgba(3, 7, 18, 0.78)';
        ctx.beginPath();
        ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
        ctx.fill();

        // Ring(s)
        ctx.lineWidth = 6;
        ctx.strokeStyle = css;
        ctx.beginPath();
        ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
        ctx.stroke();

        if (style === 'hostile' || style === 'hazard') {
            // Red threat ring with 4 notches → instantly reads as "enemy / danger"
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ef4444';
            for (let i = 0; i < 4; i++) {
                const a0 = i * Math.PI / 2 + 0.22;
                ctx.beginPath();
                ctx.arc(c, c, size * 0.44, a0, a0 + Math.PI / 2 - 0.44);
                ctx.stroke();
            }
        }

        // Glyph
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
