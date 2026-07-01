export function normalizeWhatsappPhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function isMapsUrl(url = '') {
  return /google\.com\/(maps|search)/i.test(String(url));
}

function hasWebsite(lead = {}) {
  return !!(
    lead.site_oficial ||
    lead.developer_site ||
    (lead.url && !isMapsUrl(lead.url))
  );
}

export function buildWhatsappMessage(lead = {}, senderName = 'Kentauros') {
  const company = lead.nome || lead.titulo || lead.empresa || 'sua empresa';
  const rawLocation = lead.localizacao || lead.location || '';
  // Use apenas bairro/cidade — ignora número de rua e CEP
  const location = rawLocation.split(/,\s*\d|,\s*[A-Z]{2},|\s*-\s*CEP|\s*-\s*SP,|\s*-\s*RJ,|\s*-\s*MG,/)[0].split(/,/).slice(0, 2).join(',').trim();

  if (hasWebsite(lead)) {
    return [
      'Olá! Tudo bem?',
      `Estava analisando rapidamente o ${company}${location ? ` em ${location}` : ''} e percebi alguns pontos que podem estar dificultando a transformação de visitantes em novos contatos.`,
      'Nada grave, mas são detalhes que costumam fazer pessoas interessadas desistirem antes mesmo de iniciar uma conversa.',
      'Trabalho na Kentauros, uma empresa especializada em identificar e corrigir esses gargalos digitais por meio de soluções tecnológicas: https://kentaurus.com.br/',
      'Se fizer sentido para você, posso te enviar um diagnóstico rápido com os 3 principais pontos que observei.'
    ].join('\n\n');
  }

  return [
    'Olá! Tudo bem?',
    `Vi que o ${company}${location ? ` em ${location}` : ''} ainda não tem um site e quis entrar em contato.`,
    'Muitas empresas locais perdem clientes todo dia simplesmente por não aparecerem quando alguém pesquisa no Google.',
    'Na Kentauros criamos sites profissionais e rápidos focados em trazer novos clientes — e já ajudamos negócios parecidos com o seu: https://kentaurus.com.br/',
    `Posso te enviar um exemplo do que faríamos para o ${company}? É rápido e sem custo nenhum.`
  ].join('\n\n');
}

export function buildWhatsappUrl(lead = {}, senderName) {
  const phone = normalizeWhatsappPhone(lead.telefone || lead.phone || lead.whatsapp || '');
  if (!phone) return '';
  const message = buildWhatsappMessage(lead, senderName);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
