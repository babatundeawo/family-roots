// Small colour toolkit used by the build. No dependencies.
// Colours are worked out in OKLCH (perceptually even lightness) and written
// out as sRGB hex, which every browser understands.

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, "0")).join("");
}

export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear({ L, C, h }) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// Convert OKLCH to hex, lowering chroma until the colour fits inside sRGB.
export function oklchToHex({ L, C, h }) {
  let c = C;
  for (let i = 0; i < 40; i++) {
    const lin = oklchToLinear({ L, C: c, h });
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return rgbToHex(lin.map((v) => toGamma(clamp01(v)) * 255));
    }
    c *= 0.93;
  }
  return rgbToHex(oklchToLinear({ L, C: 0, h }).map((v) => toGamma(clamp01(v)) * 255));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Same result as CSS color-mix(in srgb, a pct%, b).
export function mix(a, b, pct) {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex(ra.map((v, i) => v * (pct / 100) + rb[i] * (1 - pct / 100)));
}

// Raise or lower lightness of `hex` until it reaches `ratio` against every colour in `against`.
export function ensureContrast(hex, against, ratio, direction) {
  const o = hexToOklch(hex);
  let out = hex;
  for (let i = 0; i < 80 && !against.every((bg) => contrast(out, bg) >= ratio); i++) {
    o.L = clamp01(o.L + (direction === "lighter" ? 0.008 : -0.008));
    out = oklchToHex(o);
  }
  return out;
}

// Pick whichever of white or near-black reads better on `bg`.
export function readableOn(bg, light = "#ffffff", dark = "#0b0e17") {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark;
}
