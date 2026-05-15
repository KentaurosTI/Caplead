const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const puppeteer = require('puppeteer');

const crud = require('./crud');
const { getBrowserPath } = require('./browserPath');
const { buildGeminiLayoutStrategy } = require('./geminiLayoutAI');
const { normalizeUrl } = require('./prototypePipeline/utils');

function slugify(value) {
  return String(value || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'cliente';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function stableHash(value = '') {
  return String(value || '').split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function pickLayoutVariant(extractedData = {}, strategy = {}) {
  const signal = `${extractedData.companyName}|${extractedData.originalUrl}|${extractedData.niche}|${strategy.layoutFamily || ''}`;
  const family = String(strategy.layoutFamily || '').toLowerCase();
  const niche = String(extractedData.niche || '').toLowerCase();
  const variantsByFamily = {
    real_estate: ['property_search', 'marketplace_showcase', 'broker_premium'],
    healthcare: ['care_access', 'clinic_institutional', 'appointment_first'],
    legal: ['authority_editorial', 'consultative_split', 'trust_first'],
    beauty: ['visual_portfolio', 'premium_service', 'soft_editorial'],
    food: ['menu_spotlight', 'experience_first', 'delivery_cta'],
    education: ['program_catalog', 'learning_path', 'institutional_trust'],
    technology: ['saas_modern', 'solution_grid', 'case_study'],
    local_service: ['local_conversion', 'service_directory', 'quote_first'],
    corporate: ['corporate_modern', 'editorial_brand', 'conversion_grid']
  };
  const byNiche =
    /imobili|imovel|imóvel/.test(niche) ? variantsByFamily.real_estate :
    /clínica|clinica|saúde|saude|médic|medic|odont|fisio|psico/.test(niche) ? variantsByFamily.healthcare :
    /advoc|jur/.test(niche) ? variantsByFamily.legal :
    /beleza|estet|salão|salao|barbear/.test(niche) ? variantsByFamily.beauty :
    /restaurante|pizza|food|aliment/.test(niche) ? variantsByFamily.food :
    variantsByFamily[family] || variantsByFamily.corporate;
  return byNiche[Math.abs(stableHash(signal)) % byNiche.length];
}

function toAbsUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function isGoogleMapsUrl(value = '') {
  return /(^https?:\/\/)?(www\.)?(google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(value || ''));
}

function isUsableWebsiteUrl(value = '') {
  const normalized = normalizeUrl(value);
  if (!normalized || isGoogleMapsUrl(normalized)) return false;
  try {
    const host = new URL(normalized).hostname.replace(/^www\./, '');
    return !/(google|gstatic|googleusercontent|facebook|instagram|linkedin|youtube|wa\.me|whatsapp)\./i.test(host);
  } catch {
    return false;
  }
}

async function resolveOfficialWebsiteFromMaps(mapsUrl) {
  const url = normalizeUrl(mapsUrl);
  if (!url || !isGoogleMapsUrl(url)) return '';

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getBrowserPath() || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const candidates = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ href: a.href, text: (a.innerText || a.getAttribute('aria-label') || '').trim() }))
      .filter(item => item.href)
      .sort((a, b) => Number(/site|website|web/i.test(b.text + b.href)) - Number(/site|website|web/i.test(a.text + a.href)))
      .map(item => item.href));
    return candidates.find(isUsableWebsiteUrl) || '';
  } catch {
    return '';
  } finally {
    await browser.close();
  }
}

async function resolveLeadWebsiteUrl(lead) {
  const official = lead.site_oficial || lead.website || lead.site;
  if (isUsableWebsiteUrl(official)) return normalizeUrl(official);
  if (isUsableWebsiteUrl(lead.url)) return normalizeUrl(lead.url);
  if (isGoogleMapsUrl(lead.url)) {
    const resolved = await resolveOfficialWebsiteFromMaps(lead.url);
    if (resolved) return normalizeUrl(resolved);
  }
  return '';
}

function getLeadName(lead) {
  return lead?.nome || lead?.titulo || lead?.empresa || lead?.name || 'Cliente';
}

function inferNicheFromContent(lead, extracted = {}) {
  const signal = [
    lead?.categoria,
    lead?.nicho,
    lead?.titulo,
    lead?.descricao,
    extracted?.niche,
    ...(extracted?.texts || []),
    ...(extracted?.mainTitles || []),
    ...(extracted?.menus || [])
  ].join(' ').toLowerCase();

  if (/imobili|im[oó]vel|apartamento|casa |aluguel|loca[cç][aã]o|creci|corretor/.test(signal)) return 'Imobiliária / Imóveis';
  if (/advoc|jur[ií]dic|direito|processo|escrit[oó]rio/.test(signal)) return 'Advocacia / Jurídico';
  if (/sal[aã]o|beleza|est[eé]tica|cabelo|barbearia|spa/.test(signal)) return 'Estética e Beleza';
  if (/cl[ií]nica|m[eé]dic|odont|sa[uú]de|fisioterapia|psicolog/.test(signal)) return 'Saúde / Clínica';
  if (/restaurante|pizzaria|bar |lanchonete|delivery|card[aá]pio/.test(signal)) return 'Restaurante / Alimentação';
  if (/software|tecnologia|sistema|app |digital|ti /.test(signal)) return 'Tecnologia / Software';
  return 'Categoria pendente';
}

function getLeadNiche(lead, extracted) {
  return lead?.categoria || lead?.nicho || inferNicheFromContent(lead, extracted);
}

function inferCommunicationStyle(texts) {
  const sample = (texts || []).join(' ').toLowerCase();
  if (sample.includes('luxo') || sample.includes('premium') || sample.includes('exclusiv')) return 'premium e consultivo';
  if (sample.includes('promo') || sample.includes('oferta')) return 'direto e promocional';
  if (sample.includes('família') || sample.includes('cuidado')) return 'acolhedor e próximo';
  return 'institucional, objetivo e comercial';
}

async function downloadAsset(url, targetDir, prefix) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).split('?')[0] || '.jpg';
    const filePath = path.join(targetDir, `${prefix}-${Date.now()}${ext.slice(0, 8)}`);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        resolve(null);
        return;
      }
      const out = fs.createWriteStream(filePath);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(filePath)));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function captureLeadWebsite(lead, outputDirs) {
  const url = normalizeUrl(lead.url || lead.site_oficial);
  if (!url || isGoogleMapsUrl(url)) throw new Error('INVALID_URL');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getBrowserPath() || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
    if (response && !response.ok()) throw new Error('SITE_UNREACHABLE');
    await new Promise(resolve => setTimeout(resolve, 1200));

    const internalLinks = await page.evaluate(() => {
      const origin = window.location.origin;
      const priority = /sobre|servi|produto|imove|contato|quem|empresa|solu|blog|portfolio/i;
      return Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.innerText || a.textContent || '').trim() }))
        .filter(item => item.href && item.href.startsWith(origin) && !item.href.includes('#'))
        .sort((a, b) => Number(priority.test(b.href + b.text)) - Number(priority.test(a.href + a.text)))
        .map(item => item.href);
    });

    const urls = [...new Set([url, ...internalLinks])].slice(0, 8);
    const pages = [];

    for (let i = 0; i < urls.length; i += 1) {
      const current = urls[i];
      try {
        await page.goto(current, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise(resolve => setTimeout(resolve, 700));
        const screenshotPath = path.join(outputDirs.capture, `pagina-${i + 1}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: i === 0 });
        const data = await page.evaluate(() => {
          const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
          const abs = (v) => {
            try { return new URL(v, window.location.href).href; } catch { return ''; }
          };
          const colorScore = {};
          const fontScore = {};
          Array.from(document.querySelectorAll('*')).slice(0, 2500).forEach(el => {
            const s = getComputedStyle(el);
            [s.color, s.backgroundColor, s.borderColor].forEach(raw => {
              const m = String(raw || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
              if (m) {
                const hex = '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
                colorScore[hex] = (colorScore[hex] || 0) + 1;
              }
            });
            const font = clean(s.fontFamily).split(',')[0].replace(/^["']|["']$/g, '');
            if (font) fontScore[font] = (fontScore[font] || 0) + 1;
          });
          const getTexts = (selector, max) => Array.from(document.querySelectorAll(selector))
            .map(el => clean(el.innerText || el.textContent || el.value))
            .filter(Boolean)
            .slice(0, max);
          const bodyText = clean(document.body?.innerText || '');
          return {
            url: window.location.href,
            title: clean(document.title),
            metaDescription: clean(document.querySelector('meta[name="description"]')?.content),
            headings: getTexts('h1,h2,h3', 30),
            paragraphs: getTexts('p,li', 80).filter(t => t.length > 18),
            ctas: getTexts('button,a[role="button"],a[href],input[type="submit"]', 40).filter(t => t.length <= 70),
            menus: getTexts('nav a, header a', 30),
            footer: getTexts('footer, footer a, footer p', 30),
            images: [
              ...Array.from(document.querySelectorAll('img[src]')).map(img => ({
              src: abs(img.getAttribute('src') || img.currentSrc),
              alt: clean(img.alt),
              width: Number(img.naturalWidth || img.width || 0),
              height: Number(img.naturalHeight || img.height || 0)
              })),
              ...Array.from(document.querySelectorAll('*')).map(el => {
                const bg = getComputedStyle(el).backgroundImage || '';
                const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
                return match ? {
                  src: abs(match[1]),
                  alt: clean(el.getAttribute('aria-label') || el.textContent || 'Imagem de fundo'),
                  width: Number(el.clientWidth || 0),
                  height: Number(el.clientHeight || 0),
                  kind: 'background'
                } : null;
              }).filter(Boolean)
            ].filter(img => img.src && !img.src.startsWith('data:')).slice(0, 80),
            logos: Array.from(document.querySelectorAll("img[alt*='logo' i], img[src*='logo' i], header img, nav img, [class*='logo' i] img"))
              .map(img => abs(img.getAttribute('src') || img.currentSrc)).filter(Boolean).slice(0, 10),
            colors: Object.entries(colorScore).sort((a,b) => b[1] - a[1]).map(row => row[0]).slice(0, 10),
            fonts: Object.entries(fontScore).sort((a,b) => b[1] - a[1]).map(row => row[0]).slice(0, 8),
            contacts: {
              emails: [...new Set(bodyText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/ig) || [])],
              phones: [...new Set(bodyText.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-\s]?\d{4})/g) || [])],
              whatsapp: Array.from(document.querySelectorAll("a[href*='whatsapp' i], a[href*='wa.me']")).map(a => a.href).slice(0, 8)
            },
            bodyText: bodyText.slice(0, 12000)
          };
        });
        pages.push({ ...data, screenshotPath });
      } catch (err) {
        pages.push({ url: current, error: err.message });
      }
    }

    return { originalUrl: url, pages };
  } finally {
    await browser.close();
  }
}

function extractWebsiteData(lead, capture) {
  const validPages = capture.pages.filter(p => !p.error);
  const flat = (key) => [...new Set(validPages.flatMap(p => p[key] || []))].filter(Boolean);
  const allImages = validPages.flatMap(p => p.images || []);
  const logos = flat('logos');
  const texts = [...new Set(validPages.flatMap(p => [...(p.headings || []), ...(p.paragraphs || [])]))].slice(0, 140);
  const companyName = getLeadName(lead);
  return {
    companyName,
    originalUrl: capture.originalUrl,
    niche: getLeadNiche(lead, {}),
    visualIdentity: {
      logo: logos[0] || '',
      logos,
      colors: flat('colors').slice(0, 10),
      fonts: flat('fonts').slice(0, 8),
      communicationStyle: inferCommunicationStyle(texts),
      currentStructure: validPages.map(p => ({ url: p.url, title: p.title, headings: p.headings || [] }))
    },
    texts,
    mainTitles: flat('headings').slice(0, 30),
    ctas: flat('ctas').slice(0, 20),
    menus: flat('menus').slice(0, 30),
    footer: flat('footer').slice(0, 30),
    contacts: {
      emails: [...new Set(validPages.flatMap(p => p.contacts?.emails || []))],
      phones: [...new Set(validPages.flatMap(p => p.contacts?.phones || []))],
      whatsapp: [...new Set(validPages.flatMap(p => p.contacts?.whatsapp || []))]
    },
    servicesOrProducts: texts.filter(t => /servi|produto|im[oó]vel|solu|atendimento|consult|venda|loca/i.test(t)).slice(0, 16),
    socialProof: texts.filter(t => /cliente|depoimento|avalia|anos|experi|confian|qualidade/i.test(t)).slice(0, 12),
    images: allImages.slice(0, 50),
    pagesAnalyzed: validPages.map(p => ({ url: p.url, title: p.title, screenshotPath: p.screenshotPath })),
    missingData: {
      logo: logos.length === 0,
      colors: flat('colors').length === 0,
      texts: texts.length < 5,
      images: allImages.length === 0
    }
  };
}

function analyzeWebsiteProblems(extracted) {
  const problems = [];
  const opportunities = [];
  const colors = extracted.visualIdentity.colors || [];
  const ctas = extracted.ctas || [];
  const pages = extracted.pagesAnalyzed || [];
  const texts = extracted.texts || [];
  const images = extracted.images || [];

  if (ctas.length < 2) problems.push({ type: 'cta', severity: 'alta', message: 'CTAs pouco evidentes ou insuficientes para conduzir o visitante ao contato.' });
  if (pages.length <= 1) problems.push({ type: 'navegacao', severity: 'media', message: 'Poucas páginas internas foram identificadas, reduzindo profundidade comercial.' });
  if (colors.length < 2) problems.push({ type: 'identidade', severity: 'media', message: 'Paleta visual pouco clara, dificultando consistência de marca.' });
  if (texts.length < 10) problems.push({ type: 'conteudo', severity: 'media', message: 'Conteúdo capturado parece limitado para sustentar confiança e diferenciais.' });
  if (images.length < 2) problems.push({ type: 'visual', severity: 'media', message: 'Poucas imagens úteis foram encontradas para apoiar percepção profissional.' });
  if (!extracted.socialProof.length) problems.push({ type: 'confianca', severity: 'alta', message: 'Provas sociais ou sinais de confiança não aparecem de forma forte.' });
  if (!extracted.contacts.emails.length && !extracted.contacts.phones.length && !extracted.contacts.whatsapp.length) {
    problems.push({ type: 'contato', severity: 'alta', message: 'Informações de contato não estão claras o suficiente.' });
  }
  if (!problems.length) {
    problems.push(
      { type: 'modernizacao', severity: 'media', message: 'O site possui uma base aproveitável, mas ainda pode ganhar hierarquia visual mais forte e apresentação mais comercial.' },
      { type: 'conversao', severity: 'media', message: 'Há oportunidade de tornar as chamadas para contato mais evidentes e recorrentes.' }
    );
  }

  opportunities.push(
    { area: 'hero', suggestion: 'Criar hero section forte com proposta de valor, imagem/identidade da marca e CTA direto.' },
    { area: 'serviços', suggestion: 'Organizar serviços/produtos em cards escaneáveis e orientados a decisão.' },
    { area: 'conversão', suggestion: 'Repetir CTAs em pontos estratégicos e facilitar contato por telefone, WhatsApp ou formulário.' },
    { area: 'confiança', suggestion: 'Adicionar diferenciais, prova social e argumentos de autoridade sem inventar dados críticos.' },
    { area: 'mobile', suggestion: 'Aplicar grid responsivo, botões maiores, contraste correto e leitura rápida no celular.' }
  );

  return {
    score: Math.max(25, 88 - problems.length * 8),
    problems,
    opportunities,
    modernizationProposal: 'Modernizar a experiência mantendo DNA visual, textos reais e elementos de marca, com foco em clareza, confiança e conversão.',
    newLayoutGoal: 'Gerar uma proposta visual apresentável ao cliente, evidenciando como o site pode parecer mais profissional e converter melhor.'
  };
}

function buildPrototypePrompt(structured) {
  const d = structured.extractedData;
  const a = structured.analysis;
  const list = (items, mapper = x => x) => (items || []).slice(0, 12).map(item => `- ${mapper(item)}`).join('\n') || '- Pendente';
  return `# Protótipo modernizado para ${d.companyName}

## Contexto
Criar uma versão modernizada do site original do lead, mantendo identidade visual, linguagem, textos reais, logo e imagens sempre que possível. O resultado deve parecer uma proposta comercial real, pronta para apresentação ao cliente, demonstrando melhoria clara de profissionalismo, conversão e experiência.

## Dados extraídos
- URL original: ${d.originalUrl}
- Nome da empresa: ${d.companyName}
- Nicho: ${d.niche}
- Cores principais: ${(d.visualIdentity.colors || []).join(', ') || 'Pendente'}
- Fontes aproximadas: ${(d.visualIdentity.fonts || []).join(', ') || 'Pendente'}
- Estilo visual atual: ${d.visualIdentity.communicationStyle}

### Textos principais
${list(d.texts)}

### Serviços/produtos
${list(d.servicesOrProducts)}

### CTAs encontrados
${list(d.ctas)}

### Imagens/logos disponíveis
${list([...(d.visualIdentity.logos || []), ...(d.images || []).map(img => img.src)], x => x)}

### Páginas analisadas
${list(d.pagesAnalyzed, p => `${p.title || 'Sem título'} — ${p.url}`)}

## Problemas identificados
${list(a.problems, p => `[${p.severity}] ${p.message}`)}

## Direção criativa
- Visual mais moderno, limpo e comercial.
- Hero section forte, com proposta de valor clara e CTA acima da dobra.
- Menu moderno e simples.
- Cards de serviços/produtos com leitura rápida.
- Área de benefícios e diferenciais.
- Prova social ou placeholder profissional identificado como pendente.
- Área institucional com textos reais capturados.
- Contato facilitado e CTA recorrente.
- Rodapé completo.
- Responsividade desktop/mobile.
- Uso correto de espaçamento, contraste, grids e tipografia.
- Preservar logo, cores, imagens e linguagem sempre que possível.

## Regras obrigatórias
- Não inventar informações críticas.
- Não trocar a identidade da marca.
- Não substituir textos reais por textos genéricos.
- Não criar um layout pobre ou amador.
- Não entregar apenas uma variação visual simples.
- O protótipo precisa parecer uma proposta comercial real.
- O novo layout deve ser claramente melhor que o site original.
- Preservar logo, cores, imagens e linguagem sempre que possível.
- Caso alguma informação esteja ausente, criar placeholder profissional identificado como pendente.`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isNeutralColor(color = '') {
  const c = String(color).toLowerCase();
  return ['#ffffff', '#fff', '#000000', '#000', '#f6f6f6', '#f7f7f7', '#f8f8f8', '#212529', '#1d1d1d', '#ced4da', '#a1a6bb'].includes(c);
}

function colorSaturation(color = '') {
  const match = String(color).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return 0;
  const [r, g, b] = match.slice(1).map(v => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function pickBrandColors(colors = []) {
  const useful = colors.filter(color => /^#[0-9a-f]{6}$/i.test(color) && !isNeutralColor(color) && colorSaturation(color) > 0.22);
  const brandPrimary = useful.find(color => /#(b9|c|d|e|f|00|14|07)/i.test(color)) || useful[0];
  const brandAccent = useful.find(color => color !== brandPrimary);
  const brandDark = colors.find(color => ['#1d1d1d', '#212529', '#202020', '#222222', '#2e2e2e'].includes(String(color).toLowerCase()));
  return {
    primary: brandPrimary || '#b90000',
    accent: brandAccent || '#1d1d1d',
    dark: brandDark || brandAccent || '#172033',
    light: '#ffffff'
  };
}

function hasRealEstateContent(extractedData) {
  const signal = [
    extractedData.niche,
    extractedData.companyName,
    ...(extractedData.mainTitles || []),
    ...(extractedData.servicesOrProducts || []),
    ...(extractedData.menus || [])
  ].join(' ').toLowerCase();
  return /imobili|im[oó]vel|apartamento|casa |aluguel|loca[cç][aã]o|comprar|creci/.test(signal);
}

function hasHealthcareContent(extractedData) {
  const signal = [
    extractedData.niche,
    extractedData.companyName,
    ...(extractedData.mainTitles || []),
    ...(extractedData.servicesOrProducts || []),
    ...(extractedData.menus || []),
    ...(extractedData.texts || []).slice(0, 40)
  ].join(' ').toLowerCase();
  return /cl[ií]nica|sa[uú]de|m[eé]dic|consulta|exame|fisioterapia|psicologia|cardiologia|dermatologia|ortopedia|trabalho|aso|conv[eê]nio/.test(signal);
}

function pickUsableImage(images = [], options = {}) {
  const minWidth = options.minWidth || 180;
  const minHeight = options.minHeight || 120;
  const block = /icon|logo|favorito|menu|whatsapp|email|phone|facebook|instagram|youtube|linkedin|svg|pixel\.wp|g\.gif/i;
  return (images || []).find(img => {
    const src = img?.src || '';
    const alt = img?.alt || '';
    const width = Number(img.width || 0);
    const height = Number(img.height || 0);
    if (!src || block.test(src) || block.test(alt)) return false;
    if (width === height && width <= 260 && img.kind !== 'background') return false;
    if (options.avoidTextBanners && (width / Math.max(height, 1) > 2.4 || /banner|reajuste|fibromialgia|consulta|whatsapp|mapa|map/i.test(src + alt))) return false;
    return width >= minWidth && height >= minHeight;
  })?.src || '';
}

function pickLogo(extractedData) {
  const candidates = [
    ...(extractedData.visualIdentity?.logos || []),
    ...(extractedData.images || []).map(img => img.src)
  ].filter(Boolean);
  const bad = /banner|fibromialgia|reajuste|consulta|whatsapp|pixel\.wp|g\.gif|mapa|map/i;
  return candidates.find(src => /logo|cropped/i.test(src) && !bad.test(src))
    || candidates.find(src => !bad.test(src) && !/svg|icon/i.test(src))
    || '';
}

function healthcareHeroSvg(primary, accent, companyName) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 780">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="#eaf6ff"/></linearGradient>
    <radialGradient id="r" cx=".78" cy=".36" r=".45"><stop offset="0" stop-color="#ffffff" stop-opacity=".88"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1440" height="780" fill="url(#g)"/>
  <circle cx="1160" cy="180" r="310" fill="url(#r)"/>
  <path d="M980 170c100 18 178 100 190 204 14 128-78 242-207 255-129 14-244-80-258-208-13-126 76-238 198-255" fill="#fff" opacity=".16"/>
  <rect x="885" y="245" width="250" height="280" rx="42" fill="#fff" opacity=".82"/>
  <rect x="982" y="292" width="56" height="186" rx="14" fill="${primary}"/>
  <rect x="917" y="357" width="186" height="56" rx="14" fill="${primary}"/>
  <path d="M90 620c150-145 312-190 486-135 150 47 273 31 370-49 75-62 158-80 249-52 69 21 122 16 158-15v411H0V707c28-20 58-49 90-87Z" fill="#fff" opacity=".18"/>
  <circle cx="118" cy="205" r="10" fill="${accent}" opacity=".9"/><circle cx="166" cy="205" r="10" fill="#fff" opacity=".5"/><circle cx="214" cy="205" r="10" fill="#fff" opacity=".35"/>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function extractRealEstateListings(extractedData) {
  const titleRegex = /(apartamento|casa|cobertura|loja|sala|lote|andar|pr[eé]dio|[aá]rea privativa).{0,90}(venda|alugar|aluguel|loca[cç][aã]o|no |na )/i;
  const titles = [...new Set([...(extractedData.mainTitles || []), ...(extractedData.servicesOrProducts || [])])]
    .filter(text => titleRegex.test(text))
    .slice(0, 6);
  const images = (extractedData.images || []).filter(img => pickUsableImage([img], { minWidth: 160, minHeight: 140 }));
  const fallbackTitles = [
    'Imóvel em destaque com atendimento consultivo',
    'Apartamento selecionado para compra ou locação',
    'Oportunidade em Belo Horizonte'
  ];
  return (titles.length ? titles : fallbackTitles).slice(0, 6).map((title, idx) => ({
    title,
    image: images[idx]?.src || images[idx % Math.max(images.length, 1)]?.src || '',
    location: /belo horizonte|bh/i.test(title) ? 'Belo Horizonte' : 'Belo Horizonte e região',
    tag: /alug|loca/i.test(title) ? 'ALUGUEL' : /lan[cç]/i.test(title) ? 'LANÇAMENTO' : 'COMPRA',
    price: idx % 3 === 0 ? 'Valor sob consulta' : idx % 3 === 1 ? 'Condição personalizada' : 'Atendimento especializado',
    meta: idx % 2 === 0 ? 'Perfil completo do imóvel' : 'Informações organizadas para decisão'
  }));
}

function localCaptureRef(extractedData) {
  const shot = extractedData.pagesAnalyzed?.[0]?.screenshotPath;
  if (!shot) return '';
  return path.relative(path.join(path.dirname(shot), '..', 'layout-gerado'), shot).replace(/\\/g, '/');
}

function formatContact(value = '') {
  const raw = String(value || '');
  if (/whatsapp|wa\.me|api\.whatsapp/i.test(raw)) {
    const phone = raw.match(/phone=(\d+)/i)?.[1] || raw.match(/wa\.me\/(\d+)/i)?.[1] || '';
    return phone ? `WhatsApp +${phone.replace(/^55/, '55 ')}` : 'WhatsApp ativo';
  }
  return raw;
}

function firstTextMatching(extractedData, regex, fallback = '') {
  return (extractedData.texts || []).find(t => regex.test(t) && t.length > 8) || fallback;
}

function firstLongTextMatching(extractedData, regex, fallback = '', minLength = 80) {
  return (extractedData.texts || []).find(t => regex.test(t) && t.length >= minLength) || fallback;
}

function cleanBusinessText(text = '', max = 220) {
  return cleanText(text)
    .replace(/Já tem uma conta do WordPress\.com\?.*/i, '')
    .replace(/COMPARTILHE ISSO:.*/i, '')
    .slice(0, max)
    .trim();
}

function buildProfessionalFallbackLayout(extractedData, analysis) {
  return buildSiteLikeImprovedLayout(extractedData, analysis);
}

function isValidHex(color = '') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '').trim());
}

function colorsFromStrategy(strategy, extractedData) {
  const picked = (strategy?.brandColors || []).filter(isValidHex);
  return pickBrandColors([...picked, ...(extractedData.visualIdentity.colors || [])]);
}

function pickStrategyHeroImage(strategy, extractedData) {
  const approved = (strategy?.approvedAssets || []).filter(Boolean);
  const images = extractedData.images || [];
  const approvedImage = images.find(img => approved.includes(img.src) && pickUsableImage([img], { minWidth: 320, minHeight: 180, avoidTextBanners: true }));
  if (approvedImage) return approvedImage.src;
  return pickUsableImage(images, { minWidth: 420, minHeight: 240, avoidTextBanners: true }) || localCaptureRef(extractedData);
}

function renderStrategyCards(section) {
  return (section.cards || []).map(card => `<article class="ai-card"><b>${escapeHtml(card.title)}</b><p>${escapeHtml(card.description)}</p>${card.cta ? `<span>${escapeHtml(card.cta)}</span>` : ''}</article>`).join('');
}

function buildAIDirectedLayout(extractedData, analysis, strategy) {
  const brand = colorsFromStrategy(strategy, extractedData);
  const logo = pickLogo(extractedData) || extractedData.visualIdentity.logo;
  const heroImage = pickStrategyHeroImage(strategy, extractedData);
  const contact = extractedData.contacts.whatsapp[0] || extractedData.contacts.phones[0] || extractedData.contacts.emails[0] || '';
  const contactLabel = formatContact(contact) || strategy.contactBlock?.text || 'Contato pelo canal principal';
  const family = strategy.layoutFamily || 'corporate';
  const variant = strategy.layoutVariant || pickLayoutVariant(extractedData, strategy);
  const navItems = (strategy.navigation?.length ? strategy.navigation : extractedData.menus || [])
    .filter(item => !/pontos corrigidos|problemas|diagnostico|diagn[oó]stico/i.test(item))
    .slice(0, 6);
  const nav = (navItems.length ? navItems : ['Inicio', 'Servicos', 'Contato'])
    .map(item => `<a href="#${slugify(item)}">${escapeHtml(item)}</a>`).join('');
  const sectionOrder = variant.includes('trust') ? ['trust', 'featured', 'split', 'cards', 'steps'] :
    variant.includes('quote') || variant.includes('appointment') ? ['contact', 'split', 'cards', 'trust', 'featured'] :
    variant.includes('catalog') || variant.includes('directory') ? ['cards', 'steps', 'featured', 'split', 'trust'] :
    ['featured', 'cards', 'split', 'trust', 'steps'];
  const orderedSections = (strategy.sections || [])
    .map((section, idx) => ({ ...section, originalIndex: idx }))
    .sort((a, b) => sectionOrder.indexOf(a.style) - sectionOrder.indexOf(b.style));
  const sections = orderedSections.slice(0, 5).map((section, idx) => {
    const style = ['split', 'featured', 'trust', 'steps', 'contact'].includes(section.style) ? section.style : 'cards';
    return `<section class="ai-section section-${style}" id="${escapeHtml(section.id || `secao-${idx + 1}`)}"><div class="wrap"><div class="ai-title"><span>${escapeHtml(strategy.niche || extractedData.niche)}</span><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.intro)}</p></div><div class="ai-grid">${renderStrategyCards(section)}</div></div></section>`;
  }).join('');
  const heroCopy = `<div class="hero-copy"><span class="kicker">${escapeHtml(strategy.niche || extractedData.niche)}</span><h1>${escapeHtml(strategy.hero.headline)}</h1><p>${escapeHtml(strategy.hero.subheadline)}</p><div class="hero-actions"><a class="hero-cta" href="#contato">${escapeHtml(strategy.hero.ctaLabel)}</a>${strategy.hero.secondaryCtaLabel ? `<a class="hero-secondary" href="#${escapeHtml(sections ? 'contato' : '')}">${escapeHtml(strategy.hero.secondaryCtaLabel)}</a>` : ''}</div></div>`;
  const heroMedia = `<div class="hero-media">${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="${escapeHtml(extractedData.companyName)}">` : `<div class="fallback">${escapeHtml(extractedData.companyName.slice(0,2).toUpperCase())}</div>`}</div>`;
  const heroInner = variant.includes('image') || variant.includes('visual') || variant.includes('marketplace')
    ? `${heroMedia}${heroCopy}`
    : `${heroCopy}${heroMedia}`;

  const css = `
:root{--primary:${brand.primary};--accent:${brand.accent};--dark:${brand.dark};--ink:#111827;--muted:#5b6678;--line:#e6ebf2;--bg:#f7f8fb;--card:#fff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}a{text-decoration:none;color:inherit}.wrap{width:min(1180px,92vw);margin:auto}
.topbar{background:var(--dark);color:#fff;font-weight:800;font-size:13px}.topbar .wrap{height:40px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}.nav .wrap{height:82px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:14px;font-weight:900}.brand img{max-width:190px;max-height:56px;object-fit:contain}.brand-mark{width:52px;height:52px;border-radius:14px;background:var(--primary);color:#fff;display:grid;place-items:center}.links{display:flex;gap:22px;font-size:13px;font-weight:900;text-transform:uppercase;color:var(--primary)}.nav-cta,.hero-cta,.contact a{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;background:var(--primary);color:#fff;font-weight:900;padding:14px 18px;box-shadow:0 16px 34px color-mix(in srgb,var(--primary) 25%,transparent)}.hero-actions{display:flex;gap:12px;flex-wrap:wrap}.hero-secondary{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid var(--line);color:var(--primary);font-weight:900;padding:14px 18px;background:#fff}
.hero{position:relative;overflow:hidden;background:#fff}.hero .wrap{min-height:620px;display:grid;grid-template-columns:1fr 1fr;gap:52px;align-items:center}.hero-copy{position:relative;z-index:2}.kicker{display:inline-flex;color:var(--primary);font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px}.hero h1{font-size:clamp(40px,5vw,70px);line-height:1;margin:0 0 20px;letter-spacing:-.03em}.hero p{font-size:19px;color:var(--muted);max-width:650px;margin:0 0 28px}.hero-media{height:440px;border-radius:30px;overflow:hidden;background:linear-gradient(135deg,var(--primary),var(--dark));box-shadow:0 28px 70px rgba(17,24,39,.18)}.hero-media img{width:100%;height:100%;object-fit:cover}.hero-media .fallback{height:100%;display:grid;place-items:center;color:#fff;font-size:42px;font-weight:900}
.ai-section{padding:70px 0}.ai-title{max-width:760px;margin:0 0 32px}.ai-title span{color:var(--primary);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.ai-title h2{font-size:clamp(30px,3.5vw,46px);line-height:1.05;margin:10px 0 12px}.ai-title p{color:var(--muted);margin:0}.ai-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.ai-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:0 18px 42px rgba(17,24,39,.07)}.ai-card b{display:block;font-size:20px;line-height:1.15;margin-bottom:10px}.ai-card p{color:#536174;margin:0}.ai-card span{display:inline-flex;margin-top:18px;color:var(--primary);font-weight:900}
.section-split .ai-grid{grid-template-columns:1fr 1fr}.section-featured{background:color-mix(in srgb,var(--primary) 6%,#fff)}.section-trust .ai-card{border-left:5px solid var(--primary)}.section-steps .ai-card{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start}.section-steps .ai-card:before{content:counter(step);counter-increment:step;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--primary);color:#fff;font-weight:900}.section-steps .ai-grid{counter-reset:step}.section-contact .ai-grid{grid-template-columns:1.2fr .8fr}.variant-appointment_first .hero .wrap,.variant-quote_first .hero .wrap{grid-template-columns:.9fr 1.1fr}.variant-appointment_first .hero-copy,.variant-quote_first .hero-copy{background:#fff;border:1px solid var(--line);border-radius:28px;padding:34px;box-shadow:0 24px 62px rgba(17,24,39,.12)}.variant-visual_portfolio .hero-media,.variant-marketplace_showcase .hero-media{border-radius:160px 30px 160px 30px}.variant-authority_editorial .hero .wrap,.variant-editorial_brand .hero .wrap{grid-template-columns:1fr}.variant-authority_editorial .hero-media,.variant-editorial_brand .hero-media{height:320px}.variant-service_directory .ai-grid,.variant-program_catalog .ai-grid{grid-template-columns:repeat(4,1fr)}.variant-saas_modern .hero,.variant-solution_grid .hero{background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--primary) 10%,#fff))}
.contact{padding:72px 0}.contact-box{border-radius:28px;background:linear-gradient(135deg,var(--primary),var(--dark));color:#fff;padding:44px;display:flex;justify-content:space-between;gap:28px;align-items:center}.contact h2{font-size:34px;margin:0 0 8px}.contact p{margin:0;color:#f4f7fb}.contact a{background:#fff;color:var(--primary);box-shadow:none}.footer{background:var(--dark);color:#fff;padding:48px 0 28px}.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:34px}.footer img{max-width:170px;max-height:58px;object-fit:contain;margin-bottom:16px}.footer p,.footer li{color:#e5e7eb}.footer ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}.copy{border-top:1px solid rgba(255,255,255,.18);margin-top:30px;padding-top:20px;font-weight:800;font-size:13px}
body.family-real_estate .hero .wrap{grid-template-columns:1.08fr .92fr}body.family-healthcare{--bg:#f5faff}body.family-healthcare .hero-media{border-radius:34px 34px 120px 34px}body.family-legal .hero{background:#fbfaf7}body.family-beauty .hero-media{border-radius:160px 30px 160px 30px}body.family-food .ai-card{border-radius:28px}body.family-technology .hero{background:linear-gradient(135deg,#fff,color-mix(in srgb,var(--primary) 8%,#fff))}
@media(max-width:900px){.links{display:none}.hero .wrap,.ai-grid,.section-split .ai-grid,.footer-grid{grid-template-columns:1fr}.hero .wrap{min-height:auto;padding:52px 0}.hero-media{height:300px}.contact-box{flex-direction:column;align-items:flex-start}.nav .wrap{height:74px}.brand img{max-width:160px}}
`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(strategy.companyName || extractedData.companyName)}</title><link rel="stylesheet" href="./style.css"/></head><body class="family-${escapeHtml(family)} variant-${escapeHtml(variant)}">
<div class="topbar"><div class="wrap"><span>${escapeHtml(strategy.tone || 'Atendimento profissional')}</span><span>${escapeHtml(contactLabel)}</span></div></div>
<header class="nav"><div class="wrap"><div class="brand">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(extractedData.companyName)}">` : `<span class="brand-mark">${escapeHtml(extractedData.companyName.slice(0,2).toUpperCase())}</span>`}</div><nav class="links">${nav}</nav><a class="nav-cta" href="#contato">${escapeHtml(strategy.hero.ctaLabel)}</a></div></header>
<main><section class="hero"><div class="wrap">${heroInner}</div></section>
${sections}
<section class="contact" id="contato"><div class="wrap contact-box"><div><h2>${escapeHtml(strategy.contactBlock.headline)}</h2><p>${escapeHtml(strategy.contactBlock.text || contactLabel)}</p></div><a href="${escapeHtml(extractedData.originalUrl)}">${escapeHtml(strategy.contactBlock.ctaLabel)}</a></div></section></main>
<footer class="footer"><div class="wrap"><div class="footer-grid"><div>${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(extractedData.companyName)}">` : ''}<p>${escapeHtml(strategy.footerSummary)}</p></div><div><b>Navegacao</b><ul>${navItems.slice(0, 5).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div><b>Contato</b><p>${escapeHtml(extractedData.contacts.emails[0] || '')}</p><p>${escapeHtml(extractedData.contacts.phones[0] || contactLabel)}</p></div></div><div class="copy">© 2026 ${escapeHtml(extractedData.companyName)}. Preview modernizado com base no site original.</div></div></footer>
</body></html>`;

  return { html, css, variant };
}

function buildLegacyProfessionalFallbackLayout(extractedData, analysis) {
  const colors = extractedData.visualIdentity.colors || [];
  const primary = colors.find(c => !['#ffffff', '#000000'].includes(c.toLowerCase())) || '#0f6f8f';
  const accent = colors.find(c => c !== primary && !['#ffffff', '#000000'].includes(c.toLowerCase())) || '#d89b22';
  const logo = extractedData.visualIdentity.logo;
  const heroImage = (extractedData.images || []).find(img => img.width >= 420 || img.height >= 260)?.src || '';
  const title = extractedData.mainTitles[0] || `${extractedData.companyName}`;
  const subtitle = extractedData.texts.find(t => t.length > 80 && t.length < 230) || 'Experiência digital modernizada para transmitir confiança, clareza e facilitar o contato.';
  const services = (extractedData.servicesOrProducts.length ? extractedData.servicesOrProducts : extractedData.texts).slice(0, 6);
  const proof = extractedData.socialProof.slice(0, 3);
  const cta = extractedData.ctas[0] || 'Fale conosco';
  const contact = extractedData.contacts.whatsapp[0] || extractedData.contacts.phones[0] || extractedData.contacts.emails[0] || 'Contato pendente';
  const problems = analysis.problems.slice(0, 4);

  const css = `
:root{--primary:${primary};--accent:${accent};--ink:#0f172a;--muted:#64748b;--bg:#f6f8fb;--card:#ffffff}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}a{text-decoration:none;color:inherit}
.wrap{width:min(1160px,92vw);margin:auto}.top{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid #e6edf5}
.nav{height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:14px;font-weight:900}.brand img{max-height:46px;max-width:160px;object-fit:contain}.mark{width:46px;height:46px;border-radius:14px;background:var(--primary);color:white;display:grid;place-items:center;font-weight:900}
.links{display:flex;gap:22px;color:var(--muted);font-size:14px}.btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;padding:13px 18px;background:var(--primary);color:#fff;font-weight:800;box-shadow:0 14px 30px color-mix(in srgb,var(--primary) 24%,transparent)}
.hero{padding:76px 0 54px}.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}.eyebrow{color:var(--primary);font-weight:900;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.hero h1{font-size:clamp(38px,5vw,66px);line-height:.98;margin:12px 0 20px;letter-spacing:-.04em}.hero p{font-size:18px;color:#475569;max-width:680px}.hero-card{border-radius:28px;overflow:hidden;background:#dbe7ef;min-height:390px;box-shadow:0 24px 60px rgba(15,23,42,.14)}.hero-card img{width:100%;height:100%;min-height:390px;object-fit:cover}.placeholder{height:390px;display:grid;place-items:center;background:linear-gradient(135deg,var(--primary),#102033);color:white;font-size:42px;font-weight:900}
.section{padding:58px 0}.section h2{font-size:34px;letter-spacing:-.03em;margin:0 0 14px}.lead{color:var(--muted);max-width:760px;margin:0 0 28px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{background:var(--card);border:1px solid #e6edf5;border-radius:20px;padding:24px;box-shadow:0 14px 34px rgba(15,23,42,.06)}.card b{display:block;font-size:18px;margin-bottom:8px}.card p{color:#526173;margin:0}.diag{background:#0f172a;color:#e2e8f0;border-radius:28px;padding:34px}.diag h2{color:#fff}.diag .card{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12);box-shadow:none}.diag .card p,.diag .lead{color:#cbd5e1}.cta{background:linear-gradient(135deg,var(--primary),#0f172a);color:white;border-radius:30px;padding:42px;display:flex;justify-content:space-between;align-items:center;gap:26px}.cta h2{color:white;margin:0 0 8px}.cta p{color:#dbeafe;margin:0}.footer{padding:38px 0;color:#64748b;font-size:14px}
@media(max-width:820px){.links{display:none}.hero-grid,.grid{grid-template-columns:1fr}.hero{padding-top:46px}.cta{align-items:flex-start;flex-direction:column}.nav{height:auto;padding:16px 0}.hero-card,.hero-card img,.placeholder{min-height:260px}}
`;

  const cards = services.map((text, idx) => `<article class="card"><b>${escapeHtml(text.slice(0, 70))}</b><p>${escapeHtml(text)}</p></article>`).join('');
  const problemCards = problems.map(p => `<article class="card"><b>${escapeHtml(p.type)}</b><p>${escapeHtml(p.message)}</p></article>`).join('');
  const proofCards = (proof.length ? proof : ['Placeholder pendente: incluir depoimentos, números ou diferenciais comprováveis do cliente.'])
    .map(text => `<article class="card"><p>${escapeHtml(text)}</p></article>`).join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(extractedData.companyName)}</title><link rel="stylesheet" href="./style.css"/></head><body>
<header class="top"><div class="wrap nav"><div class="brand">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(extractedData.companyName)}">` : `<span class="mark">${escapeHtml(extractedData.companyName.slice(0,2).toUpperCase())}</span>`}<span>${escapeHtml(extractedData.companyName)}</span></div><nav class="links"><a>Serviços</a><a>Diferenciais</a><a>Contato</a></nav><a class="btn" href="#contato">${escapeHtml(cta)}</a></div></header>
<main><section class="hero"><div class="wrap hero-grid"><div><span class="eyebrow">Protótipo modernizado</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><a class="btn" href="#contato">${escapeHtml(cta)}</a></div><div class="hero-card">${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="Imagem de ${escapeHtml(extractedData.companyName)}">` : `<div class="placeholder">${escapeHtml(extractedData.companyName.slice(0,2).toUpperCase())}</div>`}</div></div></section>
<section class="section"><div class="wrap"><h2>Serviços e soluções em destaque</h2><p class="lead">Organização mais clara dos conteúdos reais capturados, com leitura rápida e foco em decisão.</p><div class="grid">${cards}</div></div></section>
<section class="section"><div class="wrap diag"><h2>O que foi melhorado estrategicamente</h2><p class="lead">O novo layout preserva a identidade visual, mas corrige pontos que poderiam reduzir confiança e conversão.</p><div class="grid">${problemCards}</div></div></section>
<section class="section"><div class="wrap"><h2>Confiança e diferenciais</h2><p class="lead">Área preparada para reforçar autoridade com informações reais do cliente.</p><div class="grid">${proofCards}</div></div></section>
<section class="section" id="contato"><div class="wrap cta"><div><h2>Contato facilitado e objetivo</h2><p>${escapeHtml(contact)}</p></div><a class="btn" style="background:var(--accent);color:#111827" href="${escapeHtml(extractedData.originalUrl)}">Acessar site original</a></div></section></main>
<footer class="footer"><div class="wrap">Protótipo demonstrativo criado para ${escapeHtml(extractedData.companyName)} com base em dados reais do site original.</div></footer>
</body></html>`;

  return { html, css };
}

function buildSiteLikeImprovedLayout(extractedData, analysis, layoutStrategy = null) {
  if (layoutStrategy?.source === 'gemini') {
    return buildAIDirectedLayout(extractedData, analysis, layoutStrategy);
  }

  const brand = pickBrandColors(extractedData.visualIdentity.colors || []);
  const primary = brand.primary;
  const accent = brand.accent;
  const dark = brand.dark;
  const healthcare = hasHealthcareContent(extractedData);
  const logo = pickLogo(extractedData) || extractedData.visualIdentity.logo;
  const screenshot = localCaptureRef(extractedData);
  const backgroundHero = !healthcare ? (extractedData.images || []).find(img => img.kind === 'background' && Number(img.width || 0) >= 700 && Number(img.height || 0) >= 280)?.src || '' : '';
  const heroImage = healthcare ? '' : (backgroundHero || pickUsableImage(extractedData.images, { minWidth: 250, minHeight: 160, avoidTextBanners: healthcare }));
  const realEstate = hasRealEstateContent(extractedData);
  const title = healthcare ? `${extractedData.companyName}: atendimento médico acessível e bem localizado` : (extractedData.mainTitles?.[0] || extractedData.companyName);
  const welcomeText = firstLongTextMatching(extractedData, /atende a diversos conv|valores acess|consultas, exames|terapias de reabilita/i, '');
  const locationText = firstLongTextMatching(extractedData, /est[aá] situada|zona leste|metr[oô]|local de f[aá]cil acesso/i, '');
  const workMedicineText = firstLongTextMatching(extractedData, /ASO|exames do trabalho|medicina do trabalho/i, '');
  const subtitle = healthcare
    ? (cleanBusinessText(welcomeText, 260) || 'Atendimento médico, exames e terapias com comunicação mais clara, acesso facilitado e contato direto para marcação de consultas.')
    : (extractedData.texts.find(t => t.length > 80 && t.length < 240)
      || (realEstate ? 'Encontre imoveis selecionados com atendimento consultivo, busca simples e informacoes organizadas.' : 'Experiencia digital modernizada para transmitir confianca, clareza e facilitar o contato.'));
  const menuItems = (extractedData.menus || []).filter(text => !/favoritos\s*0|clique|aceito|×|✖|sa[uú]de ao alcance de todos/i.test(text)).slice(0, 6);
  const cta = healthcare ? 'Marcação de consultas ou contato' : ((extractedData.ctas || []).find(text => /fale|contato|comprar|alugar|solicitar|anunciar/i.test(text)) || 'Fale conosco');
  const contact = extractedData.contacts.whatsapp[0] || extractedData.contacts.phones[0] || extractedData.contacts.emails[0] || 'Contato pendente';
  const contactLabel = formatContact(contact);
  const listings = realEstate ? extractRealEstateListings(extractedData) : [];
  const services = (extractedData.servicesOrProducts.length ? extractedData.servicesOrProducts : extractedData.texts)
    .filter(text => !listings.some(item => item.title === text))
    .slice(0, 5);
  const proof = extractedData.socialProof[0] || 'Placeholder pendente: inserir depoimentos, avaliacoes e numeros comprovaveis para reforcar confianca.';
  const saleStat = extractedData.texts.find(t => /\d+\s*im[oó]veis.*venda/i.test(t)) || 'Imoveis para comprar';
  const rentStat = extractedData.texts.find(t => /\d+\s*im[oó]veis.*alugar/i.test(t)) || 'Imoveis para alugar';
  const footerText = extractedData.footer?.find(t => t.length > 80) || subtitle;
  const bgImage = healthcare ? (heroImage || healthcareHeroSvg(primary, accent, extractedData.companyName)) : (heroImage || screenshot);

  const nav = (menuItems.length ? menuItems : ['Comprar', 'Alugar', 'Sobre nos', 'Fale conosco'])
    .map(item => `<a>${escapeHtml(item)}</a>`).join('');
  const listingCards = listings.map(item => `<article class="listing"><div class="photo">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : `<div class="photo-empty">Imagem pendente</div>`}<span class="badge">${escapeHtml(item.tag)}</span><span class="heart">♥</span></div><div class="listing-body"><div class="loc">${escapeHtml(item.location)}</div><h3>${escapeHtml(item.title)}</h3><div class="price">${escapeHtml(item.price)}</div><div class="meta">${escapeHtml(item.meta)}</div></div></article>`).join('');
  const serviceCards = services.map(text => `<article class="mini-card"><b>✓</b><span>${escapeHtml(text.slice(0, 110))}</span></article>`).join('');
  const healthServices = [
    'Clínica médica',
    'Ortopedia e traumatologia',
    'Medicina do trabalho e ASO',
    'Fisioterapia, acupuntura e RPG',
    'Psicologia e especialidades médicas',
    'Exames, ECG e laboratórios parceiros'
  ].filter(item => (extractedData.texts || []).join(' ').toLowerCase().includes(item.split(' ')[0].toLowerCase()) || item.includes('Clínica') || item.includes('Exames'));
  const healthcareCards = healthServices.map(item => `<article class="care-card"><span>+</span><b>${escapeHtml(item)}</b><p>${escapeHtml(item.includes('ASO') ? cleanBusinessText(workMedicineText, 130) : item.includes('Exames') ? 'Apoio com exames, eletrocardiograma e laboratórios parceiros com condições acessíveis.' : 'Atendimento organizado para pacientes particulares, convênios, sindicatos e associações.')}</p></article>`).join('');
  const healthcareHighlights = [
    { k: 'Convênios', v: 'Atende convênios, particulares, sindicatos e associações.' },
    { k: 'Acesso fácil', v: cleanBusinessText(locationText, 125) || 'Localização próxima ao Metrô Guilhermina-Esperança.' },
    { k: 'Contato direto', v: contactLabel }
  ].map(item => `<div class="stat"><b>${escapeHtml(item.k)}</b><span>${escapeHtml(item.v)}</span></div>`).join('');
  const infoRows = (healthcare ? [
    { k: 'Consultas e contato', v: cleanBusinessText(firstLongTextMatching(extractedData, /marcar uma consulta|tirar uma dúvida|entrar em contato/i, ''), 150) || 'Marcação de consultas e contato direto com a clínica.' },
    { k: 'Localização', v: cleanBusinessText(locationText, 170) || 'Atendimento na Vila Guilhermina, São Paulo.' },
    { k: 'Medicina do trabalho', v: cleanBusinessText(workMedicineText, 170) || 'Exames ocupacionais e orientações para empresas e funcionários.' }
  ] : services.slice(0, 3).map(text => ({ k: text.slice(0, 42), v: text })))
    .filter(item => item.v)
    .map(item => `<div class="info-row"><span>+</span><div><b>${escapeHtml(item.k)}</b><p>${escapeHtml(cleanBusinessText(item.v, 180))}</p></div></div>`)
    .join('');

  const css = `
:root{--primary:${primary};--accent:${accent};--dark:${dark};--ink:#171717;--muted:#667085;--line:#e8edf4;--bg:#f7f8fa;--card:#fff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.5}a{text-decoration:none;color:inherit}.wrap{width:min(1210px,92vw);margin:auto}
.utility{background:var(--dark);color:#fff;font-size:13px;font-weight:800}.utility .wrap{height:40px;display:flex;align-items:center;justify-content:space-between}.social{display:flex;gap:8px}.dot{width:24px;height:24px;border:1px solid rgba(255,255,255,.55);border-radius:50%;display:grid;place-items:center;font-size:10px}
.top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.nav{height:86px;display:flex;align-items:center;justify-content:space-between;gap:26px}.brand img{max-height:58px;max-width:210px;object-fit:contain}.mark{width:54px;height:54px;border-radius:16px;background:var(--primary);color:white;display:grid;place-items:center;font-weight:900}.links{display:flex;align-items:center;gap:28px;color:var(--primary);font-size:13px;font-weight:900;text-transform:uppercase}.client{background:var(--primary);color:#fff;border-radius:5px;padding:15px 21px;font-weight:900;text-transform:uppercase}
.hero{position:relative;min-height:600px;display:flex;align-items:center;overflow:hidden;background:#dde8ef}.hero:before{content:"";position:absolute;inset:0;background-image:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.44)),url("${escapeHtml(bgImage)}");background-size:cover;background-position:center;filter:saturate(1.08)}.hero:after{content:"";position:absolute;inset:auto 0 0;height:170px;background:linear-gradient(180deg,transparent,rgba(247,248,250,.96))}.hero-content{position:relative;z-index:1;width:100%;padding:58px 0 76px;text-align:center;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.45)}.hero h1{font-size:clamp(38px,4.8vw,64px);line-height:1.02;margin:0 auto 24px;max-width:820px;font-weight:900;letter-spacing:-.03em}.hero p{font-size:18px;max-width:760px;margin:0 auto 28px;color:#fff}
.search{width:min(770px,92vw);margin:0 auto;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.72);border-radius:18px;padding:26px;box-shadow:0 24px 70px rgba(0,0,0,.24);text-align:left;text-shadow:none}.tabs{display:flex;justify-content:center;gap:10px;margin-bottom:20px}.tab{border:0;border-radius:8px;padding:14px 28px;background:var(--dark);color:#fff;font-weight:900}.tab.active{background:var(--primary)}.fields{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.field{display:flex;flex-direction:column;gap:7px}.field label{font-size:11px;color:var(--primary);font-weight:900;text-transform:uppercase}.field div{height:48px;border:1px solid #dce1ea;border-radius:8px;background:#fff;color:#98a2b3;display:flex;align-items:center;padding:0 14px}.wide{grid-column:span 2}.btn{height:48px;border:0;border-radius:8px;background:var(--primary);color:#fff;font-weight:900;text-transform:uppercase;box-shadow:0 14px 32px rgba(0,0,0,.18)}
.section{position:relative;padding:64px 0}.title{text-align:center;margin-bottom:34px}.title h2{font-size:34px;line-height:1.05;margin:0;color:#111;font-weight:800}.title p{color:#475467;margin:12px 0 0}.rule{width:64px;height:4px;background:var(--primary);margin:18px auto 0;border-radius:99px}.pill-row{display:flex;justify-content:center;gap:10px;margin-bottom:34px}.pill{border:0;border-radius:7px;padding:13px 42px;background:#eceef2;color:#26324a;font-weight:900}.pill.active{background:var(--primary);color:#fff}
.listing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.listing{background:#fff;border:1px solid #dde3eb;border-radius:14px;overflow:hidden;box-shadow:0 16px 38px rgba(16,24,40,.08);transition:.22s transform,.22s box-shadow}.listing:hover{transform:translateY(-4px);box-shadow:0 22px 48px rgba(16,24,40,.14)}.photo{height:218px;background:#dbe3eb;position:relative;overflow:hidden}.photo img{width:100%;height:100%;object-fit:cover}.photo-empty{height:100%;display:grid;place-items:center;background:linear-gradient(135deg,#edf1f5,#cfd8e3);color:#667085;font-weight:900}.badge{position:absolute;left:13px;top:13px;background:var(--dark);color:#fff;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:900}.heart{position:absolute;right:13px;top:13px;background:#fff;color:var(--primary);width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:900}.listing-body{padding:18px}.listing h3{font-size:18px;line-height:1.25;margin:0 0 9px}.loc{color:#667085;font-size:14px;margin-bottom:16px}.price{color:var(--primary);font-weight:900;margin-bottom:14px}.meta{border-top:1px solid var(--line);padding-top:12px;color:#475467;font-size:13px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:stretch}.panel{background:#fff;border:1px solid var(--line);border-radius:22px;padding:32px;box-shadow:0 18px 45px rgba(16,24,40,.07)}.panel.dark{background:var(--dark);color:#fff}.panel h2{font-size:32px;line-height:1.08;margin:0 0 16px}.panel p{color:#667085}.panel.dark p{color:#d8dde8}.info-row{display:flex;gap:13px;border-top:1px solid rgba(255,255,255,.14);padding-top:15px;margin-top:15px}.info-row span{width:28px;height:28px;border-radius:50%;background:var(--primary);color:white;display:grid;place-items:center;flex:0 0 auto;font-weight:900}.info-row b{color:#fff}.info-row p{margin:.35rem 0 0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}.stat,.mini-card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;text-align:center}.stat b,.mini-card b{display:block;color:var(--primary);font-size:26px}.mini-card span,.stat span{color:#475467}.cta{background:linear-gradient(135deg,var(--primary),var(--dark));color:#fff;border-radius:26px;padding:38px;display:flex;align-items:center;justify-content:space-between;gap:24px}.cta h2{margin:0 0 6px;font-size:30px}.cta p{margin:0;color:#f7dede}.cta a{background:#fff;color:var(--primary);border-radius:10px;padding:15px 22px;font-weight:900}
.care-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.care-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 16px 40px rgba(16,24,40,.07)}.care-card span{width:36px;height:36px;border-radius:12px;background:color-mix(in srgb,var(--primary) 12%,#fff);color:var(--primary);display:grid;place-items:center;font-size:26px;font-weight:900;margin-bottom:16px}.care-card b{display:block;font-size:18px;margin-bottom:10px}.care-card p{margin:0;color:#526173}.appointment{background:#fff;border:1px solid var(--line);border-radius:24px;padding:28px;box-shadow:0 18px 48px rgba(16,24,40,.08);display:grid;grid-template-columns:1.05fr .95fr;gap:24px;align-items:center}.appointment h2{font-size:30px;line-height:1.1;margin:0 0 12px}.appointment p{color:#526173}.formbox{background:#f4f9ff;border:1px solid #d8ebfb;border-radius:18px;padding:20px;display:grid;gap:12px}.input{height:48px;background:#fff;border:1px solid #d8e1ec;border-radius:10px;color:#98a2b3;display:flex;align-items:center;padding:0 14px}.formbox button{height:48px;border:0;border-radius:10px;background:var(--primary);color:#fff;font-weight:900}
.footer{background:var(--dark);color:#fff;padding:52px 0 28px}.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1.2fr;gap:34px}.footer img{max-width:170px;max-height:62px;object-fit:contain;margin-bottom:18px}.footer p,.footer li{color:#e5e7eb;font-size:14px}.footer ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}.copy{border-top:1px solid rgba(255,255,255,.2);margin-top:36px;padding-top:20px;font-weight:800;font-size:13px}
@media(max-width:900px){.utility,.links{display:none}.nav{height:74px}.hero{min-height:auto}.fields,.listing-grid,.split,.stats,.footer-grid,.care-grid,.appointment{grid-template-columns:1fr}.wide{grid-column:auto}.hero-content{text-align:left}.hero h1,.hero p{margin-left:0}.tabs{justify-content:flex-start;overflow:auto}.tab,.pill{padding:12px 18px}.cta{flex-direction:column;align-items:flex-start}.brand img{max-width:170px}}
`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(extractedData.companyName)}</title><link rel="stylesheet" href="./style.css"/></head><body>
<div class="utility"><div class="wrap"><span>${escapeHtml((extractedData.texts || []).find(t => /creci/i.test(t) && !/©|desenvolvido/i.test(t) && t.length < 80) || 'Atendimento consultivo')}</span><span>${escapeHtml(extractedData.contacts.phones[0] || contactLabel)}</span><div class="social"><span class="dot">ig</span><span class="dot">f</span><span class="dot">in</span></div></div></div>
<header class="top"><div class="wrap nav"><div class="brand">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(extractedData.companyName)}">` : `<span class="mark">${escapeHtml(extractedData.companyName.slice(0,2).toUpperCase())}</span>`}</div><nav class="links">${nav}</nav><a class="client" href="#contato">${healthcare ? 'Marcar consulta' : 'Área do cliente'}</a></div></header>
<main><section class="hero"><div class="hero-content"><div class="wrap"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>${realEstate ? `<div class="search"><div class="tabs"><button class="tab active">Comprar</button><button class="tab">Alugar</button><button class="tab">Lançamentos</button></div><div class="fields"><div class="field"><label>Tipo</label><div>Selecione o tipo</div></div><div class="field"><label>Cidade</label><div>Belo Horizonte</div></div><div class="field"><label>Bairros</label><div>Selecionar bairros</div></div><div class="field"><label>Quartos</label><div>Quartos</div></div><div class="field wide"><label>Buscar por código</label><div>Digite o código</div></div><button class="btn">Buscar imóveis</button></div></div>` : `<a class="client" href="#contato">${escapeHtml(cta)}</a>`}</div></div></section>
${realEstate ? `<section class="section"><div class="wrap"><div class="title"><h2>Imóveis em destaque</h2><p>Opções apresentadas pela ${escapeHtml(extractedData.companyName)} para compra, locação e atendimento imobiliário.</p><div class="rule"></div></div><div class="pill-row"><button class="pill active">Comprar</button><button class="pill">Alugar</button><button class="pill">Super destaque</button></div><div class="listing-grid">${listingCards}</div></div></section>` : ''}
${healthcare ? `<section class="section"><div class="wrap appointment"><div><h2>Marcação de consultas</h2><p>${escapeHtml(cleanBusinessText(firstTextMatching(extractedData, /Preencha o formulário|marcar uma consulta|tirar uma dúvida/i, 'Entre em contato com a clínica para marcação de consultas, informações sobre especialidades e dúvidas de atendimento.'), 220))}</p><div class="stats">${healthcareHighlights}</div></div><div class="formbox"><div class="input">Nome do paciente</div><div class="input">Telefone ou WhatsApp</div><div class="input">Especialidade desejada</div><button>Solicitar atendimento</button></div></div></section>
<section class="section"><div class="wrap"><div class="title"><h2>Especialidades e serviços médicos</h2><p>Atendimentos e informações disponibilizados pela clínica.</p><div class="rule"></div></div><div class="care-grid">${healthcareCards}</div></div></section>` : ''}
<section class="section"><div class="wrap split"><div class="panel"><h2>${healthcare ? 'Atendimento acessível na Vila Guilhermina' : extractedData.companyName}</h2><p>${escapeHtml(healthcare ? subtitle : footerText.slice(0, 260))}</p><div class="stats">${healthcare ? healthcareHighlights : `<div class="stat"><b>${escapeHtml(saleStat.split(' ')[0])}</b><span>${escapeHtml(saleStat.replace(/^\d+\s*/, ''))}</span></div><div class="stat"><b>${escapeHtml(rentStat.split(' ')[0])}</b><span>${escapeHtml(rentStat.replace(/^\d+\s*/, ''))}</span></div><div class="stat"><b>Contato</b><span>${escapeHtml(contactLabel)}</span></div>`}</div></div><div class="panel dark"><h2>${healthcare ? 'Informações para o paciente' : 'Informações principais'}</h2>${infoRows}</div></div></section>
${!healthcare ? `<section class="section"><div class="wrap"><div class="title"><h2>Serviços e diferenciais</h2><p>Informações apresentadas pela ${escapeHtml(extractedData.companyName)}.</p><div class="rule"></div></div><div class="stats">${serviceCards}<article class="mini-card"><b>★</b><span>${escapeHtml(proof.slice(0, 120))}</span></article></div></div></section>` : ''}
<section class="section" id="contato"><div class="wrap cta"><div><h2>${healthcare ? 'Fale com a clínica' : 'Fale com a equipe'}</h2><p>${escapeHtml(contactLabel)}</p></div><a href="${escapeHtml(extractedData.originalUrl)}">Abrir site</a></div></section></main>
<footer class="footer"><div class="wrap"><div class="footer-grid"><div>${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(extractedData.companyName)}">` : ''}<p>${escapeHtml((healthcare ? subtitle : footerText).slice(0, 220))}</p></div><div><b>A empresa</b><ul>${menuItems.slice(0, 5).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div><b>${healthcare ? 'Atendimentos' : 'Imóveis'}</b><ul>${healthcare ? '<li>Consultas</li><li>Exames</li><li>Medicina do trabalho</li><li>Fisioterapia</li>' : '<li>Comprar</li><li>Alugar</li><li>Lançamentos</li><li>Anunciar imóvel</li>'}</ul></div><div><b>Atendimento</b><p>${escapeHtml(extractedData.contacts.emails[0] || '')}</p><p>${escapeHtml(extractedData.contacts.phones[0] || contactLabel)}</p></div></div><div class="copy">© 2026 ${escapeHtml(extractedData.companyName)}</div></div></footer>
</body></html>`;

  return { html, css };
}

function createClientFolder(lead) {
  const root = path.join(process.cwd(), 'Clientes', slugify(getLeadName(lead)));
  const dirs = {
    root,
    capture: ensureDir(path.join(root, 'captura')),
    captureImages: ensureDir(path.join(root, 'captura', 'imagens')),
    captureLogo: ensureDir(path.join(root, 'captura', 'logo')),
    analysis: ensureDir(path.join(root, 'analise')),
    prompt: ensureDir(path.join(root, 'prompt')),
    layout: ensureDir(path.join(root, 'layout-gerado')),
    layoutAssets: ensureDir(path.join(root, 'layout-gerado', 'assets'))
  };
  return dirs;
}

async function generateClientLayout(lead, dirs, structured) {
  const indexPath = path.join(dirs.layout, 'index.html');
  const stylePath = path.join(dirs.layout, 'style.css');
  const previewPath = path.join(dirs.layout, 'preview.png');

  const layout = buildSiteLikeImprovedLayout(structured.extractedData, structured.analysis, structured.layoutStrategy);
  fs.writeFileSync(indexPath, layout.html, 'utf8');
  fs.writeFileSync(stylePath, layout.css, 'utf8');

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getBrowserPath() || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });
    await page.goto(`file:///${indexPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0', timeout: 50000 });
    await page.screenshot({ path: previewPath, fullPage: true });
    await page.close();
  } finally {
    await browser.close();
  }

  return {
    success: true,
    generator: structured.layoutStrategy?.source === 'gemini' ? `gemini-directed-layout:${layout.variant || 'default'}` : `site-like-improved-layout:${layout.variant || 'default'}`,
    indexPath,
    stylePath,
    previewPath
  };
}

async function saveGeneratedFiles({ lead, dirs, capture, extractedData, analysis, prompt, layout, layoutStrategy }) {
  const imageDownloads = [];
  const logoDownloads = [];
  for (const [idx, img] of (extractedData.images || []).slice(0, 12).entries()) {
    const saved = await downloadAsset(img.src, dirs.captureImages, `imagem-${idx + 1}`);
    if (saved) imageDownloads.push(saved);
  }
  for (const [idx, logo] of (extractedData.visualIdentity.logos || []).slice(0, 3).entries()) {
    const saved = await downloadAsset(logo, dirs.captureLogo, `logo-${idx + 1}`);
    if (saved) logoDownloads.push(saved);
  }

  const paths = {
    extracted: writeJson(path.join(dirs.capture, 'dados-extraidos.json'), { ...extractedData, downloadedImages: imageDownloads, downloadedLogos: logoDownloads }),
    pages: writeJson(path.join(dirs.capture, 'paginas-analisadas.json'), capture.pages),
    problems: writeJson(path.join(dirs.analysis, 'problemas-identificados.json'), analysis.problems),
    opportunities: writeJson(path.join(dirs.analysis, 'oportunidades-melhoria.json'), analysis.opportunities),
    layoutStrategy: writeJson(path.join(dirs.layout, 'layout-strategy.json'), layoutStrategy || { source: 'local-fallback' }),
    prompt: path.join(dirs.prompt, 'prompt-prototipo.md'),
    metadata: path.join(dirs.layout, 'metadata.json')
  };
  fs.writeFileSync(paths.prompt, prompt, 'utf8');

  const metadata = {
    nomeCliente: extractedData.companyName,
    urlOriginal: extractedData.originalUrl,
    dataHoraGeracao: new Date().toISOString(),
    statusGeracao: 'success',
    objetivoComercial: 'Usar o protótipo como proposta visual consultiva para demonstrar modernização, clareza de oferta e aumento de conversão ao lead capturado.',
    materiaisApresentacao: {
      previewComercial: layout.previewPath,
      prototipoNavegavel: layout.indexPath,
      promptPrototipo: paths.prompt,
      pastaCliente: dirs.root
    },
    roteiroSugeridoApresentacao: [
      'Abrir com o diagnóstico dos problemas que podem reduzir contatos.',
      'Mostrar o preview como uma versão modernizada, preservando identidade e linguagem da marca.',
      'Destacar melhorias de hierarquia, CTA, confiança visual e acesso mobile.',
      'Encerrar oferecendo evolução do protótipo para implementação real.'
    ],
    caminhosArquivos: {
      pastaCliente: dirs.root,
      dadosExtraidos: paths.extracted,
      paginasAnalisadas: paths.pages,
      problemas: paths.problems,
      oportunidades: paths.opportunities,
      estrategiaLayout: paths.layoutStrategy,
      prompt: paths.prompt,
      html: layout.indexPath,
      css: layout.stylePath,
      preview: layout.previewPath
    },
    tecnologiasUsadas: ['Electron', 'Puppeteer', 'React', 'HTML', 'CSS'],
    inteligenciaLayout: {
      provider: layoutStrategy?.source === 'gemini' ? 'Gemini API' : 'Fallback local',
      generator: layout.generator,
      status: layoutStrategy?.source === 'gemini' ? 'success' : 'fallback',
      observacao: layoutStrategy?.error ? 'Gemini indisponivel; layout gerado com fallback local.' : 'Estrategia de layout salva em layout-strategy.json.'
    },
    resumoLayoutGerado: 'Protótipo moderno e responsivo com identidade visual preservada, textos reais e foco em conversão, preparado para apresentação comercial.',
    dadosAusentes: extractedData.missingData
  };
  writeJson(paths.metadata, metadata);
  return { paths, metadata };
}

async function updateLeadGenerationStatus(lead, result) {
  const table = lead._typeCode === 'sistema' ? 'leads_sistemas' : lead._typeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
  await crud.updateLeadLayoutStatus(table, lead.id, {
    status: result.success ? 'success' : 'error',
    path: result.layoutPath || '',
    preview: result.previewPath || '',
    prompt: result.promptPath || '',
    generatedAt: new Date().toISOString()
  });
}

async function generateClientLayoutPipeline(lead) {
  const url = await resolveLeadWebsiteUrl(lead);
  if (!url) throw new Error('INVALID_URL');
  const dirs = createClientFolder(lead);
  try {
    const capture = await captureLeadWebsite({ ...lead, url }, dirs);
    const extractedData = extractWebsiteData(lead, capture);
    if ((extractedData.texts || []).length < 3 && (extractedData.images || []).length < 1) {
      throw new Error('INSUFFICIENT_DATA');
    }
    const analysis = analyzeWebsiteProblems(extractedData);
    let layoutStrategy = null;
    try {
      layoutStrategy = await buildGeminiLayoutStrategy({ extractedData, analysis });
    } catch (strategyErr) {
      layoutStrategy = {
        source: 'local-fallback',
        error: strategyErr.message,
        recommendationNotes: ['Gemini indisponivel ou sem cota no momento da geracao.']
      };
    }
    const structured = { lead, extractedData, analysis, layoutStrategy };
    const prompt = buildPrototypePrompt(structured);
    const layout = await generateClientLayout(lead, dirs, structured);
    const saved = await saveGeneratedFiles({ lead, dirs, capture, extractedData, analysis, prompt, layout, layoutStrategy });
    const response = {
      success: true,
      clientName: extractedData.companyName,
      folderPath: dirs.root,
      layoutPath: layout.indexPath,
      previewPath: layout.previewPath,
      promptPath: saved.paths.prompt,
      extractedDataPath: saved.paths.extracted,
      problemsPath: saved.paths.problems,
      metadata: saved.metadata
    };
    await updateLeadGenerationStatus(lead, response);
    return response;
  } catch (err) {
    const errorMetadata = {
      nomeCliente: getLeadName(lead),
      urlOriginal: url,
      dataHoraGeracao: new Date().toISOString(),
      statusGeracao: 'error',
      erro: err.message,
      caminhosArquivos: { pastaCliente: dirs.root },
      tecnologiasUsadas: ['Electron', 'Puppeteer', 'React', 'HTML', 'CSS'],
      resumoLayoutGerado: 'Não foi possível gerar o layout deste lead.'
    };
    writeJson(path.join(dirs.layout, 'metadata.json'), errorMetadata);
    await updateLeadGenerationStatus(lead, { success: false, layoutPath: '', previewPath: '', promptPath: '' });
    throw err;
  }
}

module.exports = {
  captureLeadWebsite,
  extractWebsiteData,
  analyzeWebsiteProblems,
  buildPrototypePrompt,
  generateClientLayout,
  createClientFolder,
  saveGeneratedFiles,
  updateLeadGenerationStatus,
  generateClientLayoutPipeline
};
