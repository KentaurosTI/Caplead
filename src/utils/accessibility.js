// A11y helpers: contrast checking and error message augmentation (dev only)

function hexToRgb(hex) {
  let h = hex.trim().toLowerCase();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}

function srgb(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(v => srgb(v));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const L1 = relativeLuminance(c1);
  const L2 = relativeLuminance(c2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgbString(rgb) {
  const m = rgb.match(/rgb(a)?\(([^)]+)\)/i);
  if (!m) return '#000000';
  const parts = m[2].split(',').map(p => parseInt(p.trim(), 10));
  const [r, g, b] = parts;
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

function getCssColorValue(el, property) {
  if (!el) return null;
  const style = getComputedStyle(el);
  const val = style.getPropertyValue(property).trim();
  if (!val) return null;
  if (val.startsWith('rgb')) {
    return parseRgbString(val);
  }
  if (val.startsWith('#')) {
    return val;
  }
  const tmp = document.createElement('span');
  tmp.style.color = val;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  if (computed.startsWith('rgb')) {
    return parseRgbString(computed);
  }
  return null;
}

function logContrastWarning(textColor, bgColor, ratio) {
  console.warn('[A11y] Baixo contraste detectado: ratio=' + ratio.toFixed(2) + ':1');
  console.warn('Texto: ' + textColor + ', Fundo: ' + bgColor + '. Recomendado: texto 4.5:1 ou superior para conteúdo.');
}

export function checkBodyContrast() {
  try {
    const body = document.body;
    const textColor = getCssColorValue(body, 'color') || '#ffffff';
    const bgColor = getCssColorValue(body, 'background-color') || '#000000';
    if (!textColor || !bgColor) return;
    const ratio = contrastRatio(textColor, bgColor);
    if (ratio < 4.5) {
      logContrastWarning(textColor, bgColor, ratio);
    }
  } catch (e) {
    console.warn('[A11y] checkBodyContrast erro', e);
  }
}

export function enhanceErrorMessages() {
  try {
    const errored = document.querySelectorAll('[data-error]');
    errored.forEach(function(el) {
      const errorMsg = el.getAttribute('data-error') || '';
      const inputId = (el.getAttribute('data-for') || el.getAttribute('for'));
      if (!inputId) return;
      const input = document.getElementById(inputId);
      if (!input) return;
      input.setAttribute('aria-invalid', 'true');
      let hint = document.getElementById(inputId + '-error');
      if (!hint) {
        hint = document.createElement('span');
        hint.id = inputId + '-error';
        hint.className = 'sr-only';
        if (input.parentElement) input.parentElement.appendChild(hint);
      }
      hint.textContent = errorMsg;
      const currentDescribed = input.getAttribute('aria-describedby') || '';
      const ids = new Set(currentDescribed.split(' ').filter(Boolean));
      ids.add(hint.id);
      input.setAttribute('aria-describedby', Array.from(ids).join(' '));
    });
  } catch (e) {
    console.warn('[A11y] enhanceErrorMessages erro', e);
  }
}

export default {};
