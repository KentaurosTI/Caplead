const { pickOne, seededRandom } = require("./utils");

const layoutTemplates = [
  "high_ticket",
  "saas_moderno",
  "landing_conversao",
  "institucional_premium",
];

const templateConfig = {
  high_ticket: {
    pageType: "premium",
    structure: ["header", "hero", "prova", "servicos", "about", "explicacao", "cta"],
    heroVariantPool: ["image-right", "image-left"],
    ctaVariantPool: ["dual-inline", "stacked-primary"],
  },
  saas_moderno: {
    pageType: "landing page",
    structure: ["header", "hero", "servicos", "prova", "about", "explicacao", "cta"],
    heroVariantPool: ["image-right", "centered"],
    ctaVariantPool: ["dual-inline", "bottom-bar"],
  },
  landing_conversao: {
    pageType: "conversao agressiva",
    structure: ["header", "hero", "prova", "servicos", "explicacao", "cta"],
    heroVariantPool: ["centered", "image-right"],
    ctaVariantPool: ["stacked-primary", "dual-inline"],
  },
  institucional_premium: {
    pageType: "institucional",
    structure: ["header", "hero", "about", "servicos", "prova", "explicacao", "cta"],
    heroVariantPool: ["image-right", "centered"],
    ctaVariantPool: ["dual-inline", "bottom-bar"],
  },
};

function normalizeNicheInput(leadDesignData, leadContext) {
  return `${leadDesignData?.niche || ""} ${leadContext?.nicho || ""} ${leadContext?.nome || ""}`.toLowerCase();
}

function selectTemplateByRules(leadDesignData, leadContext, siteQuality) {
  const sample = normalizeNicheInput(leadDesignData, leadContext);

  // Nichos institucionais / alta credibilidade → premium
  if (/advoc|jurid|direito|contab|audit|financ|segur|consult/.test(sample)) return "institucional_premium";

  // SaaS / tecnologia → moderno
  if (/saas|software|plataforma|sistema|tecnolog|startup|app\b|applic/.test(sample)) return "saas_moderno";

  // Educação / cursos → landing orientada a conversão
  if (/educa|curso|treinamento|escola|universid|ensino|capacit/.test(sample)) return "landing_conversao";

  // Serviços locais de alto ticket → high_ticket
  if (/imob|imovei|incorpora|arquitet|engenharia/.test(sample)) return "high_ticket";

  // Serviços locais de conversão rápida → landing
  if (/clinica|odont|dentist|medic|saude|psicolog|nutricion|estetica|beleza|barbear|academia|fitness|restaurante|pet|loja|varejo/.test(sample)) {
    return "landing_conversao";
  }

  if (siteQuality.level === "ruim") return "landing_conversao";
  if (siteQuality.level === "medio") return "institucional_premium";
  return "high_ticket";
}

function defineRedesignStrategy({
  leadDesignData,
  leadContext,
  analysis,
  siteQuality,
  seedBase,
  attempt = 0,
}) {
  const seed = `${seedBase}:${attempt}:${leadDesignData.companyName}:${analysis.designScore}`;
  const rand = seededRandom(seed);
  const templateName = selectTemplateByRules(leadDesignData, leadContext, siteQuality);
  const template = templateConfig[templateName] || templateConfig.institucional_premium;

  const modeByQuality = {
    ruim: "ignore_current_design",
    medio: "keep_colors_upgrade_structure",
    bom: "evolutionary_upgrade",
  };

  return {
    templateName,
    pageType: template.pageType,
    structure: template.structure,
    visualStyle: templateName,
    layoutVariant: pickOne(["grid-professional", "split-professional"], rand, "grid-professional"),
    heroVariant: pickOne(template.heroVariantPool, rand, "image-right"),
    ctaVariant: pickOne(template.ctaVariantPool, rand, "dual-inline"),
    spacingVariant: "airy-xl",
    includeProofSection: true,
    sourceMode: modeByQuality[siteQuality.level] || "keep_colors_upgrade_structure",
    rationale: {
      niche: leadDesignData.niche,
      siteQualityLevel: siteQuality.level,
      siteQualityScore: siteQuality.score,
      selectionRule: "template-first-personalization-second",
    },
  };
}

module.exports = {
  layoutTemplates,
  defineRedesignStrategy,
};
