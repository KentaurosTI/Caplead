const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeLeadForKentauros } = require('./kentaurosExport');

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
