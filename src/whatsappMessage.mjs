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
    `Olá, tudo bem? Aqui é o ${sender}, da Kentauros.`,
    'Faço parte de uma consultoria de soluções tecnológicas focada em analisar sites e sistemas para identificar melhorias de usabilidade, conversão e eficiência digital.',
    `Analisei rapidamente o site da ${company} e encontrei algumas oportunidades que podem melhorar a experiência do usuário e facilitar a geração de novos contatos.`,
    'Posso te enviar um diagnóstico rápido com os principais pontos que observei?'
  ].join('\n\n');
}

export function buildWhatsappUrl(lead = {}, senderName) {
  const phone = normalizeWhatsappPhone(lead.telefone || lead.phone || lead.whatsapp || '');
  if (!phone) return '';
  const message = buildWhatsappMessage(lead, senderName);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
