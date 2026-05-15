const XLSX = require('xlsx');

const EXCEL_EXPORT_COLUMNS = [
  'Nome da empresa',
  'E-mail',
  'Número de WhatsApp para contato',
  'Site',
];

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeSite(value) {
  const site = cleanText(value);
  if (!site) return '';
  if (/^https?:\/\//i.test(site)) return site;
  return `https://${site}`;
}

function normalizeEmail(lead = {}) {
  return cleanText(lead.email || lead.developer_email || lead.contato_email);
}

function normalizeCompanyName(lead = {}) {
  return cleanText(lead.nome || lead.titulo || lead.empresa || lead.developer_name || lead.url || lead.site_oficial);
}

function normalizeWhatsapp(lead = {}) {
  let digits = cleanText(
    lead.whatsapp ||
    lead.numero_whatsapp ||
    lead.whatsapp_number ||
    lead.telefone ||
    lead.phone ||
    lead.contato_telefone
  ).replace(/\D/g, '');

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

function normalizeLeadSite(lead = {}) {
  return normalizeSite(lead.url || lead.site_oficial || lead.developer_site || lead.app_store_url);
}

function buildLeadExcelRows(leads = []) {
  return leads.map((lead) => ({
    'Nome da empresa': normalizeCompanyName(lead),
    'E-mail': normalizeEmail(lead),
    'Número de WhatsApp para contato': normalizeWhatsapp(lead),
    'Site': normalizeLeadSite(lead),
  }));
}

function writeLeadsExcelFile(filePath, leads = []) {
  const rows = buildLeadExcelRows(leads);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXCEL_EXPORT_COLUMNS });
  worksheet['!cols'] = [
    { wch: 34 },
    { wch: 32 },
    { wch: 30 },
    { wch: 42 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads capturados');
  XLSX.writeFile(workbook, filePath, { bookType: 'xlsx' });
  return { filePath, rows: rows.length };
}

module.exports = {
  EXCEL_EXPORT_COLUMNS,
  buildLeadExcelRows,
  normalizeWhatsapp,
  writeLeadsExcelFile,
};
