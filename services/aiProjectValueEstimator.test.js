const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyAiProjectValue,
  estimateAiProjectValue,
  parseExistingValue,
} = require('./aiProjectValueEstimator');

test('estimates lower AI-assisted website project values from lead signals', () => {
  const value = estimateAiProjectValue({
    titulo: 'Clínica Médica Acesso Saúde',
    categoria: 'Saúde / Clínica',
    url: 'https://acessosaude.com.br',
    email: 'contato@acessosaude.com.br',
    telefone: '(11) 91234-5678',
    score_design: 42,
  });

  assert.equal(value, 10000);
});

test('keeps explicit project values when already provided', () => {
  assert.equal(parseExistingValue({ estimatedValue: 'R$ 7.490,00' }), 7490);
  assert.equal(estimateAiProjectValue({ estimatedValue: 'R$ 7.490,00' }), 7500);
});

test('adds Kentauros pricing fields without changing CapLead UI fields', () => {
  const lead = applyAiProjectValue({ titulo: 'Psicóloga Julia', categoria: 'saúde', url: 'julia.com.br' });

  assert.equal(lead.pricingModel, 'ai_development');
  assert.equal(lead.value, lead.estimatedValue);
  assert.equal(lead.valor_estimado, lead.estimatedValue);
  assert.ok(lead.estimatedValue >= 3500);
});
