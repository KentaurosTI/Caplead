function normalizePhoneDigits(value = '') {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits;
}

function formatBrazilPhone(digits = '') {
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits;
}

function isBrazilWhatsappPhone(value = '') {
  return /^\d{2}9\d{8}$/.test(normalizePhoneDigits(value));
}

function normalizeLeadPhone(lead = {}) {
  const raw = String(
    lead.whatsapp ||
    lead.numero_whatsapp ||
    lead.whatsapp_number ||
    lead.telefone ||
    lead.phone ||
    lead.contato_telefone || ''
  ).trim();
  return formatBrazilPhone(normalizePhoneDigits(raw));
}

module.exports = { normalizePhoneDigits, formatBrazilPhone, isBrazilWhatsappPhone, normalizeLeadPhone };
