const { resolveNicheConfig } = require('./nicheTemplates');

function buildDynamicPrompt({ leadDesignData, analysis, visualDNA, strategy, leadContext }) {
  const problems = (analysis.problems || []).slice(0, 6).join(' | ');
  const sections = (leadDesignData.sections || [])
    .map((s) => s.type)
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');

  const niche = resolveNicheConfig(
    leadDesignData?.niche || '',
    { nicho: leadContext?.nicho, nome: leadDesignData?.companyName }
  );

  const conversionHints = [
    `CTA primário de nicho: "${niche.heroCopy.ctaPrimary}"`,
    `Eyebrow de impacto: "${niche.heroCopy.eyebrow}"`,
    `Estatísticas de prova social: ${niche.proofStats.map(s => `${s.value || s.suffix}${s.label ? ' ' + s.label : ''}`).join(' / ')}`,
    `Prova do processo: ${niche.processoSteps.map(s => s.title).join(' → ')}`,
    `Trust badges: ${niche.trustBadges.join(', ')}`,
    `CTA final: "${niche.ctaFinal}"`,
  ].join('\n');

  const componentLibraries = [
    'ShadCN UI: cards, badges, botões, topbar sticky',
    'MagicUI: shimmer button, gradient text, stat numbers animados',
    'ReactBits: bento grid cards, eyebrow + eyebrow-dot pattern',
    '21st.dev: trust bar horizontal, step process numerado',
    'getdesigner.md: tokens CSS (--primary/--secondary/--accent), spacing system',
  ].join('\n');

  return [
    `Empresa: ${leadDesignData.companyName}`,
    `Nicho detectado: ${niche.label} (raw: ${leadDesignData.niche})`,
    `Contexto comercial: ${(leadContext && leadContext.nicho) || 'nao informado'}`,
    `Score atual de design: ${analysis.designScore}/100`,
    `Problemas detectados: ${problems || 'necessidade de modernizacao e conversao'}`,
    `DNA visual: primary=${visualDNA.primaryColor}, secondary=${visualDNA.secondaryColor}, accent=${visualDNA.accentColor}, typography=${visualDNA.typographyStyle}, tone=${visualDNA.brandTone}`,
    `Template fixo selecionado: ${strategy.templateName}`,
    `Estrategia: tipo=${strategy.pageType}, template=${strategy.templateName}, modo=${strategy.sourceMode}, layout=${strategy.layoutVariant}, hero=${strategy.heroVariant}, cta=${strategy.ctaVariant}`,
    `Estrutura base: ${sections || 'header, hero, sobre, servicos, contato'}`,
    '',
    '=== Hints de conversão por nicho ===',
    conversionHints,
    '',
    '=== Bibliotecas de componentes aplicadas ===',
    componentLibraries,
    '',
    'Instrucao: aplicar componentes de alto impacto visual (shimmer button, gradient text, bento grid, trust bar, step process) com copy de nicho especifico. Hierarquia clara, CTAs visiveis, prova social com numeros reais.',
    'Regra: sem placeholders genericos; usar copy do nicho detectado; manter validator.js — shell-gap>=32, surface-padding>=30, 4+ grids, 3+ buttons, H1+H2, data-shot cover+explanation.',
  ].join('\n');
}

module.exports = { buildDynamicPrompt };
