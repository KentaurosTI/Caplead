const { layoutTemplateLibrary } = require("./generator");

function countMatches(text, pattern) {
  const matches = String(text || "").match(pattern);
  return matches ? matches.length : 0;
}

function hexToRgb(hex) {
  const raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return { r: 15, g: 23, b: 42 };
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const linear = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(hexA, hexB) {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateDesign({ html, visualDNA }) {
  const hierarchy = /<h1[\s>]/i.test(html) && countMatches(html, /<h2[\s>]/gi) >= 2;
  const spacing =
    /--shell-gap:\s*(3[2-9]|[4-9][0-9])px/i.test(html) &&
    /--surface-padding:\s*(3[0-9]|[4-9][0-9])px/i.test(html);
  const contrast =
    contrastRatio(visualDNA.primaryColor, "#ffffff") >= 3.3 ||
    contrastRatio(visualDNA.primaryColor, "#0f172a") >= 3.3;

  const scoreParts = [
    hierarchy ? 28 : 0,
    spacing ? 24 : 0,
    contrast ? 24 : 0,
    countMatches(html, /display:\s*grid/gi) >= 4 ? 12 : 0,
    countMatches(html, /<button/gi) >= 3 ? 12 : 0,
  ];
  const professionalism = scoreParts.reduce((acc, item) => acc + item, 0);

  return {
    hierarchy,
    spacing,
    contrast,
    professionalism,
  };
}

function validatePrototypeQuality({ html, leadDesignData, visualDNA, strategy, siteQuality }) {
  const templateStructure = layoutTemplateLibrary[strategy?.templateName] || [];
  const sectionAlias = {
    header: "header",
    hero: "hero",
    servicos: "services",
    about: "about",
    prova: "proof",
    explicacao: "explanation",
    cta: "cta",
  };

  const designValidation = validateDesign({ html, visualDNA });
  const heroCtaVisible = /data-shot=["']hero["'][\s\S]*?<button/i.test(html);
  const hasLeadSnippet = (leadDesignData.texts || []).some(
    (txt) => txt && txt.length > 18 && html.includes(txt.slice(0, Math.min(30, txt.length)))
  );
  const hasCover = /data-shot=["']cover["']/i.test(html);
  const hasExplanation = /data-shot=["']explanation["']/i.test(html);
  const originalScore = siteQuality?.score || 0;
  const betterThanOriginal = designValidation.professionalism > originalScore;

  const checks = {
    usesTemplateLibrary: Boolean(strategy?.templateName && templateStructure.length > 0),
    templateStructureRespected: templateStructure.every((block) =>
      new RegExp(`data-shot=["']${sectionAlias[block] || block}["']`, "i").test(html)
    ),
    usesLeadColors:
      html.includes(visualDNA.primaryColor) &&
      html.includes(visualDNA.secondaryColor) &&
      html.includes(visualDNA.accentColor),
    paletteRule3Colors: [visualDNA.primaryColor, visualDNA.secondaryColor, visualDNA.accentColor].filter(Boolean).length === 3,
    hierarchy: designValidation.hierarchy,
    spacing: designValidation.spacing,
    contrast: designValidation.contrast,
    hasCtaButtons: countMatches(html, /<button/gi) >= 3 && heroCtaVisible,
    hasProfessionalGrid: countMatches(html, /display:\s*grid/gi) >= 4,
    sectionsSeparated: countMatches(html, /class=["'][^"']*\bsurface\b/gi) >= 5,
    hasPdfReadySections: hasCover && hasExplanation,
    notGenericCopy:
      !/lorem ipsum|your company|empresa xyz|template demo/i.test(html) &&
      (hasLeadSnippet || (leadDesignData.companyName || "").length >= 3),
    betterThanOriginal,
  };

  const professionalism = designValidation.professionalism;
  const notes = [];
  if (!checks.usesTemplateLibrary) notes.push("Template profissional obrigatorio nao aplicado.");
  if (!checks.templateStructureRespected) notes.push("Estrutura fixa do template nao foi respeitada.");
  if (!checks.usesLeadColors) notes.push("Paleta principal/secundaria/acento nao foi aplicada.");
  if (!checks.paletteRule3Colors) notes.push("Regra de cores (2 principais + 1 destaque) nao atendida.");
  if (!checks.hierarchy) notes.push("Hierarquia visual fraca.");
  if (!checks.spacing) notes.push("Espacamento abaixo do padrao profissional.");
  if (!checks.contrast) notes.push("Contraste insuficiente.");
  if (!checks.hasCtaButtons) notes.push("CTA nao esta sempre visivel.");
  if (!checks.notGenericCopy) notes.push("Copy generica detectada.");
  if (!checks.hasPdfReadySections) notes.push("PDF sem capa/explicacao.");
  if (!checks.betterThanOriginal) notes.push("Layout nao superou o score do site original.");

  const passed =
    checks.hierarchy &&
    checks.spacing &&
    checks.contrast &&
    checks.usesTemplateLibrary &&
    checks.templateStructureRespected &&
    checks.hasCtaButtons &&
    checks.notGenericCopy &&
    checks.betterThanOriginal &&
    professionalism >= 80;

  return {
    passed,
    score: professionalism,
    checks,
    notes,
    validateDesign: designValidation,
  };
}

module.exports = {
  validateDesign,
  validatePrototypeQuality,
};
