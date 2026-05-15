const crypto = require("crypto");

function normalizeUrl(url) {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashToInt(seed) {
  const hash = crypto.createHash("sha256").update(String(seed || "")).digest("hex").slice(0, 8);
  return parseInt(hash, 16) >>> 0;
}

function seededRandom(seed) {
  let t = hashToInt(seed);
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(list, rand, fallback = null) {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  const idx = Math.floor((rand ? rand() : Math.random()) * list.length);
  return list[idx];
}

function normalizeFontName(fontFamily) {
  const raw = String(fontFamily || "").split(",")[0].trim();
  return raw.replace(/^["']|["']$/g, "");
}

function rgbToHex(raw) {
  if (!raw) return null;
  const text = String(raw).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  const match = text.match(/rgba?\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return null;
  const r = clamp(parseInt(match[1], 10) || 0, 0, 255);
  const g = clamp(parseInt(match[2], 10) || 0, 0, 255);
  const b = clamp(parseInt(match[3], 10) || 0, 0, 255);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

module.exports = {
  clamp,
  escapeHtml,
  normalizeFontName,
  normalizeUrl,
  pickOne,
  rgbToHex,
  seededRandom,
  unique,
};
