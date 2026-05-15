const fs = require('fs');
const https = require('https');

const DEFAULT_GEMINI_API_KEY = 'AIzaSyA7WMYzZtY4kBUWmV7EcKSbS7vvzuqcM1o';
const DEFAULT_MODELS = [
  process.env.CAPLEAD_GEMINI_MODEL,
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
].filter(Boolean);

function getGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.CAPLEAD_GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY || '').trim();
}

function truncate(value = '', max = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function compactList(values = [], maxItems = 20, maxLength = 180) {
  return [...new Set((values || []).map(item => truncate(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function imagePartFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const bytes = fs.readFileSync(filePath);
  if (!bytes.length || bytes.length > 4 * 1024 * 1024) return null;
  return {
    inline_data: {
      mime_type: 'image/png',
      data: bytes.toString('base64')
    }
  };
}

function buildLayoutStrategyPrompt({ extractedData, analysis }) {
  const payload = {
    empresa: extractedData.companyName,
    url: extractedData.originalUrl,
    nichoDetectado: extractedData.niche,
    coresCapturadas: compactList(extractedData.visualIdentity?.colors, 12, 20),
    fontesCapturadas: compactList(extractedData.visualIdentity?.fonts, 8, 60),
    titulos: compactList(extractedData.mainTitles, 24, 160),
    menus: compactList(extractedData.menus, 16, 80),
    ctas: compactList(extractedData.ctas, 16, 80),
    textosPrincipais: compactList(extractedData.texts, 36, 240),
    servicosProdutos: compactList(extractedData.servicesOrProducts, 20, 180),
    rodape: compactList(extractedData.footer, 14, 180),
    contatos: extractedData.contacts,
    paginasAnalisadas: (extractedData.pagesAnalyzed || []).map(page => ({
      url: page.url,
      title: truncate(page.title, 120)
    })),
    imagensDisponiveis: (extractedData.images || []).slice(0, 18).map(img => ({
      src: img.src,
      alt: truncate(img.alt, 90),
      width: img.width,
      height: img.height,
      kind: img.kind || 'image'
    })),
    problemasInternos: (analysis.problems || []).map(problem => ({
      type: problem.type,
      severity: problem.severity,
      message: problem.message
    }))
  };

  return [
    'Voce e um diretor de design e conversao para landing pages comerciais.',
    'Gere uma estrategia JSON para modernizar o site capturado preservando identidade, nicho, linguagem e informacoes reais.',
    'Regras obrigatorias:',
    '- Use somente informacoes coerentes com o lead capturado.',
    '- Nao misture nichos. Exemplo: clinica nao pode ter menu de imoveis; imobiliaria nao pode ter especialidades medicas.',
    '- Nao inclua no preview termos como "pontos corrigidos", "problemas", "diagnostico", "site ruim" ou textos de auditoria.',
    '- Nao invente dados criticos como premios, anos, depoimentos, CRECI, CRM, endereco ou telefones.',
    '- Se faltar informacao, use copy profissional neutra e marcada como pendente apenas em recommendationNotes, nunca no texto publico.',
    '- Reaproveite cores capturadas e explique assets rejeitados quando forem banners, mapas, imagens pequenas, distorcidas ou fora de contexto.',
    '- Escolha um layoutVariant coerente com o nicho e varie a composicao entre leads diferentes: ordem das secoes, formato do hero, cards, etapas, catalogo, area de agendamento ou prova de autoridade.',
    '- Evite repetir a mesma arquitetura para todos os clientes. O layout deve parecer desenhado para aquela empresa especifica.',
    '- O resultado deve orientar um preview real de site, nao um relatorio.',
    '',
    'Dados capturados:',
    JSON.stringify(payload, null, 2)
  ].join('\n');
}

function getLayoutStrategySchema() {
  const card = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      cta: { type: 'string' }
    },
    required: ['title', 'description']
  };

  return {
    type: 'object',
    properties: {
      companyName: { type: 'string' },
      niche: { type: 'string' },
      layoutFamily: {
        type: 'string',
        enum: ['real_estate', 'healthcare', 'legal', 'beauty', 'food', 'education', 'technology', 'local_service', 'corporate']
      },
      layoutVariant: {
        type: 'string',
        enum: [
          'property_search', 'marketplace_showcase', 'broker_premium',
          'care_access', 'clinic_institutional', 'appointment_first',
          'authority_editorial', 'consultative_split', 'trust_first',
          'visual_portfolio', 'premium_service', 'soft_editorial',
          'menu_spotlight', 'experience_first', 'delivery_cta',
          'program_catalog', 'learning_path', 'institutional_trust',
          'saas_modern', 'solution_grid', 'case_study',
          'local_conversion', 'service_directory', 'quote_first',
          'corporate_modern', 'editorial_brand', 'conversion_grid'
        ]
      },
      tone: { type: 'string' },
      brandColors: {
        type: 'array',
        items: { type: 'string' }
      },
      typographyDirection: { type: 'string' },
      visualDirection: { type: 'string' },
      hero: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          subheadline: { type: 'string' },
          ctaLabel: { type: 'string' },
          secondaryCtaLabel: { type: 'string' },
          imageUse: { type: 'string' }
        },
        required: ['headline', 'subheadline', 'ctaLabel']
      },
      navigation: {
        type: 'array',
        items: { type: 'string' }
      },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            intro: { type: 'string' },
            style: {
              type: 'string',
              enum: ['cards', 'split', 'steps', 'featured', 'contact', 'listings', 'trust']
            },
            cards: {
              type: 'array',
              items: card
            }
          },
          required: ['id', 'title', 'intro', 'style', 'cards']
        }
      },
      contactBlock: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          text: { type: 'string' },
          ctaLabel: { type: 'string' }
        },
        required: ['headline', 'text', 'ctaLabel']
      },
      footerSummary: { type: 'string' },
      approvedAssets: {
        type: 'array',
        items: { type: 'string' }
      },
      rejectedAssets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            src: { type: 'string' },
            reason: { type: 'string' }
          },
          required: ['src', 'reason']
        }
      },
      recommendationNotes: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['companyName', 'niche', 'layoutFamily', 'layoutVariant', 'tone', 'brandColors', 'hero', 'navigation', 'sections', 'contactBlock', 'footerSummary']
  };
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      },
      timeout: 55000
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = json?.error?.message || `Gemini HTTP ${res.statusCode}`;
          reject(new Error(message));
          return;
        }
        resolve(json);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Gemini timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function parseGeminiText(response) {
  return response?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim() || '';
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini did not return JSON');
    return JSON.parse(match[0]);
  }
}

function sanitizeStrategy(strategy, extractedData) {
  const clean = strategy && typeof strategy === 'object' ? strategy : {};
  const sections = Array.isArray(clean.sections) ? clean.sections : [];
  return {
    source: 'gemini',
    companyName: truncate(clean.companyName || extractedData.companyName, 120),
    niche: truncate(clean.niche || extractedData.niche || 'Categoria pendente', 120),
    layoutFamily: clean.layoutFamily || 'corporate',
    layoutVariant: truncate(clean.layoutVariant || '', 60),
    tone: truncate(clean.tone || 'profissional e consultivo', 160),
    brandColors: Array.isArray(clean.brandColors) ? clean.brandColors.slice(0, 6) : [],
    typographyDirection: truncate(clean.typographyDirection, 180),
    visualDirection: truncate(clean.visualDirection, 260),
    hero: {
      headline: truncate(clean.hero?.headline || extractedData.mainTitles?.[0] || extractedData.companyName, 120),
      subheadline: truncate(clean.hero?.subheadline || extractedData.texts?.[0] || '', 260),
      ctaLabel: truncate(clean.hero?.ctaLabel || extractedData.ctas?.[0] || 'Fale conosco', 60),
      secondaryCtaLabel: truncate(clean.hero?.secondaryCtaLabel || 'Conheca melhor', 60),
      imageUse: truncate(clean.hero?.imageUse || '', 200)
    },
    navigation: compactList(clean.navigation?.length ? clean.navigation : extractedData.menus, 6, 34),
    sections: sections.slice(0, 5).map((section, index) => ({
      id: truncate(section.id || `secao-${index + 1}`, 40),
      title: truncate(section.title || 'Informacoes principais', 90),
      intro: truncate(section.intro || '', 220),
      style: section.style || 'cards',
      cards: (Array.isArray(section.cards) ? section.cards : []).slice(0, 6).map(card => ({
        title: truncate(card.title || '', 70),
        description: truncate(card.description || '', 220),
        cta: truncate(card.cta || '', 50)
      })).filter(card => card.title && card.description)
    })).filter(section => section.title && section.cards.length),
    contactBlock: {
      headline: truncate(clean.contactBlock?.headline || 'Fale com a equipe', 90),
      text: truncate(clean.contactBlock?.text || '', 180),
      ctaLabel: truncate(clean.contactBlock?.ctaLabel || 'Entrar em contato', 60)
    },
    footerSummary: truncate(clean.footerSummary || extractedData.texts?.[0] || extractedData.companyName, 260),
    approvedAssets: Array.isArray(clean.approvedAssets) ? clean.approvedAssets.slice(0, 8) : [],
    rejectedAssets: Array.isArray(clean.rejectedAssets) ? clean.rejectedAssets.slice(0, 10) : [],
    recommendationNotes: Array.isArray(clean.recommendationNotes) ? clean.recommendationNotes.slice(0, 10) : []
  };
}

async function buildGeminiLayoutStrategy({ extractedData, analysis }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');

  const screenshotPath = extractedData.pagesAnalyzed?.[0]?.screenshotPath;
  const imagePart = imagePartFromFile(screenshotPath);
  const parts = [{ text: buildLayoutStrategyPrompt({ extractedData, analysis }) }];
  if (imagePart) parts.push(imagePart);

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.45,
      topP: 0.9,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseJsonSchema: getLayoutStrategySchema()
    }
  };

  const errors = [];
  for (const model of DEFAULT_MODELS) {
    try {
      const response = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        body,
        { 'x-goog-api-key': apiKey }
      );
      const strategy = sanitizeStrategy(safeParseJson(parseGeminiText(response)), extractedData);
      strategy.model = model;
      return strategy;
    } catch (err) {
      errors.push(`${model}: ${err.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

module.exports = {
  buildGeminiLayoutStrategy,
  sanitizeStrategy
};
