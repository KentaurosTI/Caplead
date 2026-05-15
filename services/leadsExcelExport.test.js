const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EXCEL_EXPORT_COLUMNS,
  buildLeadExcelRows,
  normalizeWhatsapp,
} = require('./leadsExcelExport');

test('keeps Excel columns in the requested order', () => {
  assert.deepEqual(EXCEL_EXPORT_COLUMNS, [
    'Nome da empresa',
    'E-mail',
    'Número de WhatsApp para contato',
    'Site',
  ]);
});

test('builds rows with company, email, whatsapp and site', () => {
  const rows = buildLeadExcelRows([
    {
      nome: 'Clínica Aurora',
      email: 'contato@aurora.com.br',
      telefone: '+55 (11) 91234-5678',
      url: 'clinicaaurora.com.br',
    },
    {
      titulo: 'Studio Beta',
      developer_email: 'hello@beta.app',
      developer_site: 'https://beta.app',
    },
  ]);

  assert.deepEqual(rows, [
    {
      'Nome da empresa': 'Clínica Aurora',
      'E-mail': 'contato@aurora.com.br',
      'Número de WhatsApp para contato': '(11) 91234-5678',
      'Site': 'https://clinicaaurora.com.br',
    },
    {
      'Nome da empresa': 'Studio Beta',
      'E-mail': 'hello@beta.app',
      'Número de WhatsApp para contato': '',
      'Site': 'https://beta.app',
    },
  ]);
});

test('prefers explicit whatsapp fields before generic phone fields', () => {
  assert.equal(
    normalizeWhatsapp({ whatsapp: '11987654321', telefone: '1133334444' }),
    '(11) 98765-4321'
  );
});
