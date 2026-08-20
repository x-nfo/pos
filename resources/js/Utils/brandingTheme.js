/**
 * White Label Branding Theme Utility
 * Dynamically converts Hex colors to RGB triples and applies them to CSS variables
 */

export function hexToRgb(hex) {
    if (!hex) return { r: 79, g: 70, b: 229 };
    hex = String(hex).replace(/^#/, '').trim();
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return { r: 79, g: 70, b: 229 };
    }
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
    };
}

function mixRgb(c1, c2, weight2) {
    const weight1 = 1.0 - weight2;
    const r = Math.round(c1.r * weight1 + c2.r * weight2);
    const g = Math.round(c1.g * weight1 + c2.g * weight2);
    const b = Math.round(c1.b * weight1 + c2.b * weight2);
    return `${r} ${g} ${b}`;
}

export function generateRgbShades(hex) {
    const base = hexToRgb(hex);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    return {
        '50': mixRgb(base, white, 0.92),
        '100': mixRgb(base, white, 0.82),
        '200': mixRgb(base, white, 0.65),
        '300': mixRgb(base, white, 0.45),
        '400': mixRgb(base, white, 0.22),
        '500': mixRgb(base, white, 0.08),
        '600': `${base.r} ${base.g} ${base.b}`,
        '700': mixRgb(base, black, 0.15),
        '800': mixRgb(base, black, 0.30),
        '900': mixRgb(base, black, 0.48),
        '950': mixRgb(base, black, 0.65),
    };
}

export function applyThemeColors(primaryHex = '#4f46e5', accentHex = '#06b6d4') {
    if (typeof document === 'undefined') return;

    const primaryShades = generateRgbShades(primaryHex || '#4f46e5');
    const accentShades = generateRgbShades(accentHex || '#06b6d4');

    const root = document.documentElement;

    Object.entries(primaryShades).forEach(([shade, rgb]) => {
        root.style.setProperty(`--color-primary-${shade}`, rgb);
    });

    Object.entries(accentShades).forEach(([shade, rgb]) => {
        root.style.setProperty(`--color-accent-${shade}`, rgb);
    });
}
