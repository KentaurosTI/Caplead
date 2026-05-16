const roundTo = (value, step = 500) => Math.round(value / step) * step;

const parseExistingValue = (lead = {}) => {
  const raw = lead.value ?? lead.estimatedValue ?? lead.valor_estimado ?? lead.budget;
  if (raw === null || raw === undefined || raw === '') return 0;
  const normalized = String(raw).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const includesAny = (text, terms) => terms.some(term => text.includes(term));

function estimateAiProjectValue(lead = {}) {
  const existingValue = parseExistingValue(lead);
  if (existingValue > 0) return roundTo(existingValue);

  const text = [
    lead.nome,
    lead.titulo,
    lead.empresa,
    lead.categoria,
    lead.nicho,
    lead.descricao,
    lead.url,
    lead.site_oficial,
    lead.tipo_origem,
  ].filter(Boolean).join(' ').toLowerCase();

  const isSystem = lead.tipo_origem === 'play_store' || includesAny(text, ['sistema', 'software', 'saas', 'app ', 'aplicativo']);
  const hasWebsite = Boolean(lead.site_oficial || lead.website || lead.url);
  let value = isSystem ? 12000 : hasWebsite ? 5500 : 8500;

  if (includesAny(text, ['e-commerce', 'loja virtual', 'imobili', 'marketplace'])) value *= 1.25;
  if (includesAny(text, ['clínica', 'clinica', 'médic', 'medic', 'odont', 'psicolog', 'veterin'])) value *= 1.12;
  if (includesAny(text, ['advoc', 'contab', 'consultoria', 'financeir'])) value *= 1.08;
  if (isSystem) value *= 1.2;

  const score = Number(lead.score_design || lead.score_ux || 0);
  if (score > 0 && score <= 45) value += 2500;
  else if (score > 45 && score <= 70) value += 1500;

  if (lead.email || lead.has_email_count > 0) value += 750;
  if (lead.telefone || lead.phone) value += 750;
  if (lead.layout_status === 'success' || lead.layout_status === 'gerado') value += 1500;

  const min = isSystem ? 9000 : 3500;
  const max = isSystem ? 35000 : 18000;
  return Math.max(min, Math.min(max, roundTo(value)));
}

function applyAiProjectValue(lead = {}) {
  const estimatedValue = estimateAiProjectValue(lead);
  return {
    ...lead,
    value: estimatedValue,
    estimatedValue,
    valor_estimado: estimatedValue,
    pricingModel: 'ai_development',
    pricingBasis: 'Projeto estimado para entrega assistida por IA',
  };
}

module.exports = {
  applyAiProjectValue,
  estimateAiProjectValue,
  parseExistingValue,
};
