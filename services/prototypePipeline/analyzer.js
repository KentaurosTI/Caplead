const { clamp } = require("./utils");

function hasSectionType(sections, type) {
  return (sections || []).some((section) => section.type === type);
}

function inferStyle(metrics) {
  if (metrics.colorCount >= 7 || metrics.fontCount >= 4) return "poluido";
  if (metrics.sectionCount <= 2 || metrics.ctaCount === 0) return "antigo";
  if (metrics.colorCount <= 2 && metrics.fontCount <= 2 && metrics.sectionCount >= 4) return "minimalista";
  if (metrics.sectionCount >= 5 && metrics.ctaCount >= 2) return "moderno";
  return "corporativo";
}

function classifySiteQuality(site) {
  const sections = site.sections || [];
  const metrics = {
    sectionCount: sections.length,
    colorCount: (site.colors || []).length,
    fontCount: (site.fonts || []).length,
    ctaCount: (site.ctas || []).length,
    hasLogo: Boolean(site.logo),
    hasContactInfo: Boolean(site.contactInfo?.email || site.contactInfo?.phone || site.contactInfo?.whatsapp),
    hasServices: hasSectionType(sections, "servicos"),
    hasAbout: hasSectionType(sections, "sobre"),
    hasContactSection: hasSectionType(sections, "contato"),
    textDensity: (site.texts || []).length,
    imageCount: (site.images || []).length,
  };

  let score = 78;

  if (!metrics.hasLogo) score -= 12;
  if (metrics.colorCount < 2) score -= 11;
  if (metrics.colorCount > 8) score -= 6;
  if (metrics.fontCount === 0) score -= 9;
  if (metrics.fontCount > 4) score -= 6;
  if (metrics.ctaCount < 2) score -= 13;
  if (!metrics.hasServices) score -= 9;
  if (!metrics.hasAbout) score -= 7;
  if (!metrics.hasContactSection || !metrics.hasContactInfo) score -= 11;
  if (metrics.sectionCount < 4) score -= 12;
  if (metrics.imageCount < 2) score -= 4;
  if (metrics.textDensity < 8) score -= 4;

  score = clamp(score, 15, 96);
  let level = "medio";
  if (score < 50) level = "ruim";
  if (score >= 72) level = "bom";

  return { score, level, metrics };
}

function analyzeLeadSite(leadDesignData) {
  const quality = classifySiteQuality(leadDesignData);
  const style = inferStyle(quality.metrics);
  const problems = [];
  const strengths = [];

  if (quality.level === "ruim") {
    problems.push("Design atual fraco para conversao e percepcao de valor.");
  }
  if (quality.metrics.ctaCount < 2) {
    problems.push("Falta de CTA forte e recorrente.");
  } else {
    strengths.push("Existem CTAs aproveitaveis.");
  }
  if (quality.metrics.sectionCount < 4) {
    problems.push("Hierarquia de pagina insuficiente.");
  } else {
    strengths.push("Estrutura base com secoes aproveitaveis.");
  }
  if (!quality.metrics.hasContactInfo) {
    problems.push("Contato pouco visivel.");
  } else {
    strengths.push("Canal de contato identificado.");
  }
  if (quality.metrics.colorCount < 2) {
    problems.push("Paleta fraca, exige correcao visual.");
  }

  return {
    style,
    designScore: quality.score,
    qualityBand: quality.level,
    quality,
    problems,
    strengths,
    metrics: quality.metrics,
  };
}

module.exports = {
  classifySiteQuality,
  analyzeLeadSite,
};
