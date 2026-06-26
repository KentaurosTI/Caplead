const puppeteer = require('puppeteer');
const crud = require('./crud');
const { getBrowserPath } = require('./browserPath');

// Cancellation flag — set via cancelSearch(), checked inside buscarLeads loop
let _cancelFlag = false;
function cancelSearch() { _cancelFlag = true; }
function resetCancelFlag() { _cancelFlag = false; }

// ============================================================
// MAPA NICHO → TEMA → BUSCAS + FILTROS
//
// Dois tipos de entrada:
//   • Termos ESPECÍFICOS: "advogado", "dentista" → buscas diretas
//   • Termos de CONTEXTO: "saúde", "jurídico"   → buscas expandidas
//
// A chave pode ser um nicho específico OU uma categoria ampla
// digitada pelo usuário no campo "Nicho de Atuação".
// ============================================================
const NICHO_MAP = {

  // ── SAÚDE (categorias amplas) ─────────────────────────────
  'saúde':          { tema: 'saúde', buscas: ['clínica médica particular', 'consultório médico privado', 'centro de saúde particular'],       filtros: ['clínica', 'consultório', 'médic', 'saúde', 'center', 'especialist', 'hospital'] },
  'saude':          { tema: 'saúde', buscas: ['clínica médica particular', 'consultório médico privado', 'centro médico'],                    filtros: ['clínica', 'consultório', 'médic', 'saúde', 'center', 'especialist'] },
  'clínica':        { tema: 'saúde', buscas: ['clínica médica', 'clínica particular', 'clínica especializada'],                               filtros: ['clínica', 'consultório', 'médic', 'especialist', 'tratamento'] },
  'clinica':        { tema: 'saúde', buscas: ['clínica médica', 'clínica particular', 'clínica especializada'],                               filtros: ['clínica', 'consultório', 'médic', 'especialist', 'tratamento'] },

  // ── SAÚDE (específicos) ───────────────────────────────────
  'odontologia':    { tema: 'saúde', buscas: ['clínica odontológica', 'dentista particular', 'consultório odontológico'],                     filtros: ['dent', 'odont', 'bucal', 'sorriso', 'clínica'] },
  'dentista':       { tema: 'saúde', buscas: ['dentista', 'clínica odontológica', 'consultório dentário'],                                    filtros: ['dent', 'odont', 'bucal', 'clínica'] },
  'medicina':       { tema: 'saúde', buscas: ['clínica médica', 'consultório médico', 'médico especialista'],                                 filtros: ['médi', 'clínica', 'saúde', 'consulta'] },
  'médico':         { tema: 'saúde', buscas: ['consultório médico', 'clínica médica', 'médico especialista'],                                 filtros: ['médic', 'clínica', 'consulta', 'especialist'] },
  'medico':         { tema: 'saúde', buscas: ['consultório médico', 'clínica médica', 'médico especialista'],                                 filtros: ['médic', 'clínica', 'consulta', 'especialist'] },
  'psicologia':     { tema: 'saúde', buscas: ['psicólogo', 'clínica de psicologia', 'consultório psicológico'],                               filtros: ['psic', 'terapi', 'clínica', 'mental'] },
  'fisioterapia':   { tema: 'saúde', buscas: ['fisioterapeuta', 'clínica de fisioterapia', 'reabilitação'],                                   filtros: ['fisio', 'reabilit', 'clínica'] },
  'nutrição':       { tema: 'saúde', buscas: ['nutricionista', 'consultório nutricional', 'clínica de nutrição'],                             filtros: ['nutri', 'dieta', 'alimentação', 'consulta'] },
  'nutricao':       { tema: 'saúde', buscas: ['nutricionista', 'consultório nutricional'],                                                    filtros: ['nutri', 'dieta', 'consulta'] },
  'oftalmologia':   { tema: 'saúde', buscas: ['oftalmologista', 'clínica de olhos', 'ótica médica'],                                         filtros: ['oftalm', 'olhos', 'visão', 'clínica'] },
  'dermatologia':   { tema: 'saúde', buscas: ['dermatologista', 'clínica de pele', 'tratamento dermatológico'],                               filtros: ['dermat', 'pele', 'clínica'] },
  'veterinária':    { tema: 'saúde', buscas: ['veterinário', 'clínica veterinária', 'hospital veterinário'],                                  filtros: ['veterin', 'pet', 'animal', 'clínica'] },

  // ── JURÍDICO (contexto + específicos) ────────────────────
  'jurídico':       { tema: 'jurídico', buscas: ['escritório de advocacia', 'consultoria jurídica', 'advogado especialista'],                 filtros: ['advog', 'jurídic', 'direito', 'advocaci', 'associ', 'assessori'] },
  'juridico':       { tema: 'jurídico', buscas: ['escritório de advocacia', 'consultoria jurídica', 'advogado especialista'],                 filtros: ['advog', 'jurídic', 'direito', 'advocaci', 'associ'] },
  'advogado':       { tema: 'jurídico', buscas: ['advogado', 'escritório de advocacia', 'consultoria jurídica'],                             filtros: ['advog', 'jurídic', 'direito', 'advocaci', 'assessori', 'associ'] },
  'advocacia':      { tema: 'jurídico', buscas: ['escritório de advocacia', 'advogado especialista'],                                         filtros: ['advog', 'jurídic', 'direito', 'advocaci'] },
  'direito':        { tema: 'jurídico', buscas: ['advogado', 'escritório jurídico', 'consultoria jurídica'],                                  filtros: ['advog', 'jurídic', 'direito'] },

  // ── CONTABILIDADE ─────────────────────────────────────────
  'contabilidade':  { tema: 'contábil', buscas: ['escritório de contabilidade', 'contador', 'contabilidade empresarial'],                      filtros: ['contab', 'contador', 'fiscal', 'tribut', 'mei'] },
  'contador':       { tema: 'contábil', buscas: ['contador', 'escritório contábil', 'serviços contábeis'],                                    filtros: ['contab', 'contador', 'fiscal'] },
  'contábil':       { tema: 'contábil', buscas: ['escritório contábil', 'contador especializado', 'serviços contábeis'],                      filtros: ['contab', 'contador', 'fiscal', 'tribut'] },
  'contabil':       { tema: 'contábil', buscas: ['escritório contábil', 'contador especializado'],                                            filtros: ['contab', 'contador', 'fiscal', 'tribut'] },
  'financeiro':     { tema: 'financeiro', buscas: ['consultoria financeira', 'planejamento financeiro', 'assessoria de investimentos'],        filtros: ['financ', 'invest', 'consult', 'patrimon', 'capital'] },
  'financeira':     { tema: 'financeiro', buscas: ['consultoria financeira', 'planejamento financeiro'],                                      filtros: ['financ', 'invest', 'consult'] },

  // ── ENGENHARIA / ARQUITETURA ──────────────────────────────
  'engenharia':     { tema: 'técnico', buscas: ['escritório de engenharia', 'engenheiro especialista', 'projetos de engenharia'],             filtros: ['engenh', 'projetos', 'técnic', 'constru'] },
  'arquitetura':    { tema: 'técnico', buscas: ['escritório de arquitetura', 'arquiteto', 'design de interiores'],                           filtros: ['arquitet', 'projetos', 'design', 'interior'] },
  'construção':     { tema: 'técnico', buscas: ['construtora', 'empresa de construção civil', 'empreiteira'],                                filtros: ['constru', 'engenh', 'obra', 'imóvel'] },
  'construcao':     { tema: 'técnico', buscas: ['construtora', 'empresa de construção civil', 'empreiteira'],                                filtros: ['constru', 'engenh', 'obra'] },

  // ── BELEZA / ESTÉTICA ─────────────────────────────────────
  'beleza':         { tema: 'beleza',  buscas: ['salão de beleza', 'clínica de estética', 'studio de beleza'],                               filtros: ['salão', 'estétic', 'beleza', 'barber', 'spa', 'cabelo', 'studio'] },
  'estética':       { tema: 'beleza',  buscas: ['clínica de estética', 'estetição', 'estética avançada'],                                    filtros: ['estétic', 'beleza', 'salão', 'spa', 'skin'] },
  'estetica':       { tema: 'beleza',  buscas: ['clínica de estética', 'studio de estética', 'beleza e bem-estar'],                          filtros: ['estétic', 'estetica', 'beleza', 'salão', 'spa'] },
  'salão':          { tema: 'beleza',  buscas: ['salão de beleza', 'hair studio', 'cabeleireiro'],                                           filtros: ['salão', 'beleza', 'cabelo', 'barbeari', 'hair'] },
  'salao':          { tema: 'beleza',  buscas: ['salão de beleza', 'hair studio', 'cabeleireiro'],                                           filtros: ['salão', 'beleza', 'cabelo', 'hair'] },
  'barbearia':      { tema: 'beleza',  buscas: ['barbearia', 'barber shop', 'barbearia masculina'],                                          filtros: ['barber', 'barbeari', 'cabelo'] },

  // ── GASTRONOMIA / ALIMENTAÇÃO ─────────────────────────────
  'alimentação':    { tema: 'gastronomia', buscas: ['restaurante', 'lanchonete artesanal', 'padaria artesanal'],                              filtros: ['restaur', 'lanch', 'padari', 'gastron', 'comida', 'culiná'] },
  'alimentacao':    { tema: 'gastronomia', buscas: ['restaurante', 'lanchonete', 'padaria artesanal'],                                        filtros: ['restaur', 'lanch', 'padari', 'gastron', 'comida'] },
  'gastronomia':    { tema: 'gastronomia', buscas: ['restaurante gourmet', 'gastronomia', 'chef de cozinha'],                                 filtros: ['restaur', 'gastron', 'chef', 'culiná', 'comida'] },
  'restaurante':    { tema: 'gastronomia', buscas: ['restaurante', 'bistro', 'culinária'],                                                   filtros: ['restaur', 'gastron', 'comida', 'culiná', 'cardápio'] },
  'pizzaria':       { tema: 'gastronomia', buscas: ['pizzaria', 'pizza delivery'],                                                           filtros: ['pizz', 'restaur'] },
  'lanchonete':     { tema: 'gastronomia', buscas: ['lanchonete', 'hamburgueria', 'fast food artesanal'],                                    filtros: ['lanch', 'hambur', 'snack', 'restaur'] },
  'padaria':        { tema: 'gastronomia', buscas: ['padaria artesanal', 'panificadora', 'confeitaria'],                                     filtros: ['padari', 'panific', 'confeit', 'pão'] },

  // ── IMÓVEIS ───────────────────────────────────────────────
  'imóveis':        { tema: 'imóveis', buscas: ['imobiliária', 'corretor de imóveis', 'agência imobiliária'],                                filtros: ['imobil', 'imoveis', 'imóveis', 'corretor', 'aluguel'] },
  'imoveis':        { tema: 'imóveis', buscas: ['imobiliária', 'corretor de imóveis', 'agência imobiliária'],                                filtros: ['imobil', 'imoveis', 'imóveis', 'corretor', 'aluguel'] },
  'imobiliária':    { tema: 'imóveis', buscas: ['imobiliária', 'agência imobiliária', 'corretor de imóveis'],                                filtros: ['imobil', 'imoveis', 'imóveis', 'corretor', 'aluguel'] },
  'imobiliaria':    { tema: 'imóveis', buscas: ['imobiliária', 'agência imobiliária', 'corretor de imóveis'],                                filtros: ['imobil', 'imoveis', 'corretor'] },
  'corretor':       { tema: 'imóveis', buscas: ['corretor de imóveis', 'imobiliária'],                                                       filtros: ['corretor', 'imobil', 'imóveis'] },

  // ── EDUCAÇÃO ──────────────────────────────────────────────
  'educação':       { tema: 'educação', buscas: ['escola particular', 'curso profissionalizante', 'centro educacional'],                      filtros: ['escol', 'colégi', 'curso', 'ensino', 'educat', 'academi'] },
  'educacao':       { tema: 'educação', buscas: ['escola particular', 'curso profissionalizante', 'centro educacional'],                      filtros: ['escol', 'colégi', 'curso', 'ensino', 'educat'] },
  'escola':         { tema: 'educação', buscas: ['escola particular', 'colégio', 'centro educacional'],                                       filtros: ['escol', 'colégi', 'educat', 'ensino', 'pedagog'] },
  'curso':          { tema: 'educação', buscas: ['escola de cursos', 'curso profissionalizante', 'treinamento profissional'],                  filtros: ['curso', 'escol', 'treinamento', 'capacit', 'profiss'] },
  'faculdade':      { tema: 'educação', buscas: ['faculdade particular', 'centro universitário', 'ensino superior privado'],                  filtros: ['faculdade', 'univers', 'ensino superior', 'graduação'] },

  // ── FITNESS ───────────────────────────────────────────────
  'fitness':        { tema: 'fitness', buscas: ['academia fitness', 'centro esportivo', 'personal trainer'],                                  filtros: ['fitness', 'academi', 'crossfit', 'treino', 'sport', 'gym'] },
  'academia':       { tema: 'fitness', buscas: ['academia de ginástica', 'crossfit', 'centro fitness'],                                       filtros: ['academi', 'crossfit', 'fitness', 'treino', 'sport'] },
  'personal':       { tema: 'fitness', buscas: ['personal trainer', 'treinamento personalizado'],                                            filtros: ['personal', 'trainer', 'treino', 'fitness'] },

  // ── TECNOLOGIA / DIGITAL ──────────────────────────────────
  'tecnologia':     { tema: 'tech', buscas: ['empresa de tecnologia', 'software house', 'desenvolvimento de sistemas'],                       filtros: ['tecnolog', 'software', 'sistema', 'develop', 'digital', 'soluções'] },
  'marketing':      { tema: 'tech', buscas: ['agência de marketing digital', 'marketing digital', 'agência criativa'],                        filtros: ['marketing', 'agênci', 'digital', 'propaganda', 'media'] },
  'digital':        { tema: 'tech', buscas: ['agência digital', 'empresa de marketing digital', 'produção de conteúdo'],                      filtros: ['digital', 'agênci', 'tecnolog', 'marketing', 'software'] },
  'ti':             { tema: 'tech', buscas: ['empresa de TI', 'suporte em TI', 'consultoria tecnológica'],                                    filtros: ['tecnolog', 'ti', 'sistema', 'inform', 'soluções'] },

  // ── AUTO ──────────────────────────────────────────────────
  'oficina':        { tema: 'auto', buscas: ['oficina mecânica', 'auto center', 'mecânica automotiva'],                                       filtros: ['oficin', 'mecân', 'auto', 'carro', 'veículo'] },
  'automóveis':     { tema: 'auto', buscas: ['concessionária de carros', 'oficina mecânica', 'auto shopping'],                                filtros: ['concession', 'veícul', 'carro', 'auto', 'mecân'] },
  'automoveis':     { tema: 'auto', buscas: ['concessionária de carros', 'venda de veículos', 'auto shopping'],                              filtros: ['concession', 'veícul', 'carro', 'auto'] },

  // ── LOGÍSTICA ─────────────────────────────────────────────
  'logística':      { tema: 'logística', buscas: ['empresa de transporte', 'transportadora', 'logística empresarial'],                        filtros: ['logíst', 'transport', 'frete', 'entrega', 'distribu'] },
  'logistica':      { tema: 'logística', buscas: ['empresa de transporte', 'transportadora', 'logística empresarial'],                        filtros: ['logíst', 'transport', 'frete', 'entrega'] },
  'transporte':     { tema: 'logística', buscas: ['transportadora', 'empresa de frete', 'transporte de cargas'],                             filtros: ['transport', 'frete', 'carga', 'logíst'] },

  // ── VAREJO ────────────────────────────────────────────────
  'varejo':         { tema: 'varejo', buscas: ['loja especializada', 'comércio varejista', 'loja online'],                                    filtros: ['varejo', 'loja', 'comércio', 'shop', 'store'] },
  'loja':           { tema: 'varejo', buscas: ['loja especializada', 'comércio varejista', 'boutique'],                                       filtros: ['loja', 'varejo', 'shop', 'store', 'comércio'] },

  // ── EVENTOS ───────────────────────────────────────────────
  'eventos':        { tema: 'eventos', buscas: ['empresa de eventos', 'buffet', 'espaço para eventos'],                                       filtros: ['event', 'buffet', 'espaço', 'festas', 'cerimôn'] },
  'buffet':         { tema: 'eventos', buscas: ['buffet', 'serviço de buffet', 'buffet para casamento'],                                      filtros: ['buffet', 'event', 'festas', 'casamento'] },
  'e-commerce':     { tema: 'e-commerce', buscas: ['loja online', 'e-commerce', 'empresa de ecommerce'], filtros: ['loja', 'ecommerce', 'online', 'shop', 'store'] },
  'ecommerce':      { tema: 'e-commerce', buscas: ['loja online', 'e-commerce', 'empresa de ecommerce'], filtros: ['loja', 'ecommerce', 'online', 'shop', 'store'] },
  'hamburgueria':   { tema: 'gastronomia', buscas: ['hamburgueria', 'hamburgueria artesanal', 'burger restaurant'], filtros: ['hambur', 'burger', 'lanch', 'restaur'] },
  'construtora':    { tema: 'tecnico', buscas: ['construtora', 'incorporadora', 'empresa de construcao civil'], filtros: ['constru', 'obra', 'engenh', 'incorpor'] },
  'publicidade':    { tema: 'tech', buscas: ['agencia de publicidade', 'agencia de marketing', 'agencia criativa'], filtros: ['agenci', 'marketing', 'publicidade', 'propaganda'] },
  'hotel':          { tema: 'hotelaria', buscas: ['hotel', 'pousada', 'hospedagem'], filtros: ['hotel', 'pousada', 'hosped', 'turismo'] },
  'pousada':        { tema: 'hotelaria', buscas: ['pousada', 'hotel', 'hospedagem'], filtros: ['pousada', 'hotel', 'hosped'] },
  'turismo':        { tema: 'turismo', buscas: ['agencia de turismo', 'operadora de turismo', 'passeios turisticos'], filtros: ['turismo', 'viagem', 'passeio', 'agenci'] },
  'pet shop':       { tema: 'pet', buscas: ['pet shop', 'banho e tosa', 'clinica veterinaria'], filtros: ['pet', 'veterin', 'banho', 'tosa'] },
  'roupas':         { tema: 'varejo', buscas: ['loja de roupas', 'boutique', 'moda feminina'], filtros: ['roupa', 'moda', 'boutique', 'loja'] },
};

/**
 * Busca o mapeamento nicho→tema para um nicho digitado.
 * Aceita correspondência exata, parcial e por substring.
 */
function getNichoInfo(nicho) {
  const normalized = nicho.toLowerCase().trim();

  // 1. Verificação exata
  if (NICHO_MAP[normalized]) return NICHO_MAP[normalized];

  // 2. Verificação parcial (o nicho digitado contém uma chave ou vice-versa)
  for (const [key, val] of Object.entries(NICHO_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return val;
  }

  // 3. Fallback genérico
  const shortNicho = normalized.substring(0, 5);
  return {
    tema: 'geral',
    buscas: [nicho, `empresa de ${nicho} site`, `${nicho} profissional`],
    filtros: [shortNicho]
  };
}

function inferLeadCategory(lead = {}, fallback = '') {
  const rawCategory = String(lead.categoria || '').trim();
  if (rawCategory && rawCategory.toLowerCase() !== 'geral' && !/^[\W_]+$/u.test(rawCategory)) {
    return rawCategory;
  }

  const signal = [
    lead.titulo,
    lead.descricao,
    lead.site_oficial,
    lead.url,
    fallback
  ].filter(Boolean).join(' ').toLowerCase();

  const rules = [
    { label: 'Imobiliária / Imóveis', terms: ['imobili', 'imóvel', 'imoveis', 'imóveis', 'corretor', 'apartamento'] },
    { label: 'Advocacia / Jurídico', terms: ['advoc', 'jurídic', 'juridic', 'direito', 'advogado'] },
    { label: 'Estética e Beleza', terms: ['beleza', 'salon', 'salao', 'salão', 'cabelo', 'barbearia', 'estética', 'estetica'] },
    { label: 'Saúde / Clínica', terms: ['clínica', 'clinica', 'médic', 'medic', 'odont', 'dent', 'fisioterapia', 'psicolog'] },
    { label: 'Restaurante / Alimentação', terms: ['restaurante', 'pizzaria', 'lanchonete', 'burger', 'food'] },
    { label: 'Educação / Ensino', terms: ['escola', 'curso', 'faculdade', 'ensino', 'colégio', 'colegio'] },
    { label: 'Tecnologia / Software', terms: ['software', 'tecnologia', 'sistema', 'digital', 'ti '] },
    { label: 'Contabilidade / Financeiro', terms: ['contab', 'financeir', 'contador'] }
  ];

  return rules.find(rule => rule.terms.some(term => signal.includes(term)))?.label || fallback || 'Categoria não identificada';
}

function getContactFilterLabel(contactFilterMode) {
  if (contactFilterMode === 'both') return 'com e-mail e WhatsApp';
  if (contactFilterMode === 'email') return 'com e-mail';
  if (contactFilterMode === 'whatsapp') return 'com WhatsApp';
  return 'novos';
}

/**
 * Realiza o scraping de leads baseados em um nicho e região.
 */
async function buscarLeads(nicho, regiao, onlyWithoutSite = false, captureOptions = {}, onProgress = null) {
  if (typeof captureOptions === 'function') {
    onProgress = captureOptions;
    captureOptions = {};
  }
  resetCancelFlag();
  const emitProgress = (payload) => {
    if (typeof onProgress === 'function') {
      try { onProgress(payload); } catch (_) {}
    }
  };

  const executablePath = getBrowserPath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,720'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    let coords = null;
    if (regiao) {
      coords = getRegionCoords(regiao);
      if (coords) {
        try {
          const context = browser.defaultBrowserContext();
          await context.overridePermissions('https://www.google.com', ['geolocation']);
          await page.setGeolocation(coords);
          console.log(`[Scraper] Geolocation emulada para: ${regiao} (${coords.latitude}, ${coords.longitude})`);
        } catch (err) {
          console.warn('[Scraper] Erro ao setar geolocation:', err.message);
        }
      }
    }

    const nichoInfo = getNichoInfo(nicho);
    console.log(`[Scraper] Nicho: "${nicho}" -> Tema: "${nichoInfo.tema}"`);

    let savedCount = 0;
    let duplicateCount = 0;
    let inspectedCount = 0;
    let consecutiveSaveFailures = 0;
    const processedLeads = [];

    // Pre-load keys already in DB to avoid duplicates across executions (Task 1)
    const existingUrlsInBatch = new Set();
    try {
      const dbKeys = await crud.getExistingLeadKeys();
      dbKeys.forEach(k => existingUrlsInBatch.add(k));
    } catch (_) {}

    const searchTerms = nichoInfo.buscas?.length ? nichoInfo.buscas : [nicho];
    const queries = [...new Set(searchTerms.map(term => regiao ? `${term} em ${regiao}` : term))];
    const targetNewLeads = Math.min(50, Math.max(1, Number(captureOptions.limit || 20) || 20));
    const contactFilterMode = captureOptions.requireEmail && captureOptions.requireWhatsapp
      ? 'both'
      : captureOptions.requireEmail
        ? 'email'
        : captureOptions.requireWhatsapp
          ? 'whatsapp'
          : 'all';
    const contactFilterLabel = getContactFilterLabel(contactFilterMode);
    const candidateMultiplier = contactFilterMode === 'all' ? 4 : contactFilterMode === 'both' ? 10 : 8;
    const minPlacesPerQuery = contactFilterMode === 'all' ? 40 : contactFilterMode === 'both' ? 80 : 60;
    const maxPlacesPerQuery = Math.min(320, Math.max(minPlacesPerQuery, targetNewLeads * candidateMultiplier));
    const maxScrollsPerQuery = Math.min(32, Math.max(8, Math.ceil(maxPlacesPerQuery / 10)));

    emitProgress({ phase: 'searching', percent: 5, message: `Buscando oportunidades em ${regiao || 'todo o Brasil'}...`, currentLead: '' });

    for (let queryIndex = 0; queryIndex < queries.length && savedCount < targetNewLeads; queryIndex++) {
      const query = queries[queryIndex];
      console.log(`\n[Scraper] Buscando no Maps: "${query}"`);
      emitProgress({
        phase: 'searching',
        percent: Math.min(12 + queryIndex * 10, 45),
        message: `Pesquisando: ${query}`,
        currentLead: ''
      });

      const allLeads = await scrapeGoogleMaps(page, query, coords, {
        maxPlaces: maxPlacesPerQuery,
        maxScrolls: maxScrollsPerQuery,
        targetNewLeads,
        onProgress: (progress) => emitProgress({
          phase: 'collecting',
          percent: Math.min(12 + queryIndex * 10 + Math.round((progress.percent || 0) * 0.25), 60),
          message: progress.message,
          currentLead: progress.currentLead || '',
          savedCount,
          targetNewLeads
        })
      });
      console.log(`\n[Scraper] Total bruto extra?do em "${query}": ${allLeads.length}`);

      for (const lead of allLeads) {
        if (_cancelFlag) {
          emitProgress({ phase: 'cancelled', percent: 100, message: `Captura cancelada. ${savedCount} leads salvos.`, currentLead: '', savedCount, targetNewLeads });
          break;
        }
        inspectedCount++;
        const finalUrl = lead.site_oficial ? cleanUrl(lead.site_oficial) : lead.maps_url;
        const batchKey = finalUrl || lead.maps_url || `${lead.titulo}|${lead.localizacao}`;
        if (!finalUrl || existingUrlsInBatch.has(batchKey)) { duplicateCount++; continue; }

        emitProgress({
          phase: 'saving',
          percent: Math.min(60 + Math.round((savedCount / targetNewLeads) * 35), 95),
          message: `Meta: ${targetNewLeads} leads ${contactFilterLabel}. Salvos ${savedCount}/${targetNewLeads}.`,
          currentLead: lead.titulo || finalUrl,
          savedCount,
          targetNewLeads
        });
        
        if (onlyWithoutSite && lead.has_digital_presence === 1) {
          console.log(`[Filter] Ignorando (possui site): ${finalUrl}`);
          continue;
        }
        
        if (lead.has_digital_presence === 1 && isBlacklisted(finalUrl)) {
          console.log(`[Filter] Blacklist: ${finalUrl}`);
          continue;
        }
        
        if (await crud.isUrlBlocked(finalUrl)) {
          console.log(`[Filter] Bloqueado no DB: ${finalUrl}`);
          continue;
        }

        try {
          let candidateContacts = { emails: [], phones: [], whatsappPhones: [] };
          if (contactFilterMode !== 'all') {
            emitProgress({
              phase: 'contact-filter',
              percent: Math.min(60 + Math.round((savedCount / targetNewLeads) * 30), 94),
              message: contactFilterMode === 'both'
                ? `Verificando e-mail e WhatsApp. Salvos ${savedCount}/${targetNewLeads}.`
                : contactFilterMode === 'email'
                  ? `Verificando e-mail. Salvos ${savedCount}/${targetNewLeads}.`
                  : `Verificando WhatsApp. Salvos ${savedCount}/${targetNewLeads}.`,
              currentLead: lead.titulo || finalUrl,
              savedCount,
              targetNewLeads
            });

            candidateContacts = contactFilterMode === 'whatsapp' && isBrazilWhatsappPhone(lead.telefone)
              ? extractBaseLeadContacts(lead)
              : await extractCandidateContacts(browser, lead, finalUrl);
            const contactSelection = resolveLeadContactSelection(lead, candidateContacts);
            const hasEmail = contactSelection.hasEmail;
            const hasWhatsapp = contactSelection.hasWhatsapp;
            if (contactFilterMode === 'both' && (!hasEmail || !hasWhatsapp)) continue;
            if (contactFilterMode === 'email' && !hasEmail) continue;
            if (contactFilterMode === 'whatsapp' && !hasWhatsapp) continue;
          }

          const contactSelection = resolveLeadContactSelection(lead, candidateContacts);
          const resolvedCategory = inferLeadCategory({ ...lead, url: finalUrl }, nichoInfo.tema);
          const savedLead = await crud.createLeadSite({
            url: finalUrl,
            titulo: lead.titulo,
            descricao: resolvedCategory + (lead.localizacao ? ` - ${lead.localizacao}` : ''),
            score_design: 0,
            data_ultima_atualizacao: new Date().toISOString(),
            telefone: contactSelection.primaryPhone,
            categoria: resolvedCategory,
            localizacao: lead.localizacao,
            maps_url: lead.maps_url,
            site_oficial: lead.site_oficial,
            has_digital_presence: lead.has_digital_presence
          });

          existingUrlsInBatch.add(batchKey);
          if (savedLead.duplicate || savedLead.changes === 0) {
            duplicateCount++;
            consecutiveSaveFailures = 0;
            continue;
          }

          const contactPhones = contactSelection.contactPhones;
          processedLeads.push({
            ...lead,
            id: savedLead.id,
            url: finalUrl,
            categoria: resolvedCategory,
            telefone: contactSelection.primaryPhone
          });
          if (candidateContacts.emails?.length || contactPhones.length) {
            const maxContacts = Math.max(candidateContacts.emails.length, contactPhones.length);
            for (let i = 0; i < maxContacts; i++) {
              await crud.createContato({
                lead_id: savedLead.id,
                email: candidateContacts.emails[i] || null,
                telefone: contactPhones[i] || null,
                fonte: contactFilterMode === 'both' ? 'Filtro E-mail + WhatsApp' : contactFilterMode === 'email' ? 'Filtro E-mail' : 'Filtro WhatsApp'
              });
            }
          }
          savedCount++;
          consecutiveSaveFailures = 0;
          if (savedCount >= targetNewLeads) break;
        } catch (e) {
          consecutiveSaveFailures++;
          console.warn(`[Scraper] Falha ao salvar lead "${lead.titulo || finalUrl}": ${e.message}`);
          if (e instanceof ReferenceError || (savedCount === 0 && consecutiveSaveFailures >= 8)) {
            throw new Error(`Captura interrompida: falhas consecutivas ao salvar leads (${e.message}).`);
          }
        }
      }
    }

    emitProgress({
      phase: 'done',
      percent: 100,
      message: `Captura finalizada: ${savedCount}/${targetNewLeads} leads ${contactFilterLabel}, ${duplicateCount} repetidos ignorados.`,
      currentLead: '',
      savedCount,
      targetNewLeads
    });

    const wasCancelled = _cancelFlag;
    resetCancelFlag();
    console.log(`[Scraper] Busca finalizada. Salvos: ${savedCount}. Repetidos ignorados: ${duplicateCount}. Inspecionados: ${inspectedCount}. Cancelado: ${wasCancelled}`);
    return { success: true, count: savedCount, target: targetNewLeads, contactFilterMode, duplicates: duplicateCount, inspected: inspectedCount, capturados: processedLeads, cancelled: wasCancelled };

  } catch (error) {
    console.error('[Scraper] Erro cr?tico:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
async function scrapeGoogleMaps(page, query, coords, options = {}) {
  const results = [];
  const maxPlaces = options.maxPlaces || 80;
  const maxScrolls = options.maxScrolls || 18;
  const targetNewLeads = options.targetNewLeads || 50;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  let url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  if (coords) {
    url += `/@${coords.latitude},${coords.longitude},12z`;
  }
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 24000 });
    await new Promise(r => setTimeout(r, 3000));

    const collectedLinks = new Set();
    let stableScrolls = 0;
    for (let i = 0; i < maxScrolls && collectedLinks.size < maxPlaces && stableScrolls < 3; i++) {
      const before = collectedLinks.size;
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href^="https://www.google.com/maps/place/"]')).map(a => a.href);
      });
      links.forEach(link => collectedLinks.add(link));

      onProgress({
        percent: Math.round(((i + 1) / maxScrolls) * 100),
        message: `Coletando resultados do Maps: ${collectedLinks.size} encontrados`,
        currentLead: ''
      });

      stableScrolls = collectedLinks.size === before ? stableScrolls + 1 : 0;
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollBy(0, Math.max(feed.clientHeight * 1.8, 1800));
        else window.scrollBy(0, 1800);
      });
      await new Promise(r => setTimeout(r, 900));
    }

    const placeLinks = [...collectedLinks].slice(0, maxPlaces);
    console.log(`[Google Maps] Encontrados ${placeLinks.length} estabelecimentos. Extraindo dados...`);

    for (let index = 0; index < placeLinks.length; index++) {
      const link = placeLinks[index];
      let maxRetries = 2;
      let attempt = 0;
      let success = false;
      
      while (attempt < maxRetries && !success) {
        try {
          attempt++;
          await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 12000 + (attempt * 3000) });
          await new Promise(r => setTimeout(r, 900 * attempt));
          
          const placeData = await page.evaluate((mapsUrl) => {
            const getText = (selector) => {
              const el = document.querySelector(selector);
              return el ? el.innerText.trim() : '';
            };
            
            const titulo = getText('h1');
            const categoria = getText('button[jsaction="pane.rating.category"]');
            const addressEl = document.querySelector('button[data-item-id="address"]');
            const localizacao = addressEl ? addressEl.innerText.trim() : '';
            const phoneEl = document.querySelector('button[data-item-id^="phone:tel:"]');
            const telefone = phoneEl ? phoneEl.innerText.trim() : '';
            const websiteEl = document.querySelector('a[data-item-id="authority"]');
            const site_oficial = websiteEl ? websiteEl.href : '';
            const has_digital_presence = site_oficial ? 1 : 0;

            return { titulo, categoria, localizacao, telefone, site_oficial, maps_url: mapsUrl, has_digital_presence };
          }, link);
          
          if (placeData.titulo) {
            onProgress({
              percent: Math.round(((index + 1) / placeLinks.length) * 100),
              message: `Verificando candidato ${index + 1}/${placeLinks.length}. Meta da captura: ${targetNewLeads} leads.`,
              currentLead: placeData.titulo
            });
            console.log(`[Google Maps] Extra?do: ${placeData.titulo} (${placeData.has_digital_presence ? 'Com Site' : 'Sem Site'})`);
            results.push(placeData);
            success = true;
          } else {
            throw new Error('P?gina carregou, mas t?tulo n?o foi encontrado.');
          }
        } catch(e) {
          console.log(`[Google Maps] Erro ao ler detalhe (Tentativa ${attempt}/${maxRetries}): ${e.message}`);
          if (attempt >= maxRetries) {
            console.log('[Google Maps] Desistindo de extrair a URL ap?s as tentativas.');
          }
        }
      }
    }
  } catch (e) {
    console.error(`[Google Maps] Erro geral na busca: ${e.message}`);
  }
  return results;
}

function normalizePhoneDigits(value = '') {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  return digits;
}

function isBrazilWhatsappPhone(value = '') {
  return /^\d{2}9\d{8}$/.test(normalizePhoneDigits(value));
}

function resolveLeadContactSelection(lead = {}, candidateContacts = {}) {
  const leadPhone = normalizePhoneDigits(lead.telefone);
  const whatsappPhones = [...new Set([
    ...(candidateContacts.whatsappPhones || []).map(normalizePhoneDigits),
    ...(isBrazilWhatsappPhone(leadPhone) ? [leadPhone] : [])
  ].filter(Boolean))];
  const otherPhones = [
    ...(candidateContacts.phones || []).map(normalizePhoneDigits),
    leadPhone
  ].filter(phone => phone.length >= 10 && phone.length <= 11);
  const contactPhones = [...new Set([...whatsappPhones, ...otherPhones])];

  return {
    hasEmail: (candidateContacts.emails || []).length > 0,
    hasWhatsapp: whatsappPhones.length > 0,
    whatsappPhone: whatsappPhones[0] || '',
    primaryPhone: whatsappPhones[0] || leadPhone || otherPhones[0] || '',
    contactPhones
  };
}

function extractContactsFromText(text = '') {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/g;
  const compactPhoneRegex = /(?:\+?55)?\d{10,11}/g;
  const emails = [...new Set(text.match(emailRegex) || [])]
    .map(email => email.trim().replace(/^mailto:/i, '').split('?')[0])
    .filter(email => !/\.(png|jpe?g|webp|gif|svg)$/i.test(email));
  const phones = [...new Set([...(text.match(phoneRegex) || []), ...(text.match(compactPhoneRegex) || [])]
    .map(normalizePhoneDigits)
    .filter(phone => phone.length >= 10 && phone.length <= 11))];
  const whatsappPhones = [];
  [
    /(?:https?:\/\/)?(?:www\.)?wa\.me\/(?:55)?(\d{10,11})/gi,
    /(?:https?:\/\/)?(?:api\.|web\.)?whatsapp\.com\/send\?[^"'<>]*?phone=(?:55)?(\d{10,11})/gi,
    /whatsapp:\/\/send\?[^"'<>]*?phone=(?:55)?(\d{10,11})/gi
  ].forEach(regex => {
    let match;
    while ((match = regex.exec(text)) !== null) whatsappPhones.push(normalizePhoneDigits(match[1]));
  });
  return {
    emails,
    phones,
    whatsappPhones: [...new Set([...whatsappPhones, ...phones.filter(isBrazilWhatsappPhone)])]
  };
}

async function extractCandidateContacts(browser, lead, finalUrl) {
  const baseContacts = extractBaseLeadContacts(lead);
  if (!lead.site_oficial || !finalUrl || isGoogleMapsUrl(finalUrl)) return baseContacts;

  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(finalUrl.startsWith('http') ? finalUrl : `https://${finalUrl}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await new Promise(r => setTimeout(r, 700));
    const signal = await page.evaluate(() => {
      const visibleText = document.body ? document.body.innerText : '';
      const html = document.body ? document.body.innerHTML : '';
      const linkSignals = Array.from(document.querySelectorAll('a[href], button, [onclick], [aria-label], [title], [data-href], [data-url]'))
        .map(el => [
          el.innerText,
          el.getAttribute('href'),
          el.getAttribute('onclick'),
          el.getAttribute('aria-label'),
          el.getAttribute('title'),
          el.getAttribute('data-href'),
          el.getAttribute('data-url')
        ].filter(Boolean).join(' '))
        .join('\n');
      return `${visibleText}\n${html}\n${linkSignals}`;
    });
    const siteContacts = extractContactsFromText(signal);
    return {
      emails: [...new Set([...baseContacts.emails, ...siteContacts.emails])],
      phones: [...new Set([...baseContacts.phones, ...siteContacts.phones])],
      whatsappPhones: [...new Set([...baseContacts.whatsappPhones, ...siteContacts.whatsappPhones])]
    };
  } catch (err) {
    return baseContacts;
  } finally {
    await page.close().catch(() => {});
  }
}

function extractBaseLeadContacts(lead = {}) {
  return extractContactsFromText([lead.telefone, lead.site_oficial, lead.maps_url].filter(Boolean).join('\n'));
}

function cleanUrl(rawUrl) {
  try {
    const urlObj = new URL(rawUrl);
    const domain = urlObj.hostname.toLowerCase();
    if (domain.includes('google') || domain.includes('bing') || 
        domain.includes('instagram') || domain.includes('facebook') ||
        domain.length < 4) return null;
    return `${urlObj.protocol}//${domain}`.toLowerCase();
  } catch (e) {
    return null;
  }
}

function isGoogleMapsUrl(value = '') {
  try {
    const parsed = new URL(value);
    return parsed.hostname.includes('google.') && parsed.pathname.includes('/maps');
  } catch (_) {
    return String(value || '').toLowerCase().includes('google.com/maps');
  }
}

function isBlacklisted(url) {
  const blackList = [
    'google.com', 'bing.com', 'microsoft.com', 'facebook.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'twitter.com', 'x.com', 'tiktok.com', 'pinterest.com',
    'encontrabrasil.com', 'guiamais.com', 'telelistas.net', 'apontador.com.br',
    'doctoralia.com.br', 'boaconsulta.com', 'viva-real', 'zapimoveis', 'webmotors',
    'mercadolivre.com', 'olx.com', 'reclameaqui.com', 'g1.globo.com', 'wikipedia.org',
    'jusbrasil.com.br', 'yellowpages', 'paginas-amarelas', 'infobel.com',
    'habitissimo.com.br', 'getninjas.com.br', 'tripadvisor.com', 'guiadasemana.com.br',
    'veja.abril.com.br', 'exame.com', 'estadao.com.br', 'folha.uol.com.br',
    'infomoney.com.br', 'valor.globo.com', 'catracalivre.com.br', 'uol.com.br',
    'terra.com.br', 'ig.com.br', 'r7.com', 'gazetadopovo.com.br', 'metropoles.com',
    'cnnbrasil.com.br', 'bbc.com', 'elpais.com', 'noticias', 'portal', 'blog', 
    'agenda', 'evento', 'guia', 'directory', 'listagem', 'ranking', 'melhores'
  ];
  return blackList.some(d => url.includes(d));
}

function getRegionCoords(regiao) {
  const stateMap = {
    'AC': { latitude: -9.974, longitude: -67.807 }, 'ACRE': { latitude: -9.974, longitude: -67.807 },
    'AL': { latitude: -9.665, longitude: -35.735 }, 'ALAGOAS': { latitude: -9.665, longitude: -35.735 },
    'AP': { latitude: 0.034, longitude: -51.066 }, 'AMAPA': { latitude: 0.034, longitude: -51.066 }, 'AMAPÁ': { latitude: 0.034, longitude: -51.066 },
    'AM': { latitude: -3.118, longitude: -60.021 }, 'AMAZONAS': { latitude: -3.118, longitude: -60.021 },
    'BA': { latitude: -12.971, longitude: -38.510 }, 'BAHIA': { latitude: -12.971, longitude: -38.510 },
    'CE': { latitude: -3.717, longitude: -38.543 }, 'CEARA': { latitude: -3.717, longitude: -38.543 }, 'CEARÁ': { latitude: -3.717, longitude: -38.543 },
    'DF': { latitude: -15.779, longitude: -47.929 }, 'DISTRITO FEDERAL': { latitude: -15.779, longitude: -47.929 },
    'ES': { latitude: -20.315, longitude: -40.312 }, 'ESPIRITO SANTO': { latitude: -20.315, longitude: -40.312 }, 'ESPÍRITO SANTO': { latitude: -20.315, longitude: -40.312 },
    'GO': { latitude: -16.686, longitude: -49.264 }, 'GOIAS': { latitude: -16.686, longitude: -49.264 }, 'GOIÁS': { latitude: -16.686, longitude: -49.264 },
    'MA': { latitude: -2.530, longitude: -44.302 }, 'MARANHAO': { latitude: -2.530, longitude: -44.302 }, 'MARANHÃO': { latitude: -2.530, longitude: -44.302 },
    'MT': { latitude: -15.601, longitude: -56.097 }, 'MATO GROSSO': { latitude: -15.601, longitude: -56.097 },
    'MS': { latitude: -20.442, longitude: -54.646 }, 'MATO GROSSO DO SUL': { latitude: -20.442, longitude: -54.646 },
    'MG': { latitude: -19.921, longitude: -43.937 }, 'MINAS GERAIS': { latitude: -19.921, longitude: -43.937 },
    'PA': { latitude: -1.455, longitude: -48.490 }, 'PARA': { latitude: -1.455, longitude: -48.490 }, 'PARÁ': { latitude: -1.455, longitude: -48.490 },
    'PB': { latitude: -7.115, longitude: -34.863 }, 'PARAIBA': { latitude: -7.115, longitude: -34.863 }, 'PARAÍBA': { latitude: -7.115, longitude: -34.863 },
    'PR': { latitude: -25.429, longitude: -49.267 }, 'PARANA': { latitude: -25.429, longitude: -49.267 }, 'PARANÁ': { latitude: -25.429, longitude: -49.267 },
    'PE': { latitude: -8.054, longitude: -34.881 }, 'PERNAMBUCO': { latitude: -8.054, longitude: -34.881 },
    'PI': { latitude: -5.091, longitude: -42.803 }, 'PIAUI': { latitude: -5.091, longitude: -42.803 }, 'PIAUÍ': { latitude: -5.091, longitude: -42.803 },
    'RJ': { latitude: -22.906, longitude: -43.172 }, 'RIO DE JANEIRO': { latitude: -22.906, longitude: -43.172 },
    'RN': { latitude: -5.795, longitude: -35.209 }, 'RIO GRANDE DO NORTE': { latitude: -5.795, longitude: -35.209 },
    'RS': { latitude: -30.034, longitude: -51.217 }, 'RIO GRANDE DO SUL': { latitude: -30.034, longitude: -51.217 },
    'RO': { latitude: -8.761, longitude: -63.903 }, 'RONDONIA': { latitude: -8.761, longitude: -63.903 }, 'RONDÔNIA': { latitude: -8.761, longitude: -63.903 },
    'RR': { latitude: 2.823, longitude: -60.675 }, 'RORAIMA': { latitude: 2.823, longitude: -60.675 },
    'SC': { latitude: -27.594, longitude: -48.542 }, 'SANTA CATARINA': { latitude: -27.594, longitude: -48.542 },
    'SP': { latitude: -23.550, longitude: -46.633 }, 'SAO PAULO': { latitude: -23.550, longitude: -46.633 }, 'SÃO PAULO': { latitude: -23.550, longitude: -46.633 },
    'SE': { latitude: -10.911, longitude: -37.071 }, 'SERGIPE': { latitude: -10.911, longitude: -37.071 },
    'TO': { latitude: -10.167, longitude: -48.327 }, 'TOCANTINS': { latitude: -10.167, longitude: -48.327 }
  };
  const cityMap = {
    // Capitais e grandes cidades
    'SALVADOR': { latitude: -12.971, longitude: -38.510 },
    'FORTALEZA': { latitude: -3.717, longitude: -38.543 },
    'RECIFE': { latitude: -8.054, longitude: -34.881 },
    'BELEM': { latitude: -1.455, longitude: -48.490 }, 'BELÉM': { latitude: -1.455, longitude: -48.490 },
    'MANAUS': { latitude: -3.118, longitude: -60.021 },
    'CURITIBA': { latitude: -25.429, longitude: -49.267 },
    'PORTO ALEGRE': { latitude: -30.034, longitude: -51.217 },
    'FLORIANOPOLIS': { latitude: -27.594, longitude: -48.542 }, 'FLORIANÓPOLIS': { latitude: -27.594, longitude: -48.542 },
    'BELO HORIZONTE': { latitude: -19.921, longitude: -43.937 },
    'SAO PAULO': { latitude: -23.550, longitude: -46.633 }, 'SÃO PAULO': { latitude: -23.550, longitude: -46.633 },
    'RIO DE JANEIRO': { latitude: -22.906, longitude: -43.172 },
    'BRASILIA': { latitude: -15.779, longitude: -47.929 }, 'BRASÍLIA': { latitude: -15.779, longitude: -47.929 },
    'GOIANIA': { latitude: -16.686, longitude: -49.264 }, 'GOIÂNIA': { latitude: -16.686, longitude: -49.264 },
    'CAMPO GRANDE': { latitude: -20.442, longitude: -54.646 },
    'CUIABA': { latitude: -15.601, longitude: -56.097 }, 'CUIABÁ': { latitude: -15.601, longitude: -56.097 },
    'MACAPA': { latitude: 0.034, longitude: -51.066 }, 'MACAPÁ': { latitude: 0.034, longitude: -51.066 },
    'RIO BRANCO': { latitude: -9.974, longitude: -67.807 },
    'PORTO VELHO': { latitude: -8.761, longitude: -63.903 },
    'BOA VISTA': { latitude: 2.823, longitude: -60.675 },
    'MACEIO': { latitude: -9.665, longitude: -35.735 }, 'MACEIÓ': { latitude: -9.665, longitude: -35.735 },
    'JOAO PESSOA': { latitude: -7.115, longitude: -34.863 }, 'JOÃO PESSOA': { latitude: -7.115, longitude: -34.863 },
    'NATAL': { latitude: -5.795, longitude: -35.209 },
    'TERESINA': { latitude: -5.091, longitude: -42.803 },
    'SAO LUIS': { latitude: -2.530, longitude: -44.302 }, 'SÃO LUÍS': { latitude: -2.530, longitude: -44.302 },
    'VITORIA': { latitude: -20.315, longitude: -40.312 }, 'VITÓRIA': { latitude: -20.315, longitude: -40.312 },
    'ARACAJU': { latitude: -10.911, longitude: -37.071 },
    'PALMAS': { latitude: -10.167, longitude: -48.327 },
    // Cidades grandes não-capitais
    'CAMPINAS': { latitude: -22.905, longitude: -47.062 },
    'SANTOS': { latitude: -23.960, longitude: -46.333 },
    'RIBEIRAO PRETO': { latitude: -21.177, longitude: -47.810 }, 'RIBEIRÃO PRETO': { latitude: -21.177, longitude: -47.810 },
    'SAO JOSE DOS CAMPOS': { latitude: -23.178, longitude: -45.885 }, 'SÃO JOSÉ DOS CAMPOS': { latitude: -23.178, longitude: -45.885 },
    'SOROCABA': { latitude: -23.502, longitude: -47.458 },
    'OSASCO': { latitude: -23.533, longitude: -46.791 },
    'UBERLANDIA': { latitude: -18.918, longitude: -48.276 }, 'UBERLÂNDIA': { latitude: -18.918, longitude: -48.276 },
    'FEIRA DE SANTANA': { latitude: -12.255, longitude: -38.967 },
    'VITORIA DA CONQUISTA': { latitude: -14.863, longitude: -40.844 }, 'VITÓRIA DA CONQUISTA': { latitude: -14.863, longitude: -40.844 },
    'CARUARU': { latitude: -8.283, longitude: -35.976 },
    'PETROLINA': { latitude: -9.397, longitude: -40.501 },
    'JOINVILLE': { latitude: -26.303, longitude: -48.846 },
    'BLUMENAU': { latitude: -26.919, longitude: -49.066 },
    'LONDRINA': { latitude: -23.304, longitude: -51.169 },
    'MARINGA': { latitude: -23.425, longitude: -51.938 }, 'MARINGÁ': { latitude: -23.425, longitude: -51.938 },
    'CASCAVEL': { latitude: -24.958, longitude: -53.459 },
    'CAXIAS DO SUL': { latitude: -29.168, longitude: -51.179 },
    'PELOTAS': { latitude: -31.771, longitude: -52.342 },
    'JUIZ DE FORA': { latitude: -21.760, longitude: -43.350 },
    'CONTAGEM': { latitude: -19.931, longitude: -44.053 },
    'BETIM': { latitude: -19.967, longitude: -44.197 },
    'MONTES CLAROS': { latitude: -16.726, longitude: -43.862 },
    'ANAPOLIS': { latitude: -16.326, longitude: -48.953 }, 'ANÁPOLIS': { latitude: -16.326, longitude: -48.953 },
    'APARECIDA DE GOIANIA': { latitude: -16.823, longitude: -49.244 }, 'APARECIDA DE GOIÂNIA': { latitude: -16.823, longitude: -49.244 },
    'IMPERATRIZ': { latitude: -5.526, longitude: -47.491 },
    'SANTAREM': { latitude: -2.444, longitude: -54.708 }, 'SANTARÉM': { latitude: -2.444, longitude: -54.708 },
    'CARAPICUIBA': { latitude: -23.522, longitude: -46.835 }, 'CARAPICUÍBA': { latitude: -23.522, longitude: -46.835 },
    'GUARULHOS': { latitude: -23.463, longitude: -46.533 },
    'SAO BERNARDO DO CAMPO': { latitude: -23.692, longitude: -46.565 }, 'SÃO BERNARDO DO CAMPO': { latitude: -23.692, longitude: -46.565 },
    'SANTO ANDRE': { latitude: -23.664, longitude: -46.535 }, 'SANTO ANDRÉ': { latitude: -23.664, longitude: -46.535 },
    'MOGI DAS CRUZES': { latitude: -23.524, longitude: -46.185 },
    'DIADEMA': { latitude: -23.685, longitude: -46.621 },
    'NITEROI': { latitude: -22.883, longitude: -43.104 }, 'NITERÓI': { latitude: -22.883, longitude: -43.104 },
    'DUQUE DE CAXIAS': { latitude: -22.789, longitude: -43.311 },
    'NOVA IGUACU': { latitude: -22.758, longitude: -43.452 }, 'NOVA IGUAÇU': { latitude: -22.758, longitude: -43.452 },
    'SAO GONCALO': { latitude: -22.827, longitude: -43.053 }, 'SÃO GONÇALO': { latitude: -22.827, longitude: -43.053 },
  };

  const normalized = regiao.toUpperCase().trim();
  return stateMap[normalized] || cityMap[normalized] || null;
}

// T02 — Múltiplos nichos: aceita string "a, b, c" e roda sequencialmente
async function buscarLeadsMulti(nichoStr, regiao, onlyWithoutSite, captureOptions, onProgress) {
  const nichos = String(nichoStr || '').split(',').map(n => n.trim()).filter(Boolean);
  if (nichos.length <= 1) return buscarLeads(nichoStr, regiao, onlyWithoutSite, captureOptions, onProgress);
  const limit = captureOptions?.limit || 20;
  const perNicho = Math.max(1, Math.round(limit / nichos.length));
  let totalSaved = 0;
  let lastResult = null;
  for (let i = 0; i < nichos.length; i++) {
    if (_cancelFlag) break;
    const opts = { ...captureOptions, limit: perNicho };
    const wrapProgress = (p) => {
      if (typeof onProgress === 'function') {
        onProgress({ ...p, message: `[${i + 1}/${nichos.length}] ${nichos[i]}: ${p.message || ''}` });
      }
    };
    lastResult = await buscarLeads(nichos[i], regiao, onlyWithoutSite, opts, wrapProgress);
    totalSaved += lastResult?.count || 0;
  }
  return { ...(lastResult || {}), count: totalSaved, multiNicho: true };
}

// T04 — Inferir nicho pelo nome/categoria retornado do Google Maps
function inferNichoFromCategory(categoryStr) {
  const s = String(categoryStr || '').toLowerCase();
  const map = [
    [['dental', 'odont', 'dent'], 'odontologia'],
    [['clínica', 'clinica', 'médico', 'medico', 'hospital', 'saúde', 'saude'], 'saúde'],
    [['psico', 'tera'], 'psicologia'],
    [['fisio', 'reabilit'], 'fisioterapia'],
    [['nutri'], 'nutrição'],
    [['advog', 'juridico', 'jurídico', 'direito', 'advocaci'], 'advocacia'],
    [['contab', 'contábil', 'contador', 'fiscal'], 'contabilidade'],
    [['imóv', 'imov', 'imobili', 'corretor'], 'imóveis'],
    [['academia', 'ginástica', 'fitness', 'personal'], 'academia'],
    [['salão', 'salon', 'beleza', 'estética', 'estetica', 'cabeleir'], 'beleza'],
    [['restaurante', 'pizzar', 'lanchon', 'hambúrg', 'hamburgu'], 'alimentação'],
    [['escola', 'colégio', 'colegio', 'curso', 'educaç', 'educac'], 'educação'],
    [['hotel', 'pousada', 'hospedagem'], 'hospedagem'],
    [['mecânic', 'mecanic', 'auto', 'veículo', 'veiculo'], 'automotivo'],
    [['pet', 'animal', 'veterin'], 'veterinária'],
    [['farmácia', 'farmacia', 'droga'], 'farmácia'],
    [['advocaci', 'notarial', 'cartório', 'cartorio'], 'juridico'],
  ];
  for (const [keywords, nicho] of map) {
    if (keywords.some(k => s.includes(k))) return nicho;
  }
  return null;
}

module.exports = {
  buscarLeads,
  buscarLeadsMulti,
  cancelSearch,
  getNichoInfo,
  inferNichoFromCategory,
  __testing: {
    extractContactsFromText,
    resolveLeadContactSelection,
    isBrazilWhatsappPhone
  }
};
