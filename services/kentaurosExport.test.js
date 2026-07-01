const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCapLeadQualityProfile,
  buildCapLeadExportQualitySummary,
  dedupeLeadsForKentauros,
  normalizeLeadForKentauros,
} = require('./kentaurosExport');

test('exports AI-assisted project value fields to Kentauros', () => {
  const lead = normalizeLeadForKentauros({
    titulo: 'Clínica Recanto PSI',
    categoria: 'Saúde / Clínica',
    url: 'https://recantopsi.com.br',
    email: 'contato@recantopsi.com.br',
    telefone: '(21) 99888-7777',
    score_design: 48,
  });

  assert.equal(lead.pricingModel, 'ai_development');
  assert.equal(lead.value, 9000);
  assert.equal(lead.estimatedValue, 9000);
  assert.equal(lead.valor_estimado, 9000);
});

test('exports WhatsApp sent status to Kentauros payload', () => {
  const lead = normalizeLeadForKentauros({
    titulo: 'Clínica Recanto PSI',
    url: 'https://recantopsi.com.br',
    telefone: '(21) 99888-7777',
    wpp_enviado: 1,
    wpp_enviado_at: '2026-05-17T12:00:00.000Z',
  });

  assert.equal(lead.wpp_enviado, 1);
  assert.equal(lead.whatsappMessageStatus, 'sent');
  assert.equal(lead.whatsappSentAt, '2026-05-17T12:00:00.000Z');
});

test('exports CapLead quality profile and stable dedupe key', () => {
  const lead = normalizeLeadForKentauros({
    id: 42,
    titulo: 'Centro da Pele',
    url: 'https://www.centrodapele.com.br/contato',
    email: 'Contato@CentroDaPele.com.br ',
    telefone: '+55 (11) 93018-6652',
    score_design: 38,
    problemas: 'Sem CTA claro',
  });

  assert.equal(lead.email, 'contato@centrodapele.com.br');
  assert.equal(lead.capLeadDedupeKey, 'centrodapele.com.br');
  assert.equal(lead.dataQualityStatus, 'qualified');
  assert.ok(lead.dataQualityScore >= 80);
  assert.ok(lead.qualityFlags.includes('site_pain_detected'));
});

test('deduplicates Kentauros export payload by domain before sending', () => {
  const leads = dedupeLeadsForKentauros([
    normalizeLeadForKentauros({ titulo: 'Centro da Pele', url: 'https://centrodapele.com.br', email: 'a@centro.com.br', score_design: 30 }),
    normalizeLeadForKentauros({ titulo: 'Centro da Pele Duplicado', url: 'https://www.centrodapele.com.br/contato', email: 'b@centro.com.br', score_design: 80 }),
  ]);

  assert.equal(leads.length, 1);
  assert.equal(leads[0].titulo, 'Centro da Pele Duplicado');
});

test('classifies incomplete CapLead profile as review required', () => {
  const profile = buildCapLeadQualityProfile({ titulo: 'Lead sem contato', url: 'leadsemcontato.com.br' });

  assert.equal(profile.status, 'review_required');
  assert.ok(profile.flags.includes('missing_email'));
  assert.ok(profile.flags.includes('missing_phone_or_whatsapp'));
});

test('exports required field review and enrichment suggestions to Kentauros', () => {
  const lead = normalizeLeadForKentauros({
    id: 77,
    titulo: 'Lead incompleto',
    url: 'https://leadincompleto.com.br',
  });

  assert.equal(lead.dataQualityVersion, 2);
  assert.equal(lead.requiredFieldsStatus, 'incomplete');
  assert.deepEqual(lead.missingRequiredFields, ['email', 'phone_or_whatsapp', 'ai_score']);
  assert.ok(lead.enrichmentSuggestions.includes('capture_email'));
  assert.ok(lead.enrichmentSuggestions.includes('capture_whatsapp'));
  assert.ok(lead.enrichmentSuggestions.includes('run_ai_quality_analysis'));
  assert.equal(lead.qualityRecommendation, 'review_before_export');
  assert.equal(lead.externalAutomationApprovalRequired, true);
});

test('marks complete CapLead quality profile as ready for Kentauros export', () => {
  const profile = buildCapLeadQualityProfile({
    titulo: 'Centro da Pele',
    url: 'https://centrodapele.com.br',
    email: 'contato@centrodapele.com.br',
    telefone: '(11) 93018-6652',
    score_design: 84,
  });

  assert.equal(profile.version, 2);
  assert.equal(profile.requiredFieldsStatus, 'complete');
  assert.deepEqual(profile.missingRequiredFields, []);
  assert.equal(profile.recommendedAction, 'export_to_kentauros');
  assert.equal(profile.externalAutomationApprovalRequired, true);
});

test('builds CapLead export quality summary with gate and duplicate count', () => {
  const rawLeads = [
    { titulo: 'Centro da Pele', url: 'https://centrodapele.com.br', email: 'contato@centrodapele.com.br', telefone: '(11) 93018-6652', score_design: 84 },
    { titulo: 'Centro da Pele Duplicado', url: 'https://www.centrodapele.com.br/contato', email: 'outro@centrodapele.com.br', telefone: '(11) 93018-6652', score_design: 40 },
    { titulo: 'Lead incompleto', url: 'https://leadincompleto.com.br' },
  ];
  const normalized = dedupeLeadsForKentauros(rawLeads.map(normalizeLeadForKentauros));

  const summary = buildCapLeadExportQualitySummary({ originalLeads: rawLeads, normalizedLeads: normalized });

  assert.equal(summary.qualityCycle, 3);
  assert.equal(summary.totalCaptured, 3);
  assert.equal(summary.totalExportable, 2);
  assert.equal(summary.duplicatesRemoved, 1);
  assert.equal(summary.readyToExport, 1);
  assert.equal(summary.reviewRequired, 1);
  assert.equal(summary.missingRequiredFields.email, 1);
  assert.equal(summary.enrichmentSuggestions.capture_whatsapp, 1);
  assert.equal(summary.externalAutomationApprovalRequired, true);
  assert.equal(summary.qualityGate, 'review_before_external_automation');
});
