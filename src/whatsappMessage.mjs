export const KENTAUROS_WHATSAPP_BUSINESS = '11930186652';

export function formatWhatsappBusinessContact(value = KENTAUROS_WHATSAPP_BUSINESS) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11) return digits;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizeWhatsappPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsappMessage(lead = {}, senderName = 'Kentauros') {
  const company = lead.nome || lead.titulo || lead.empresa || 'sua empresa';
  const sender = String(senderName || '').trim() || 'Kentauros';

  return [
    `Olá, tudo bem? Aqui é ${sender} da Kentauros.`,
    `Vi a presença digital da ${company} e identifiquei alguns pontos que podem ajudar a gerar mais contatos com soluções feitas em IA.`,
    'Posso te enviar um diagnóstico rápido?',
    `Meu WhatsApp Business é ${formatWhatsappBusinessContact()}.`
  ].join('\n\n');
}

export function buildWhatsappUrl(lead = {}, senderName) {
  const phone = normalizeWhatsappPhone(lead.telefone || lead.phone || lead.whatsapp || '');
  if (!phone) return '';
  const message = buildWhatsappMessage(lead, senderName);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
