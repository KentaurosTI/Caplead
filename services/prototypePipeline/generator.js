const { escapeHtml } = require("./utils");

const layoutTemplateLibrary = {
  high_ticket: ["header", "hero", "prova", "servicos", "about", "explicacao", "cta"],
  saas_moderno: ["header", "hero", "servicos", "prova", "about", "explicacao", "cta"],
  landing_conversao: ["header", "hero", "prova", "servicos", "explicacao", "cta"],
  institucional_premium: ["header", "hero", "about", "servicos", "prova", "explicacao", "cta"],
};

function firstText(leadDesignData, fallback) {
  return (leadDesignData.texts || []).find((txt) => txt && txt.length > 10) || fallback;
}

function findSectionText(leadDesignData, type) {
  const section = (leadDesignData.sections || []).find((item) => item.type === type);
  return section ? (section.texts || []).filter(Boolean) : [];
}

function getHeroContent(leadDesignData, leadContext) {
  const proposal = leadContext?.proposta || leadContext?.proposal || "";
  const headlineRaw =
    leadDesignData.h1 ||
    (leadDesignData.texts || []).find((txt) => txt.length >= 24 && txt.length <= 96) ||
    `Upgrade digital para ${leadDesignData.companyName}`;
  const subRaw =
    proposal ||
    (leadDesignData.texts || []).find((txt) => txt.length >= 70 && txt.length <= 210) ||
    "Estrutura de pagina profissional para aumentar clareza de oferta e taxa de conversao.";

  return {
    headline: headlineRaw.length > 110 ? `${headlineRaw.slice(0, 107)}...` : headlineRaw,
    paragraph: subRaw,
  };
}

function getServiceCards(leadDesignData, leadContext) {
  const texts = findSectionText(leadDesignData, "servicos");
  const source = texts.length ? texts : (leadDesignData.texts || []).slice(0, 10);
  const cards = [];
  for (const txt of source) {
    if (!txt || txt.length < 16) continue;
    cards.push({
      title: txt.length > 52 ? `${txt.slice(0, 49)}...` : txt,
      description: txt,
    });
    if (cards.length >= 6) break;
  }
  if (!cards.length) {
    const niche = leadContext?.nicho || leadDesignData.niche || "negocio";
    cards.push(
      { title: "Posicionamento premium", description: `Narrativa clara para elevar a percepcao de valor no nicho ${niche}.` },
      { title: "Conversao orientada", description: "CTA destacado em pontos de alta intencao comercial." },
      { title: "Estrutura profissional", description: "Grid consistente, contraste forte e leitura objetiva." }
    );
  }
  return cards;
}

function renderLogo(leadDesignData) {
  if (leadDesignData.logo) {
    return `<img src="${escapeHtml(leadDesignData.logo)}" alt="Logo ${escapeHtml(leadDesignData.companyName)}" />`;
  }
  const initials = (leadDesignData.companyName || "Empresa")
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return `<div class="logo-placeholder" aria-label="Logo placeholder">${escapeHtml(initials)}</div>`;
}

function buildHeroVisual(leadDesignData) {
  const heroImage = (leadDesignData.images || [])[0]?.src || "";
  if (heroImage) return `<img class="hero-media" src="${escapeHtml(heroImage)}" alt="Imagem da empresa" />`;
  return `<div class="hero-visual-fallback">
    <div class="shape shape-a"></div>
    <div class="shape shape-b"></div>
    <div class="shape shape-c"></div>
  </div>`;
}

function renderHeader(leadDesignData, strategy) {
  return `<header class="surface topbar" data-shot="header">
    <div class="brand">
      ${renderLogo(leadDesignData)}
      <div>
        <strong>${escapeHtml(leadDesignData.companyName || "Empresa")}</strong>
        <span>${escapeHtml(leadDesignData.niche || "nicho")}</span>
      </div>
    </div>
    <div class="topbar-right">
      <span class="chip">${escapeHtml(strategy.templateName)}</span>
      <button class="btn btn-primary btn-small">${escapeHtml((leadDesignData.ctas || [])[0] || "Solicitar contato")}</button>
    </div>
  </header>`;
}

function renderHero(leadDesignData, strategy, leadContext) {
  const { headline, paragraph } = getHeroContent(leadDesignData, leadContext);
  const primary = (leadDesignData.ctas || [])[0] || "Solicitar diagnostico";
  const secondary = (leadDesignData.ctas || [])[1] || "Receber proposta";
  const heroVisual = buildHeroVisual(leadDesignData);
  const heroClass = strategy.heroVariant === "centered" ? "hero hero-centered" : strategy.heroVariant === "image-left" ? "hero hero-image-left" : "hero hero-image-right";
  const ctaClass = strategy.ctaVariant === "stacked-primary" ? "cta cta-stack" : "cta cta-inline";

  return `<section class="surface ${heroClass}" data-shot="hero">
    <div class="hero-grid">
      ${strategy.heroVariant === "image-left" ? `<div class="hero-visual">${heroVisual}</div>` : ""}
      <div class="hero-copy">
        <p class="eyebrow">Prototipo profissional nivel agencia</p>
        <h1>${escapeHtml(headline)}</h1>
        <p class="hero-sub">${escapeHtml(paragraph)}</p>
        <div class="${ctaClass}">
          <button class="btn btn-primary">${escapeHtml(primary)}</button>
          <button class="btn btn-secondary">${escapeHtml(secondary)}</button>
        </div>
      </div>
      ${strategy.heroVariant === "centered" ? "" : strategy.heroVariant === "image-left" ? "" : `<div class="hero-visual">${heroVisual}</div>`}
      ${strategy.heroVariant === "centered" ? `<div class="hero-visual">${heroVisual}</div>` : ""}
    </div>
  </section>`;
}

function renderServices(leadDesignData, strategy, leadContext) {
  const cards = getServiceCards(leadDesignData, leadContext);
  const columns = strategy.layoutVariant === "split-professional" ? "repeat(2,minmax(0,1fr))" : "repeat(3,minmax(0,1fr))";
  const cardsHtml = cards
    .map(
      (item) => `<article class="card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>`
    )
    .join("");
  return `<section class="surface section" data-shot="services">
    <div class="section-head">
      <h2>Solucoes e Oferta</h2>
      <span>Estrutura comercial</span>
    </div>
    <div class="cards" style="--cards-columns:${columns};">${cardsHtml}</div>
  </section>`;
}

function renderAbout(leadDesignData, leadContext) {
  const aboutText =
    findSectionText(leadDesignData, "sobre")[0] ||
    leadContext?.proposta ||
    firstText(leadDesignData, "Apresentacao institucional reposicionada para reforcar credibilidade e valor percebido.");
  const contact = [
    leadDesignData.contactInfo?.email ? `Email: ${leadDesignData.contactInfo.email}` : "",
    leadDesignData.contactInfo?.phone ? `Telefone: ${leadDesignData.contactInfo.phone}` : "",
    leadDesignData.contactInfo?.whatsapp ? "WhatsApp ativo" : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return `<section class="surface section" data-shot="about">
    <div class="section-head">
      <h2>Autoridade da Marca</h2>
      <span>Percepcao de valor</span>
    </div>
    <div class="about-grid">
      <p>${escapeHtml(aboutText)}</p>
      <aside class="highlight-box">
        <strong>Pontos de contato</strong>
        <p>${escapeHtml(contact || "Canal de atendimento orientado para reunioes comerciais.")}</p>
      </aside>
    </div>
  </section>`;
}

function renderProof(analysis, siteQuality) {
  const items = [
    { v: `${Math.max(siteQuality.score + 10, 80)}/100`, t: "Meta de profissionalismo do novo layout" },
    { v: `${Math.max((analysis.metrics && analysis.metrics.sectionCount) || 4, 4)} secoes`, t: "Arquitetura comercial aplicada" },
    { v: `${Math.max((analysis.metrics && analysis.metrics.ctaCount) || 2, 2)} CTAs`, t: "Pontos de conversao" },
  ];
  const html = items
    .map(
      (it) => `<article class="proof-card">
        <strong>${escapeHtml(it.v)}</strong>
        <span>${escapeHtml(it.t)}</span>
      </article>`
    )
    .join("");
  return `<section class="surface section" data-shot="proof">
    <div class="section-head">
      <h2>Indicadores de Conversao</h2>
      <span>Performance comercial</span>
    </div>
    <div class="proof-grid">${html}</div>
  </section>`;
}

function renderExplanation(leadDesignData, strategy, analysis, siteQuality) {
  return `<section class="surface section explanation" data-shot="explanation">
    <div class="section-head">
      <h2>Explicacao Estrategica</h2>
      <span>Resumo Executivo</span>
    </div>
    <div class="explain-grid">
      <article>
        <h3>Diagnostico inicial</h3>
        <p>Site original classificado como <strong>${escapeHtml(siteQuality.level)}</strong> (${siteQuality.score}/100), com foco de melhoria em hierarquia, contraste e conversao.</p>
      </article>
      <article>
        <h3>Template aplicado</h3>
        <p>Base profissional fixa <strong>${escapeHtml(strategy.templateName)}</strong>, com personalizacao por nome, nicho e dados reais do lead.</p>
      </article>
      <article>
        <h3>Objetivo comercial</h3>
        <p>Entregar uma pagina mais clara e convincente para acelerar contato qualificado e aumentar percepcao de valor.</p>
      </article>
    </div>
  </section>`;
}

function renderFinalCta(leadDesignData) {
  const primary = (leadDesignData.ctas || [])[0] || "Agendar reuniao";
  const secondary = (leadDesignData.ctas || [])[1] || "Solicitar proposta";
  return `<section class="surface final-cta" data-shot="cta">
    <h2>Vamos transformar o site em canal real de vendas?</h2>
    <p>Este conceito aplica estrutura profissional, contraste forte e CTA de alta visibilidade para elevar a conversao.</p>
    <div class="cta cta-inline">
      <button class="btn btn-primary">${escapeHtml(primary)}</button>
      <button class="btn btn-secondary">${escapeHtml(secondary)}</button>
    </div>
  </section>`;
}

function renderCover(leadDesignData, strategy) {
  return `<section class="surface cover" data-shot="cover">
    <p class="cover-eyebrow">CapLead • Relatorio de Prototipo</p>
    <h1 class="cover-title">${escapeHtml(leadDesignData.companyName || "Empresa")}</h1>
    <p class="cover-sub">Template ${escapeHtml(strategy.templateName)} com upgrade visual profissional e foco em conversao.</p>
  </section>`;
}

function renderSection(sectionName, payload) {
  if (sectionName === "header") return renderHeader(payload.leadDesignData, payload.strategy);
  if (sectionName === "hero") return renderHero(payload.leadDesignData, payload.strategy, payload.leadContext);
  if (sectionName === "servicos") return renderServices(payload.leadDesignData, payload.strategy, payload.leadContext);
  if (sectionName === "about") return renderAbout(payload.leadDesignData, payload.leadContext);
  if (sectionName === "prova") return renderProof(payload.analysis, payload.siteQuality);
  if (sectionName === "explicacao") return renderExplanation(payload.leadDesignData, payload.strategy, payload.analysis, payload.siteQuality);
  if (sectionName === "cta") return renderFinalCta(payload.leadDesignData);
  return "";
}

function buildPrototypeHtml({
  leadDesignData,
  leadContext,
  analysis,
  siteQuality,
  visualDNA,
  strategy,
}) {
  const templateName = strategy.templateName || "institucional_premium";
  const structure = layoutTemplateLibrary[templateName] || layoutTemplateLibrary.institucional_premium;

  // Regra obrigatoria: maximo 2 cores principais + 1 destaque
  const primaryColor = visualDNA.primaryColor;
  const secondaryColor = visualDNA.secondaryColor;
  const accentColor = visualDNA.accentColor;

  const sectionsHtml = structure
    .map((sectionName) =>
      renderSection(sectionName, { leadDesignData, leadContext, analysis, siteQuality, strategy })
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prototipo ${escapeHtml(leadDesignData.companyName || "Empresa")}</title>
  <style>
    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --accent: ${accentColor};
      --neutral-900: #0f172a;
      --neutral-700: #334155;
      --neutral-100: #e2e8f0;
      --neutral-50: #f8fafc;
      --shell-gap: 40px;
      --surface-padding: 36px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Inter", "Poppins", "Segoe UI", sans-serif;
      color: var(--neutral-900);
      background: linear-gradient(160deg, color-mix(in srgb, var(--primary) 10%, #ffffff), color-mix(in srgb, var(--secondary) 12%, #ffffff));
      line-height: 1.55;
      padding: 26px;
    }
    .shell { max-width: 1240px; margin: 0 auto; display: grid; gap: var(--shell-gap); }
    .surface {
      background: #ffffff;
      border: 1px solid color-mix(in srgb, var(--secondary) 22%, #ffffff);
      border-radius: 8px;
      padding: var(--surface-padding);
      box-shadow: 0 24px 44px rgba(15, 23, 42, 0.11);
    }
    .cover { background: linear-gradient(120deg, color-mix(in srgb, var(--primary) 12%, #ffffff), color-mix(in srgb, var(--accent) 8%, #ffffff)); }
    .cover-eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--secondary); font-weight: 700; }
    .cover-title { font-size: clamp(42px, 4.8vw, 64px); line-height: 1.02; margin: 12px 0 10px; letter-spacing: 0; }
    .cover-sub { color: var(--neutral-700); font-size: 18px; max-width: 72ch; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { width: 42px; height: 42px; border-radius: 6px; object-fit: contain; border: 1px solid var(--neutral-100); background: #fff; padding: 4px; }
    .logo-placeholder {
      width: 42px;
      height: 42px;
      border-radius: 6px;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .brand strong { display: block; font-size: 19px; letter-spacing: 0; }
    .brand span { font-size: 12px; color: var(--neutral-700); text-transform: uppercase; letter-spacing: 0.06em; }
    .topbar-right { display: flex; align-items: center; gap: 10px; }
    .chip { background: var(--secondary); color: #ffffff; padding: 7px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .hero-grid { display: grid; gap: 26px; align-items: center; grid-template-columns: 1.08fr 0.92fr; }
    .hero-image-left .hero-grid { grid-template-columns: 0.92fr 1.08fr; }
    .hero-centered .hero-grid { grid-template-columns: 1fr; text-align: center; }
    .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--secondary); font-weight: 700; }
    h1 { font-size: clamp(40px, 4.7vw, 62px); line-height: 1.04; margin: 12px 0 14px; letter-spacing: 0; }
    .hero-sub { max-width: 64ch; color: var(--neutral-700); font-size: 17px; }
    .hero-centered .hero-sub { margin: 0 auto; }
    .hero-visual { min-height: 320px; border-radius: 8px; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 42%, #ffffff), color-mix(in srgb, var(--accent) 35%, #ffffff)); border: 1px solid color-mix(in srgb, var(--secondary) 16%, #ffffff); }
    .hero-media { width: 100%; height: 100%; display: block; object-fit: cover; }
    .hero-visual-fallback { position: relative; width: 100%; height: 100%; min-height: 320px; }
    .shape { position: absolute; border-radius: 999px; opacity: 0.35; }
    .shape-a { width: 220px; height: 220px; top: 30px; left: 34px; background: var(--primary); }
    .shape-b { width: 160px; height: 160px; right: 30px; bottom: 30px; background: var(--secondary); }
    .shape-c { width: 90px; height: 90px; left: 52%; top: 43%; background: var(--accent); }
    .cta { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
    .cta-stack { flex-direction: column; align-items: flex-start; }
    .hero-centered .cta-stack { align-items: center; }
    .btn {
      border-radius: 8px;
      border: 0;
      padding: 14px 18px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
      cursor: default;
    }
    .btn-small { padding: 10px 13px; font-size: 12px; }
    .btn-primary { background: var(--primary); color: #ffffff; box-shadow: 0 12px 26px color-mix(in srgb, var(--primary) 42%, transparent); }
    .btn-secondary { background: color-mix(in srgb, var(--secondary) 12%, #ffffff); color: var(--neutral-900); border: 1px solid color-mix(in srgb, var(--secondary) 28%, #ffffff); }
    .section { display: grid; gap: 20px; }
    .section-head { display: flex; justify-content: space-between; gap: 12px; align-items: end; }
    h2 { font-size: clamp(28px, 3vw, 38px); line-height: 1.1; letter-spacing: 0; }
    h3 { letter-spacing: 0; }
    .section-head span { font-size: 12px; color: var(--neutral-700); letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; }
    .cards { display: grid; grid-template-columns: var(--cards-columns, repeat(3,minmax(0,1fr))); gap: 14px; }
    .card { border: 1px solid color-mix(in srgb, var(--secondary) 20%, #ffffff); border-radius: 8px; padding: 20px; background: color-mix(in srgb, var(--primary) 6%, #ffffff); }
    .card h3 { font-size: 18px; margin-bottom: 8px; letter-spacing: 0; }
    .card p { color: var(--neutral-700); font-size: 14px; }
    .about-grid { display: grid; grid-template-columns: 1.12fr 0.88fr; gap: 16px; align-items: stretch; }
    .about-grid p { color: var(--neutral-700); font-size: 16px; }
    .highlight-box { border: 1px solid color-mix(in srgb, var(--accent) 34%, #ffffff); border-radius: 8px; padding: 18px; background: color-mix(in srgb, var(--accent) 10%, #ffffff); display: grid; gap: 8px; }
    .highlight-box strong { font-size: 15px; }
    .proof-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
    .proof-card { border: 1px solid color-mix(in srgb, var(--secondary) 20%, #ffffff); border-radius: 8px; padding: 22px; background: color-mix(in srgb, var(--secondary) 9%, #ffffff); }
    .proof-card strong { display: block; font-size: 28px; line-height: 1.05; color: var(--secondary); margin-bottom: 6px; }
    .proof-card span { color: var(--neutral-700); font-size: 13px; }
    .explain-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
    .explain-grid article { border: 1px solid color-mix(in srgb, var(--secondary) 20%, #ffffff); border-radius: 8px; padding: 18px; background: color-mix(in srgb, var(--secondary) 6%, #ffffff); }
    .explain-grid h3 { font-size: 17px; margin-bottom: 8px; }
    .explain-grid p { color: var(--neutral-700); font-size: 14px; }
    .final-cta { text-align: center; display: grid; justify-items: center; gap: 14px; }
    .final-cta p { max-width: 70ch; color: var(--neutral-700); font-size: 16px; }
    @media (max-width: 1060px) {
      .cards { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .proof-grid, .explain-grid { grid-template-columns: 1fr; }
      .about-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 840px) {
      body { padding: 14px; }
      .surface { padding: 22px; }
      .hero-grid, .hero-image-left .hero-grid { grid-template-columns: 1fr; }
      .cards { grid-template-columns: 1fr; }
      .cover-title { font-size: clamp(34px, 9vw, 46px); }
    }
  </style>
</head>
<body>
  <main class="shell">
    ${renderCover(leadDesignData, strategy)}
    ${sectionsHtml}
  </main>
</body>
</html>`;
}

module.exports = {
  layoutTemplateLibrary,
  buildPrototypeHtml,
};
