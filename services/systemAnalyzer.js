const puppeteer = require('puppeteer');
const crud = require('./crud');
const { processHtmlAndGetScore } = require('./aiAnalyzer');
const { getBrowserPath } = require('./browserPath');
const { searchPatterns } = require('./contactExtractor');

const BLOCKED_DOMAINS = [
  'linkedin.', 'facebook.', 'instagram.', 'youtube.', 'tiktok.',
  'x.com/', 'twitter.com/', 'reclameaqui.', 'glassdoor.',
  'zhihu.', 'baidu.', 'csdn.', 'weixin.', 'qq.com', 'bilibili.',
  'microsoft.com/answers', 'answers.microsoft.', 'support.microsoft.',
  'community.', 'reddit.', 'quora.', 'bing.com/ck'
];

const DEFAULT_LIMIT = 50;

function emit(onProgress, payload) {
  if (typeof onProgress === 'function') {
    try { onProgress(payload); } catch (_) { /* silenciado: callback externo não deve interromper o analisador */ }
  }
}

function normalizeUrl(raw) {
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (url.hostname.includes('bing.com') && url.pathname.includes('/ck/')) {
      const encodedTarget = url.searchParams.get('u');
      if (encodedTarget) {
        let payload = encodedTarget;
        if (payload.startsWith('a1')) payload = payload.slice(2);
        try {
          const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          if (decoded.startsWith('http')) return normalizeUrl(decoded);
        } catch (_) { /* silenciado: falha no decode base64 do Bing redirect é esperada — retorna URL original */ }
      }
    }
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(key => url.searchParams.delete(key));
    return url.toString();
  } catch (_) {
    return raw;
  }
}

function hasCjkText(value = '') {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(String(value || ''));
}

function stripAccents(value = '') {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isBlockedUrl(url = '') {
  const lower = String(url || '').toLowerCase();
  const normalized = normalizeUrl(lower).toLowerCase();
  return !lower || BLOCKED_DOMAINS.some(domain => lower.includes(domain) || normalized.includes(domain));
}

function isLikelyArticleOrSupport(candidate = {}) {
  const signal = stripAccents([candidate.title, candidate.description, candidate.url].filter(Boolean).join(' '));
  const blockedTerms = [
    'como resolver', 'como corrigir', 'erro ', 'problema ', 'driver', 'windows',
    'tutorial', 'forum', 'pergunta', 'resposta', 'download gratis', 'crack',
    'github issue', 'stack overflow', 'introducao ', 'introdução ', 'exemplos',
    'entenda ', 'diferenca ', 'diferença ', 'o que e ', 'o que é ', 'guia ',
    'artigo', 'blog/', '/blog', 'wikipedia', 'medium.com', 'conceito',
    'definicao', 'definição', 'apostila', 'aula ', 'curso de'
  ];
  return blockedTerms.some(term => signal.includes(term));
}

function isRelevantWebSystemCandidate(candidate = {}, nicho = '') {
  const rawSignal = [candidate.title, candidate.description, candidate.url].filter(Boolean).join(' ');
  const signal = stripAccents(rawSignal);
  if (hasCjkText(rawSignal) || isBlockedUrl(candidate.url) || isLikelyArticleOrSupport(candidate)) return false;

  const productTerms = [
    'software', 'sistema', 'plataforma', 'app', 'aplicativo', 'saas',
    'gestao', 'solucao', 'erp', 'crm', 'automacao', 'dashboard',
    'produto', 'tecnologia'
  ];
  const nicheTokens = stripAccents(nicho).split(/\s+/).filter(token => token.length >= 4);
  const hasProductIntent = productTerms.some(term => signal.includes(term));
  const hasNicheMatch = nicheTokens.length === 0 || nicheTokens.some(token => signal.includes(token));
  return hasProductIntent && hasNicheMatch;
}

function isRelevantPlayStoreCandidate(candidate = {}, nicho = '') {
  const rawSignal = [candidate.title, candidate.description, candidate.url].filter(Boolean).join(' ');
  const signal = stripAccents(rawSignal);
  const titleSignal = stripAccents(candidate.title || '');
  if (hasCjkText(rawSignal) || isBlockedUrl(candidate.url)) return false;

  const nicheAllowsGames = /jogo|game|games/i.test(nicho);
  const gameTerms = [' game', 'jogo', 'jogos', 'simulador', 'tycoon', 'surgery game', 'hospital game', 'kids game'];
  if (!nicheAllowsGames && gameTerms.some(term => titleSignal.includes(term))) return false;

  const nicheTokens = stripAccents(nicho).split(/\s+/).filter(token => token.length >= 4);
  return nicheTokens.length === 0 || nicheTokens.some(token => signal.includes(token));
}

function isLeadMarketSafe(lead = {}, nicho = '') {
  const signal = [lead.nome, lead.descricao, lead.url, lead.app_store_url, lead.developer_name].filter(Boolean).join(' ');
  if (hasCjkText(signal) || isBlockedUrl(lead.url)) return false;
  if (lead.tipo_origem === 'play_store') {
    return isRelevantPlayStoreCandidate({ title: lead.nome, description: lead.descricao, url: lead.app_store_url }, nicho);
  }
  if (isLikelyArticleOrSupport({ title: lead.nome, description: lead.descricao, url: lead.url })) return false;
  return isRelevantWebSystemCandidate({ title: lead.nome, description: lead.descricao, url: lead.url }, nicho);
}

function safeJson(value, fallback = null) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch (_) {
    return JSON.stringify(fallback);
  }
}

function cleanText(value = '', max = 2200) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim()
    .slice(0, max);
}

function inferCategory({ nicho, title, description, url }) {
  const signal = [nicho, title, description, url].filter(Boolean).join(' ').toLowerCase();
  const rules = [
    { label: 'Saúde / Gestão Clínica', terms: ['clínica', 'clinica', 'medical', 'médic', 'saúde', 'agenda médica', 'prontuário'] },
    { label: 'Educação / Ensino', terms: ['escola', 'educa', 'curso', 'lms', 'aluno', 'ensino'] },
    { label: 'Vendas / CRM', terms: ['crm', 'vendas', 'pipeline', 'cliente', 'comercial'] },
    { label: 'Financeiro / ERP', terms: ['erp', 'financeiro', 'gestão', 'gestao', 'emissor', 'nota fiscal', 'contábil'] },
    { label: 'Delivery / Food', terms: ['delivery', 'restaurante', 'cardápio', 'pedido', 'food'] },
    { label: 'Imóveis / Real Estate', terms: ['imobili', 'imóvel', 'imoveis', 'corretor', 'condomínio'] },
    { label: 'RH / Pessoas', terms: ['rh', 'folha', 'ponto', 'recrutamento', 'benefícios'] },
    { label: 'E-commerce / Loja Virtual', terms: ['e-commerce', 'ecommerce', 'loja virtual', 'shop', 'checkout'] }
  ];
  return rules.find(rule => rule.terms.some(term => signal.includes(term)))?.label || nicho || 'Sistema / Aplicativo';
}

function buildSearchQueries(nicho, regiao, mode) {
  const base = cleanText(nicho, 80) || 'software';
  const place = regiao && regiao.toLowerCase() !== 'brasil' ? ` ${regiao}` : '';
  const webQueries = [
    `${base} software sistema${place}`,
    `${base} plataforma SaaS${place}`,
    `${base} app sistema gestão${place}`,
    `${base} solução digital${place}`,
    `"${base}" "software" "contato"`
  ];
  const playQueries = [
    `site:play.google.com/store/apps ${base} app`,
    `site:play.google.com/store/apps ${base} gestão`,
    `site:play.google.com/store/apps ${base} sistema`
  ];
  if (mode === 'web') return webQueries;
  if (mode === 'play_store') return playQueries;
  return [...webQueries, ...playQueries];
}

async function collectBingResults(page, query, maxResults = 12) {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});
  const results = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('li.b_algo, .b_algo'));
    return items.map(el => {
      const titleEl = el.querySelector('h2 a') || el.querySelector('a');
      const descEl = el.querySelector('.b_caption p') || el.querySelector('p');
      return {
        title: titleEl?.innerText || '',
        url: titleEl?.href || '',
        description: descEl?.innerText || ''
      };
    }).filter(item => item.url && item.title);
  });

  return results
    .map(item => ({ ...item, url: normalizeUrl(item.url) }))
    .filter(item => {
      const rawSignal = [item.title, item.description, item.url].join(' ');
      return !hasCjkText(rawSignal) && !isBlockedUrl(item.url);
    })
    .slice(0, maxResults);
}

async function collectPlayStoreResults(page, query, maxResults = 18) {
  const searchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=pt_BR&gl=BR`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 1200));
  const results = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/store/apps/details"]'));
    return links.map(link => {
      const href = link.href;
      const card = link.closest('[role="listitem"], .ULeU3b, .VfPpkd-WsjYwc, div') || link;
      const text = (card.innerText || link.innerText || '').split('\n').map(item => item.trim()).filter(Boolean);
      return {
        title: text[0] || link.getAttribute('aria-label') || 'App Android',
        url: href,
        description: text.slice(1, 4).join(' | ')
      };
    }).filter(item => item.url);
  });

  const unique = [];
  const seen = new Set();
  for (const result of results) {
    const packageId = parsePlayStorePackage(result.url);
    if (!packageId || seen.has(packageId)) continue;
    seen.add(packageId);
    unique.push({
      ...result,
      url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=pt_BR&gl=BR`,
      sourceHint: 'play_store'
    });
    if (unique.length >= maxResults) break;
  }
  return unique;
}

async function extractPageSignals(page) {
  const data = await page.evaluate(() => {
    const pick = (selector, attr = 'content') => document.querySelector(selector)?.getAttribute(attr) || '';
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: (a.innerText || a.getAttribute('aria-label') || a.getAttribute('title') || '').trim(),
      href: a.href
    })).slice(0, 120);
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(el => el.innerText.trim()).filter(Boolean).slice(0, 35);
    const buttons = Array.from(document.querySelectorAll('button,a')).map(el => el.innerText.trim()).filter(Boolean).filter(text => text.length <= 80).slice(0, 40);
    const images = Array.from(document.querySelectorAll('img[src]')).map(img => ({
      src: img.currentSrc || img.src,
      alt: img.alt || '',
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0
    })).filter(img => img.src).slice(0, 30);
    return {
      title: document.title || pick('meta[property="og:title"]'),
      description: pick('meta[name="description"]') || pick('meta[property="og:description"]'),
      ogImage: pick('meta[property="og:image"]'),
      text: document.body ? document.body.innerText : '',
      links,
      headings,
      buttons,
      images,
      html: document.documentElement ? document.documentElement.outerHTML : ''
    };
  });

  const contacts = searchPatterns(
    [
      data.text,
      data.links.map(link => `${link.text} ${link.href}`).join('\n')
    ].join('\n'),
    data.html
  );

  return {
    ...data,
    contacts,
    text: cleanText(data.text, 5000),
    description: cleanText(data.description, 800),
    title: cleanText(data.title, 180)
  };
}

async function extractWebSystem(page, candidate, context) {
  const url = normalizeUrl(candidate.url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});
  const signals = await extractPageSignals(page);
  const analysis = processHtmlAndGetScore(signals.html || '');
  const serviceTexts = [...signals.headings, ...signals.buttons]
    .filter(Boolean)
    .filter(text => text.length > 3)
    .slice(0, 18);
  const problems = [
    ...(analysis.issues || []),
    ...(signals.buttons.length < 2 ? ['Poucos CTAs claros para orientar o próximo passo comercial.'] : []),
    ...(signals.text.length < 900 ? ['Conteúdo comercial curto, com pouca profundidade para gerar confiança.'] : [])
  ].slice(0, 8);

  return {
    tipo_origem: 'web',
    nome: signals.title || candidate.title,
    url,
    app_store_url: null,
    package_id: null,
    descricao: signals.description || candidate.description || 'Sistema web identificado em busca pública.',
    score_ux: analysis.score || 50,
    problemas: problems,
    breakdown_score: analysis.details || {},
    developer_name: null,
    developer_email: signals.contacts.email || null,
    developer_site: url,
    privacy_policy_url: signals.links.find(link => /privacidade|privacy/i.test(link.text + link.href))?.href || null,
    app_category: inferCategory({ nicho: context.nicho, title: signals.title, description: signals.description, url }),
    rating: null,
    reviews_count: null,
    installs: null,
    last_update: null,
    icon_url: signals.ogImage || signals.images[0]?.src || null,
    screenshots: signals.images,
    features: serviceTexts,
    contacts: {
      emails: signals.contacts.emails || [],
      telefones: signals.contacts.telefones || [],
      links: signals.links.filter(link => /contato|contact|suporte|support|whatsapp|mailto|tel:/i.test(`${link.text} ${link.href}`)).slice(0, 20)
    },
    raw: {
      sourceTitle: candidate.title,
      sourceDescription: candidate.description,
      headings: signals.headings,
      ctas: signals.buttons
    },
    email: signals.contacts.email || null,
    telefone: signals.contacts.telefone || null,
    data_ultima_atualizacao: new Date().toISOString(),
    data_coleta: new Date().toISOString()
  };
}

function parsePlayStorePackage(url = '') {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('id') || '';
  } catch (_) {
    const match = String(url).match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }
}

function parseNumberText(value = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || null;
}

async function extractPlayStoreApp(page, candidate, context) {
  const appStoreUrl = normalizeUrl(candidate.url);
  await page.goto(appStoreUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('body', { timeout: 10000 }).catch(() => {});

  const data = await page.evaluate(() => {
    const meta = (selector, attr = 'content') => document.querySelector(selector)?.getAttribute(attr) || '';
    const text = document.body ? document.body.innerText : '';
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: (a.innerText || '').trim(), href: a.href })).slice(0, 160);
    const developerLink = document.querySelector('a[href*="/store/apps/dev"]');
    const categoryLink = Array.from(document.querySelectorAll('a[href*="/store/apps/category"]')).find(a => (a.innerText || '').trim());
    const images = Array.from(document.querySelectorAll('img[src]')).map(img => ({
      src: img.currentSrc || img.src,
      alt: img.alt || '',
      width: img.naturalWidth || img.width || 0,
      height: img.naturalHeight || img.height || 0
    })).filter(img => img.src).slice(0, 40);
    const h1 = document.querySelector('h1')?.innerText || '';
    return {
      title: h1 || meta('meta[property="og:title"]') || document.title,
      description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
      image: meta('meta[property="og:image"]'),
      locationHref: window.location.href,
      developer: developerLink ? developerLink.innerText.trim() : '',
      category: categoryLink ? categoryLink.innerText.trim() : '',
      text,
      links,
      images
    };
  });

  const validPlayPage = String(data.locationHref || '').includes('play.google.com/store/apps/details');
  const contacts = validPlayPage
    ? searchPatterns(`${data.text}\n${data.links.map(link => `${link.text} ${link.href}`).join('\n')}`, '')
    : { emails: [], telefones: [], email: null, telefone: null };
  const developerEmail = contacts.email;
  const developerSite = validPlayPage ? data.links.find(link => /site|website|desenvolvedor|developer/i.test(`${link.text} ${link.href}`) && !link.href.includes('play.google.com'))?.href || null : null;
  const privacyPolicy = validPlayPage ? data.links.find(link => /privacidade|privacy/i.test(`${link.text} ${link.href}`))?.href || null : null;
  const packageId = parsePlayStorePackage(appStoreUrl);
  const lines = data.text.split('\n').map(item => item.trim()).filter(Boolean);
  const developerName = validPlayPage ? (data.developer || lines.find((line, index) => index > 0 && line.length > 2 && line.length < 90 && !/jogos|cont.?m an.?ncios|compras no app|instalar|play protect/i.test(line)) || null) : null;
  const ratingLine = lines.find(line => /^\d[,.]\d/.test(line));
  const installsLine = lines.find(line => /\+/.test(line) && /(mil|mi|[0-9])/.test(line) && !/@/.test(line));
  const lastUpdateIndex = lines.findIndex(line => /Atualizado em|Última atualização|Last updated/i.test(line));
  const lastUpdate = lastUpdateIndex >= 0 ? lines[lastUpdateIndex + 1] : null;
  const features = lines
    .filter(line => line.length > 25 && line.length < 180)
    .filter(line => !/google play|política|privacidade|instalar|classificação/i.test(line))
    .slice(0, 12);

  const extractedTitle = validPlayPage && data.title && !/bing|google search|pesquisa/i.test(data.title) ? data.title : candidate.title;
  const appTitle = cleanText((extractedTitle || '').replace(/- Apps no Google Play|Apps on Google Play/gi, ''), 160);
  const rawCategory = validPlayPage ? data.category : '';
  const categoryLooksGeneric = /jogos|crian/i.test(stripAccents(rawCategory || '')) && !/jogo|game|crian/i.test(context.nicho || '');
  const resolvedCategory = categoryLooksGeneric ? '' : rawCategory;
  const problems = [
    developerSite ? null : 'App sem site do desenvolvedor evidente, reduzindo canais de confiança e conversão.',
    developerEmail ? null : 'E-mail de suporte não ficou evidente na página pública.',
    'A presença comercial pode ser fortalecida com landing page, prova social e demonstração do produto.'
  ].filter(Boolean);

  return {
    tipo_origem: 'play_store',
    nome: appTitle,
    url: developerSite || appStoreUrl,
    app_store_url: appStoreUrl,
    package_id: packageId,
    descricao: cleanText((validPlayPage ? data.description : '') || candidate.description || features[0] || 'Aplicativo identificado na Play Store.', 1200),
    score_ux: developerSite ? 70 : 58,
    problemas: problems,
    breakdown_score: {
      source: 'play_store',
      hasDeveloperSite: Boolean(developerSite),
      hasSupportEmail: Boolean(developerEmail),
      hasScreenshots: data.images.length > 0
    },
    developer_name: developerName,
    developer_email: developerEmail || null,
    developer_site: developerSite,
    privacy_policy_url: privacyPolicy,
    app_category: resolvedCategory || inferCategory({ nicho: context.nicho, title: appTitle, description: data.description, url: appStoreUrl }),
    rating: parseNumberText(ratingLine),
    reviews_count: null,
    installs: parseNumberText(installsLine),
    last_update: parseNumberText(lastUpdate),
    icon_url: data.image || data.images[0]?.src || null,
    screenshots: data.images,
    features,
    contacts: {
      emails: contacts.emails || [],
      telefones: contacts.telefones || [],
      links: data.links.filter(link => /mailto|tel:|whatsapp|suporte|support|contato|contact|privacy|privacidade/i.test(`${link.text} ${link.href}`)).slice(0, 20)
    },
    raw: {
      packageId,
      lines: lines.slice(0, 120),
      sourceTitle: candidate.title
    },
    email: developerEmail || null,
    telefone: contacts.telefone || null,
    data_ultima_atualizacao: new Date().toISOString(),
    data_coleta: new Date().toISOString()
  };
}

async function enrichDeveloperSite(page, lead) {
  if (!lead.developer_site || lead.developer_site.includes('play.google.com')) return lead;
  try {
    await page.goto(lead.developer_site, { waitUntil: 'domcontentloaded', timeout: 22000 });
    await page.waitForSelector('body', { timeout: 7000 }).catch(() => {});
    const signals = await extractPageSignals(page);
    const emails = [...new Set([...(lead.contacts?.emails || []), ...(signals.contacts.emails || [])])];
    const telefones = [...new Set([...(lead.contacts?.telefones || []), ...(signals.contacts.telefones || [])])];
    return {
      ...lead,
      email: lead.email || emails[0] || null,
      telefone: lead.telefone || telefones[0] || null,
      developer_email: lead.developer_email || emails[0] || null,
      contacts: {
        ...(lead.contacts || {}),
        emails,
        telefones,
        links: [...(lead.contacts?.links || []), ...signals.links.filter(link => /contato|contact|suporte|support|whatsapp|mailto|tel:/i.test(`${link.text} ${link.href}`)).slice(0, 10)]
      },
      features: [...new Set([...(lead.features || []), ...(signals.headings || [])])].slice(0, 18)
    };
  } catch (err) {
    return lead;
  }
}

async function searchAndAnalyzeSystems(params = {}, onProgress = null) {
  const nicho = typeof params === 'string' ? params : params.nicho;
  const regiao = typeof params === 'string' ? '' : params.regiao;
  const captureMode = typeof params === 'string' ? 'all' : (params.systemCaptureMode || params.captureMode || 'all');
  const limit = Math.min(Number(params.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT, DEFAULT_LIMIT);
  const requireEmail = typeof params === 'string' ? false : Boolean(params.requireEmail);
  const requireWhatsapp = typeof params === 'string' ? false : Boolean(params.requireWhatsapp);
  const executablePath = getBrowserPath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1366,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

    emit(onProgress, { phase: 'searching', percent: 5, message: 'Buscando sistemas web e apps da Play Store...', currentLead: '' });

    const queries = buildSearchQueries(nicho, regiao, captureMode);
    const candidates = [];
    const seenCandidateUrls = new Set();

    if (captureMode === 'all' || captureMode === 'play_store') {
      emit(onProgress, {
        phase: 'searching',
        percent: 7,
        message: 'Consultando busca pública da Play Store...',
        currentLead: nicho
      });
      try {
        const playResults = await collectPlayStoreResults(page, nicho, Math.min(120, Math.max(24, limit * 4)));
        for (const result of playResults) {
          const key = normalizeUrl(result.url).toLowerCase();
          if (!key || seenCandidateUrls.has(key) || !isRelevantPlayStoreCandidate(result, nicho)) continue;
          seenCandidateUrls.add(key);
          candidates.push(result);
        }
      } catch (err) {
        console.warn('[SystemAnalyzer] Falha na busca direta da Play Store:', err.message);
      }
    }

    for (let i = 0; i < queries.length; i++) {
      emit(onProgress, {
        phase: 'searching',
        percent: Math.min(35, 8 + Math.round((i / Math.max(queries.length, 1)) * 28)),
        message: `Pesquisando fonte ${i + 1}/${queries.length}`,
        currentLead: queries[i]
      });
      try {
        const results = await collectBingResults(page, queries[i], 14);
        for (const result of results) {
          const key = normalizeUrl(result.url).toLowerCase();
          const sourceHint = result.url.includes('play.google.com/store/apps') ? 'play_store' : 'web';
          const isRelevant = sourceHint === 'play_store'
            ? isRelevantPlayStoreCandidate(result, nicho)
            : isRelevantWebSystemCandidate(result, nicho);
          if (!key || seenCandidateUrls.has(key) || !isRelevant) continue;
          seenCandidateUrls.add(key);
          candidates.push({ ...result, sourceHint });
        }
      } catch (err) {
        console.warn('[SystemAnalyzer] Falha na busca:', err.message);
      }
      const candidateTarget = limit * (requireEmail || requireWhatsapp ? 12 : 5);
      if (candidates.length >= candidateTarget) break;
    }

    let savedCount = 0;
    let duplicateCount = 0;
    const capturados = [];
    const totalToInspect = candidates.length;

    for (let index = 0; index < candidates.length && savedCount < limit; index++) {
      const candidate = candidates[index];
      const isPlayStore = candidate.sourceHint === 'play_store' || candidate.url.includes('play.google.com/store/apps');
      emit(onProgress, {
        phase: 'extracting',
        percent: Math.min(92, 38 + Math.round(((index + 1) / Math.max(totalToInspect, 1)) * 54)),
        message: `Extraindo ${isPlayStore ? 'app' : 'sistema'} ${index + 1}/${totalToInspect} para salvar até ${limit} leads`,
        currentLead: candidate.title
      });

      try {
        let lead = isPlayStore
          ? await extractPlayStoreApp(page, candidate, { nicho, regiao })
          : await extractWebSystem(page, candidate, { nicho, regiao });
        lead = await enrichDeveloperSite(page, lead);
        if (!isLeadMarketSafe(lead, nicho)) {
          console.warn(`[SystemAnalyzer] Lead descartado por baixa relevância/idioma: ${lead.nome}`);
          continue;
        }

        const normalizeBrPhone = (value = '') => String(value || '').replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '');
        const hasEmail = Boolean(lead.email || lead.developer_email || lead.contacts?.emails?.length);
        const hasWhatsapp = [lead.telefone, ...(lead.contacts?.telefones || [])]
          .some(phone => /^\d{2}9\d{8}$/.test(normalizeBrPhone(phone)));
        if (requireEmail && !hasEmail) continue;
        if (requireWhatsapp && !hasWhatsapp) continue;

        const result = await crud.createLeadSistema({
          ...lead,
          problemas: safeJson(lead.problemas, []),
          breakdown_score: safeJson(lead.breakdown_score, {}),
          screenshots_json: safeJson(lead.screenshots, []),
          features_json: safeJson(lead.features, []),
          contacts_json: safeJson(lead.contacts, {}),
          raw_metadata_json: safeJson(lead.raw, {})
        });

        if (result.duplicate || result.changes === 0) {
          duplicateCount++;
          continue;
        }

        savedCount++;
        capturados.push({ ...lead, id: result.id });
      } catch (err) {
        console.warn(`[SystemAnalyzer] Falha ao extrair ${candidate.url}:`, err.message);
      }
    }

    emit(onProgress, {
      phase: 'done',
      percent: 100,
      message: `Captura concluída: ${savedCount} novos, ${duplicateCount} repetidos ignorados.`,
      currentLead: ''
    });

    return {
      success: true,
      count: savedCount,
      duplicates: duplicateCount,
      message: `Busca finalizada. ${savedCount} sistemas/apps novos salvos, ${duplicateCount} repetidos ignorados.`,
      capturados
    };
  } catch (error) {
    console.error('Falha severa na busca de Sistemas & Apps:', error);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

module.exports = {
  searchAndAnalyzeSystems
};
