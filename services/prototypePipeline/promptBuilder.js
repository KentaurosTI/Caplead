function buildDynamicPrompt({ leadDesignData, analysis, visualDNA, strategy, leadContext }) {
  const problems = (analysis.problems || []).slice(0, 6).join(" | ");
  const sections = (leadDesignData.sections || [])
    .map((section) => section.type)
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  return [
    `Empresa: ${leadDesignData.companyName}`,
    `Nicho: ${leadDesignData.niche}`,
    `Contexto comercial: ${(leadContext && leadContext.nicho) || "nao informado"}`,
    `Score atual de design: ${analysis.designScore}/100`,
    `Problemas detectados: ${problems || "necessidade de modernizacao e conversao"}`,
    `DNA visual: primary=${visualDNA.primaryColor}, secondary=${visualDNA.secondaryColor}, accent=${visualDNA.accentColor}, typography=${visualDNA.typographyStyle}, tone=${visualDNA.brandTone}`,
    `Template fixo selecionado: ${strategy.templateName}`,
    `Estrategia de redesign: tipo=${strategy.pageType}, template=${strategy.templateName}, modo=${strategy.sourceMode}, layout=${strategy.layoutVariant}, hero=${strategy.heroVariant}, cta=${strategy.ctaVariant}, espacamento=${strategy.spacingVariant}`,
    `Estrutura base: ${sections || "header, hero, sobre, servicos, contato"}`,
    "Instrucao: usar template profissional pre-definido, aplicar personalizacao do lead e elevar qualidade visual para nivel comercial.",
    "Regra: sem layout livre; seguir template com hero forte, CTA visivel, contraste alto, hierarquia clara e secoes separadas.",
  ].join("\n");
}

module.exports = {
  buildDynamicPrompt,
};
