/**
 * Gerador de protótipos HTML — sistema de componentes moderno por nicho.
 *
 * Padrões visuais inspirados em: ShadCN UI, MagicUI, ReactBits, 21st.dev, getdesigner.md
 * Implementados como HTML/CSS estático (sem dependência React em runtime).
 */

const { escapeHtml } = require('./utils');
const { resolveNicheConfig } = require('./nicheTemplates');

// Estrutura de seções por template — "explicacao" sempre presente para data-shot="explanation" (PDF)
const layoutTemplateLibrary = {
  high_ticket:          ['header', 'hero', 'trust', 'servicos', 'about', 'prova', 'explicacao', 'cta'],
  saas_moderno:         ['header', 'hero', 'servicos', 'prova', 'processo', 'about', 'explicacao', 'cta'],
  landing_conversao:    ['header', 'hero', 'trust', 'servicos', 'prova', 'explicacao', 'cta'],
  institucional_premium:['header', 'hero', 'about', 'servicos', 'processo', 'prova', 'explicacao', 'cta'],
};

// ─── Helpers de extração de conteúdo ────────────────────────────────────────

function firstText(leadDesignData, fallback) {
  return (leadDesignData.texts || []).find(t => t && t.length > 10) || fallback;
}

function findSectionText(leadDesignData, type) {
  const sec = (leadDesignData.sections || []).find(s => s.type === type);
  return sec ? (sec.texts || []).filter(Boolean) : [];
}

function getHeroContent(leadDesignData, leadContext, nicheConfig) {
  const proposal = leadContext?.proposta || leadContext?.proposal || '';
  const headlineRaw =
    leadDesignData.h1 ||
    (leadDesignData.texts || []).find(t => t.length >= 20 && t.length <= 90) ||
    `${nicheConfig.heroCopy.eyebrow} — ${leadDesignData.companyName}`;

  const subRaw =
    proposal ||
    (leadDesignData.texts || []).find(t => t.length >= 60 && t.length <= 220) ||
    `Solucões personalizadas para ${leadDesignData.companyName}. Atendimento focado em resultado e qualidade.`;

  return {
    headline: headlineRaw.length > 110 ? `${headlineRaw.slice(0, 107)}...` : headlineRaw,
    paragraph: subRaw.length > 240 ? `${subRaw.slice(0, 237)}...` : subRaw,
  };
}

function getServiceCards(leadDesignData, leadContext, nicheConfig) {
  const texts = findSectionText(leadDesignData, 'servicos');
  const source = texts.length ? texts : (leadDesignData.texts || []).slice(2, 14);
  const cards = [];
  for (const txt of source) {
    if (!txt || txt.length < 14) continue;
    cards.push({
      title: txt.length > 55 ? `${txt.slice(0, 52)}...` : txt,
      desc: txt,
    });
    if (cards.length >= 6) break;
  }
  if (!cards.length) {
    const n = nicheConfig.label;
    cards.push(
      { title: 'Atendimento personalizado', desc: `Solução completa para ${n} com foco em resultado e qualidade.` },
      { title: 'Equipe especializada', desc: 'Profissionais experientes para entregar o melhor serviço.' },
      { title: 'Resultados comprovados', desc: 'Metodologia testada para garantir satisfação total.' },
    );
  }
  return cards;
}

function renderLogo(leadDesignData) {
  if (leadDesignData.logo) {
    return `<img src="${escapeHtml(leadDesignData.logo)}" alt="Logo ${escapeHtml(leadDesignData.companyName)}" class="brand-img" />`;
  }
  const initials = (leadDesignData.companyName || 'EM')
    .split(' ').map(c => c[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="logo-placeholder">${escapeHtml(initials)}</div>`;
}

function buildHeroVisual(leadDesignData) {
  const img = (leadDesignData.images || [])[0]?.src || '';
  if (img) return `<img class="hero-media" src="${escapeHtml(img)}" alt="${escapeHtml(leadDesignData.companyName)}" />`;
  return `<div class="hero-visual-fallback">
    <div class="shape shape-a"></div>
    <div class="shape shape-b"></div>
    <div class="shape shape-c"></div>
  </div>`;
}

// ─── Renderização de seções ───────────────────────────────────────────────────

function renderHeader(leadDesignData, strategy, nicheConfig) {
  const cta = (leadDesignData.ctas || [])[0] || nicheConfig.heroCopy.ctaPrimary;
  return `<header class="surface topbar" data-shot="header">
    <div class="brand">
      ${renderLogo(leadDesignData)}
      <div class="brand-text">
        <strong>${escapeHtml(leadDesignData.companyName || 'Empresa')}</strong>
        <span>${escapeHtml(nicheConfig.label)}</span>
      </div>
    </div>
    <nav class="topbar-nav">
      <a href="#servicos">Serviços</a>
      <a href="#sobre">Sobre</a>
      <a href="#contato">Contato</a>
    </nav>
    <button class="btn btn-primary btn-sm">${escapeHtml(cta)}</button>
  </header>`;
}

function renderHero(leadDesignData, strategy, leadContext, nicheConfig) {
  const { headline, paragraph } = getHeroContent(leadDesignData, leadContext, nicheConfig);
  const ctaP = (leadDesignData.ctas || [])[0] || nicheConfig.heroCopy.ctaPrimary;
  const ctaS = (leadDesignData.ctas || [])[1] || nicheConfig.heroCopy.ctaSecondary;
  const heroVisual = buildHeroVisual(leadDesignData);
  const centered = strategy.heroVariant === 'centered';
  const imgLeft = strategy.heroVariant === 'image-left';
  const heroClass = centered ? 'hero hero-centered' : imgLeft ? 'hero hero-img-left' : 'hero hero-img-right';

  return `<section class="surface ${heroClass}" data-shot="hero">
    <div class="hero-grid">
      ${imgLeft ? `<div class="hero-visual">${heroVisual}</div>` : ''}
      <div class="hero-copy">
        <div class="eyebrow-wrap">
          <span class="eyebrow-dot"></span>
          <p class="eyebrow">${escapeHtml(nicheConfig.heroCopy.eyebrow)}</p>
        </div>
        <h1 class="hero-h1">${escapeHtml(headline)}</h1>
        <p class="hero-sub">${escapeHtml(paragraph)}</p>
        <div class="hero-cta">
          <button class="btn btn-primary btn-shimmer">${escapeHtml(ctaP)}</button>
          <button class="btn btn-ghost">${escapeHtml(ctaS)}</button>
        </div>
        <div class="hero-badges">
          ${nicheConfig.trustBadges.slice(0, 3).map(b =>
            `<span class="mini-badge">&#10003; ${escapeHtml(b)}</span>`
          ).join('')}
        </div>
      </div>
      ${!imgLeft && !centered ? `<div class="hero-visual">${heroVisual}</div>` : ''}
      ${centered ? `<div class="hero-visual hero-visual-center">${heroVisual}</div>` : ''}
    </div>
  </section>`;
}

function renderTrust(leadDesignData, nicheConfig) {
  const badges = nicheConfig.trustBadges;
  const items = badges.map(b =>
    `<div class="trust-item"><span class="trust-check">&#10003;</span><span>${escapeHtml(b)}</span></div>`
  ).join('');
  return `<section class="surface trust-bar" data-shot="trust">
    <p class="trust-label">Por que escolher a ${escapeHtml(leadDesignData.companyName || 'empresa')}?</p>
    <div class="trust-items">${items}</div>
  </section>`;
}

function renderServicos(leadDesignData, strategy, leadContext, nicheConfig) {
  const cards = getServiceCards(leadDesignData, leadContext, nicheConfig);
  const icons = ['◈', '◆', '◉', '⬡', '◎', '⬢'];
  const cardsHtml = cards.map((item, i) =>
    `<article class="card" id="servicos">
      <div class="card-icon">${icons[i % icons.length]}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.desc.length > 120 ? item.desc.slice(0, 117) + '...' : item.desc)}</p>
    </article>`
  ).join('');

  return `<section class="surface section" data-shot="services">
    <div class="section-head">
      <div>
        <p class="eyebrow">${escapeHtml(nicheConfig.sectionLabels.servicesEyebrow)}</p>
        <h2>${escapeHtml(nicheConfig.sectionLabels.services)}</h2>
      </div>
    </div>
    <div class="cards cards-3">${cardsHtml}</div>
  </section>`;
}

function renderAbout(leadDesignData, leadContext, nicheConfig) {
  const aboutText =
    findSectionText(leadDesignData, 'sobre')[0] ||
    leadContext?.proposta ||
    firstText(leadDesignData, `A ${leadDesignData.companyName || 'empresa'} é referência no segmento de ${nicheConfig.label.toLowerCase()}. Nossa missão é entregar qualidade e cuidado em cada atendimento.`);

  const contact = [
    leadDesignData.contactInfo?.email && `Email: ${leadDesignData.contactInfo.email}`,
    leadDesignData.contactInfo?.phone && `Tel: ${leadDesignData.contactInfo.phone}`,
    leadDesignData.contactInfo?.whatsapp && 'WhatsApp disponível',
  ].filter(Boolean).join('  ·  ');

  return `<section class="surface section" data-shot="about" id="sobre">
    <div class="about-grid">
      <div class="about-text">
        <p class="eyebrow">${escapeHtml(nicheConfig.sectionLabels.about)}</p>
        <h2>Sobre nós</h2>
        <p class="about-p">${escapeHtml(aboutText.length > 400 ? aboutText.slice(0, 397) + '...' : aboutText)}</p>
        ${contact ? `<p class="about-contact">${escapeHtml(contact)}</p>` : ''}
      </div>
      <aside class="about-highlight">
        <p class="highlight-title">Nosso diferencial</p>
        <ul class="highlight-list">
          ${nicheConfig.trustBadges.map(b => `<li>&#10003; ${escapeHtml(b)}</li>`).join('')}
        </ul>
        <button class="btn btn-primary" style="margin-top:20px">${escapeHtml(nicheConfig.heroCopy.ctaPrimary)}</button>
      </aside>
    </div>
  </section>`;
}

function renderProva(leadDesignData, analysis, siteQuality, nicheConfig) {
  const baseValue = (v) => {
    if (v > 0) return `${v}`;
    return Math.floor(Math.random() * 400 + 100).toString();
  };

  const stats = nicheConfig.proofStats.map((stat, i) => {
    const rawV = i === 0
      ? baseValue((analysis?.metrics?.sectionCount || 0) * 40)
      : i === 1
        ? baseValue(Math.max(siteQuality?.score > 60 ? 8 : 3, 3))
        : null;
    const display = stat.value || (rawV ? `${rawV}${stat.suffix || ''}` : `–${stat.suffix || ''}`);
    return `<article class="stat-card">
      <span class="stat-number gradient-text">${escapeHtml(display)}</span>
      <span class="stat-label">${escapeHtml(stat.label)}</span>
    </article>`;
  }).join('');

  return `<section class="surface section" data-shot="proof">
    <div class="section-head">
      <div>
        <p class="eyebrow">${escapeHtml(nicheConfig.sectionLabels.proofEyebrow)}</p>
        <h2>${escapeHtml(nicheConfig.sectionLabels.proof)}</h2>
      </div>
    </div>
    <div class="cards cards-3">${stats}</div>
  </section>`;
}

function renderProcesso(leadDesignData, nicheConfig) {
  const steps = nicheConfig.processoSteps;
  const stepsHtml = steps.map(s =>
    `<div class="step">
      <div class="step-num">${escapeHtml(s.n)}</div>
      <div class="step-body">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.desc)}</p>
      </div>
    </div>`
  ).join('');

  return `<section class="surface section" data-shot="processo">
    <div class="section-head">
      <div>
        <p class="eyebrow">${escapeHtml(nicheConfig.sectionLabels.process)}</p>
        <h2>Como funciona</h2>
      </div>
    </div>
    <div class="steps">${stepsHtml}</div>
  </section>`;
}

function renderExplicacao(leadDesignData, strategy, analysis, siteQuality, nicheConfig) {
  return `<section class="surface section explanation" data-shot="explanation">
    <div class="section-head">
      <div>
        <p class="eyebrow">Relatório de protótipo — CapLead</p>
        <h2>Resumo estratégico</h2>
      </div>
    </div>
    <div class="cards cards-3">
      <article class="card explain-card">
        <div class="card-icon">◈</div>
        <h3>Diagnóstico atual</h3>
        <p>Site original classificado como <strong>${escapeHtml(siteQuality.level || 'médio')}</strong> (${siteQuality.score || 0}/100). Foco em hierarquia visual, CTAs e conversão.</p>
      </article>
      <article class="card explain-card">
        <div class="card-icon">◆</div>
        <h3>Template aplicado</h3>
        <p>Estrutura <strong>${escapeHtml(strategy.templateName)}</strong> com personalização de nicho, copy e identidade visual da empresa.</p>
      </article>
      <article class="card explain-card">
        <div class="card-icon">◉</div>
        <h3>Objetivo comercial</h3>
        <p>Protótipo orientado a conversão: hierarquia clara, CTAs de alto impacto e prova social para o nicho ${escapeHtml(nicheConfig.label)}.</p>
      </article>
    </div>
  </section>`;
}

function renderCta(leadDesignData, nicheConfig) {
  return `<section class="surface cta-final" data-shot="cta" id="contato">
    <div class="cta-content">
      <p class="eyebrow-light">Pronto para começar?</p>
      <h2>${escapeHtml(nicheConfig.ctaFinal)}</h2>
      <p class="cta-sub">${escapeHtml(nicheConfig.ctaFinalSub)}</p>
      <div class="cta-btns">
        <button class="btn btn-white btn-shimmer">${escapeHtml(nicheConfig.heroCopy.ctaPrimary)}</button>
        <button class="btn btn-outline-white">${escapeHtml(nicheConfig.heroCopy.ctaSecondary)}</button>
      </div>
    </div>
  </section>`;
}

function renderCover(leadDesignData, strategy, nicheConfig) {
  return `<section class="surface cover" data-shot="cover">
    <p class="cover-eyebrow">CapLead · Protótipo de Redesign</p>
    <h1 class="cover-title">${escapeHtml(leadDesignData.companyName || 'Empresa')}</h1>
    <p class="cover-niche">${escapeHtml(nicheConfig.label)}</p>
    <p class="cover-sub">Template <strong>${escapeHtml(strategy.templateName)}</strong> com identidade de nicho e foco em conversão.</p>
  </section>`;
}

// ─── Roteador de seções ───────────────────────────────────────────────────────

function renderSection(name, p) {
  if (name === 'header')     return renderHeader(p.leadDesignData, p.strategy, p.nicheConfig);
  if (name === 'hero')       return renderHero(p.leadDesignData, p.strategy, p.leadContext, p.nicheConfig);
  if (name === 'trust')      return renderTrust(p.leadDesignData, p.nicheConfig);
  if (name === 'servicos')   return renderServicos(p.leadDesignData, p.strategy, p.leadContext, p.nicheConfig);
  if (name === 'about')      return renderAbout(p.leadDesignData, p.leadContext, p.nicheConfig);
  if (name === 'prova')      return renderProva(p.leadDesignData, p.analysis, p.siteQuality, p.nicheConfig);
  if (name === 'processo')   return renderProcesso(p.leadDesignData, p.nicheConfig);
  if (name === 'explicacao') return renderExplicacao(p.leadDesignData, p.strategy, p.analysis, p.siteQuality, p.nicheConfig);
  if (name === 'cta')        return renderCta(p.leadDesignData, p.nicheConfig);
  return '';
}

// ─── CSS do sistema de componentes ───────────────────────────────────────────

function buildCss(visualDNA, nicheConfig) {
  const { primaryColor: p, secondaryColor: s, accentColor: a } = visualDNA;
  const fontQ = nicheConfig.fontPair?.heading
    ? `family=${nicheConfig.fontPair.heading}&family=${nicheConfig.fontPair.body}&display=swap`
    : 'family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap';

  return `
  /* Google Fonts — carregado do CDN */
  @import url('https://fonts.googleapis.com/css2?${fontQ}');

  /* ═══ Design Tokens (ShadCN / getdesigner.md inspired) ═══ */
  :root {
    --primary:   ${p};
    --secondary: ${s};
    --accent:    ${a};
    --primary-5:  color-mix(in srgb, var(--primary)   5%, #fff);
    --primary-10: color-mix(in srgb, var(--primary)  10%, #fff);
    --primary-20: color-mix(in srgb, var(--primary)  20%, #fff);
    --secondary-10: color-mix(in srgb, var(--secondary) 10%, #fff);
    --accent-10:    color-mix(in srgb, var(--accent)    10%, #fff);
    --ink:   #0f172a;
    --ink-2: #334155;
    --ink-3: #64748b;
    --line:  #e2e8f0;
    --bg:    #f8fafc;
    --surface: #ffffff;
    --radius-sm: 6px;
    --radius:    12px;
    --radius-lg: 18px;
    --radius-full: 9999px;
    --shadow-sm: 0 1px 3px rgba(15,23,42,.07), 0 1px 2px rgba(15,23,42,.04);
    --shadow:    0 4px 16px rgba(15,23,42,.08), 0 2px 6px rgba(15,23,42,.04);
    --shadow-lg: 0 16px 40px rgba(15,23,42,.10), 0 4px 12px rgba(15,23,42,.05);
    --shell-gap:       40px;
    --surface-padding: 40px;
  }

  /* ═══ Reset base ═══ */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    color: var(--ink);
    background: linear-gradient(160deg,
      color-mix(in srgb, var(--primary) 6%, #fff) 0%,
      color-mix(in srgb, var(--secondary) 8%, #fff) 100%);
    line-height: 1.6;
    padding: 24px;
    min-height: 100vh;
  }
  h1, h2, h3, h4 { font-family: 'Plus Jakarta Sans', 'Playfair Display', 'Space Grotesk', 'Fraunces', 'Inter', sans-serif; line-height: 1.1; letter-spacing: -0.01em; }

  /* ═══ Shell / Layout ═══ */
  .shell { max-width: 1260px; margin: 0 auto; display: grid; gap: var(--shell-gap); }
  .surface {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    padding: var(--surface-padding);
    box-shadow: var(--shadow-lg);
  }

  /* ═══ Tipografia ═══ */
  h1 { font-size: clamp(38px, 4.5vw, 60px); }
  h2 { font-size: clamp(26px, 2.8vw, 38px); }
  h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
  .eyebrow {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .1em; color: var(--secondary);
  }
  .eyebrow-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .eyebrow-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent); flex-shrink: 0;
  }

  /* Gradient text — MagicUI inspired */
  .gradient-text {
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 60%, var(--accent) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-h1 { margin: 8px 0 16px; }

  /* ═══ Header / Topbar ═══ */
  .topbar {
    display: flex; align-items: center; gap: 16px;
    padding: 16px 28px;
    position: sticky; top: 12px; z-index: 100;
    background: rgba(255,255,255,.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .brand { display: flex; align-items: center; gap: 10px; flex: 1; }
  .brand-img {
    width: 40px; height: 40px; border-radius: var(--radius-sm);
    object-fit: contain; border: 1px solid var(--line); background: #fff; padding: 4px;
  }
  .logo-placeholder {
    width: 40px; height: 40px; border-radius: var(--radius-sm); flex-shrink: 0;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: #fff; font-size: 13px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .brand-text strong { display: block; font-size: 17px; font-weight: 700; }
  .brand-text span   { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; }
  .topbar-nav { display: flex; gap: 28px; }
  .topbar-nav a { font-size: 14px; font-weight: 500; color: var(--ink-2); text-decoration: none; }

  /* ═══ Hero ═══ */
  .hero { overflow: hidden; }
  .hero-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 40px; align-items: center; }
  .hero-img-left  .hero-grid { grid-template-columns: .9fr 1.1fr; }
  .hero-centered  .hero-grid { grid-template-columns: 1fr; text-align: center; justify-items: center; }
  .hero-sub { max-width: 60ch; color: var(--ink-2); font-size: 17px; line-height: 1.65; margin-bottom: 8px; }
  .hero-centered .hero-sub { margin: 0 auto 8px; }
  .hero-cta { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
  .hero-centered .hero-cta { justify-content: center; }
  .hero-badges { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
  .hero-centered .hero-badges { justify-content: center; }
  .mini-badge {
    font-size: 11px; font-weight: 600; color: var(--ink-2);
    background: var(--primary-5); border: 1px solid var(--primary-20);
    border-radius: var(--radius-full); padding: 4px 10px;
  }
  .hero-visual {
    border-radius: var(--radius); overflow: hidden; min-height: 320px;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--primary) 45%, #fff),
      color-mix(in srgb, var(--accent)  35%, #fff));
    border: 1px solid var(--line); position: relative;
  }
  .hero-visual-center { max-width: 700px; width: 100%; min-height: 220px; }
  .hero-media { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hero-visual-fallback { width: 100%; height: 100%; min-height: 320px; position: relative; overflow: hidden; }
  .shape { position: absolute; border-radius: 50%; opacity: .28; }
  .shape-a { width: 240px; height: 240px; top: 20px; left: 20px; background: var(--primary); }
  .shape-b { width: 170px; height: 170px; right: 20px; bottom: 20px; background: var(--secondary); }
  .shape-c { width: 100px; height: 100px; left: 50%; top: 40%; background: var(--accent); }

  /* ═══ Trust bar — 21st.dev pattern ═══ */
  .trust-bar { padding: 20px 28px; }
  .trust-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); margin-bottom: 12px; }
  .trust-items { display: flex; gap: 24px; flex-wrap: wrap; }
  .trust-item { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--ink-2); }
  .trust-check { color: var(--accent); font-weight: 900; }

  /* ═══ Section layout ═══ */
  .section { display: grid; gap: 28px; }
  .section-head { margin-bottom: 4px; }
  .section-head h2 { margin-top: 6px; }

  /* ═══ Cards — ShadCN + ReactBits bento inspired ═══ */
  .cards { display: grid; gap: 16px; }
  .cards-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .card {
    border: 1px solid var(--line); border-radius: var(--radius);
    padding: 24px; background: #fff;
    transition: box-shadow .2s, transform .2s;
    position: relative; overflow: hidden;
  }
  .card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg, var(--primary), var(--accent));
    opacity: 0; transition: opacity .2s;
  }
  .card-icon {
    font-size: 22px; color: var(--primary); margin-bottom: 12px;
    width: 44px; height: 44px; border-radius: var(--radius-sm);
    background: var(--primary-10); display: flex; align-items: center; justify-content: center;
  }
  .card h3 { font-size: 17px; margin-bottom: 8px; }
  .card p { color: var(--ink-2); font-size: 14px; line-height: 1.6; }
  .explain-card .card-icon { background: var(--secondary-10); color: var(--secondary); }

  /* ═══ Stat cards — MagicUI number display ═══ */
  .stat-card {
    text-align: center; padding: 32px 20px;
    border: 1px solid var(--line); border-radius: var(--radius);
    background: linear-gradient(160deg, #fff 60%, var(--primary-5));
  }
  .stat-number {
    display: block; font-size: 3rem; font-weight: 900; line-height: 1;
    margin-bottom: 8px; font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .stat-label { font-size: 13px; color: var(--ink-3); font-weight: 500; }

  /* ═══ About ═══ */
  .about-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 28px; align-items: start; }
  .about-text h2 { margin: 6px 0 14px; }
  .about-p { color: var(--ink-2); font-size: 16px; line-height: 1.75; }
  .about-contact { font-size: 13px; color: var(--ink-3); margin-top: 16px; }
  .about-highlight {
    border: 1px solid var(--accent-10); border-radius: var(--radius);
    padding: 24px; background: var(--accent-10);
  }
  .highlight-title { font-weight: 700; font-size: 15px; margin-bottom: 12px; }
  .highlight-list { list-style: none; display: grid; gap: 8px; }
  .highlight-list li { font-size: 14px; color: var(--ink-2); font-weight: 500; }

  /* ═══ Processo / Steps ═══ */
  .steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
  .step { display: flex; gap: 16px; align-items: flex-start; }
  .step-num {
    width: 40px; height: 40px; border-radius: var(--radius-full); flex-shrink: 0;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: #fff; font-size: 16px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .step-body h3 { font-size: 16px; margin-bottom: 6px; }
  .step-body p  { font-size: 14px; color: var(--ink-2); line-height: 1.6; }

  /* ═══ CTA final — gradient escuro ═══ */
  .cta-final {
    background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #000) 100%);
    border-color: transparent; text-align: center;
  }
  .cta-content { display: grid; justify-items: center; gap: 12px; }
  .eyebrow-light { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: rgba(255,255,255,.65); }
  .cta-final h2 { color: #fff; max-width: 18ch; }
  .cta-sub { color: rgba(255,255,255,.75); font-size: 16px; max-width: 52ch; }
  .cta-btns { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
  .btn-white { background: #fff; color: var(--primary); font-weight: 700; }
  .btn-outline-white { background: transparent; color: #fff; border: 2px solid rgba(255,255,255,.4); font-weight: 600; }

  /* ═══ Cover (PDF) ═══ */
  .cover {
    background: linear-gradient(130deg,
      color-mix(in srgb, var(--primary) 12%, #fff),
      color-mix(in srgb, var(--accent)  8%,  #fff));
    padding: 56px var(--surface-padding);
  }
  .cover-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--secondary); font-weight: 700; margin-bottom: 16px; }
  .cover-title { font-size: clamp(40px, 5vw, 66px); line-height: 1.02; }
  .cover-niche { font-size: 16px; color: var(--secondary); font-weight: 600; margin: 8px 0; }
  .cover-sub { color: var(--ink-2); font-size: 16px; max-width: 72ch; margin-top: 12px; }

  /* ═══ Buttons — MagicUI shimmer ═══ */
  .btn {
    border-radius: var(--radius-sm); border: 0; padding: 13px 20px;
    font-size: 14px; font-weight: 700; cursor: default;
    white-space: nowrap; position: relative; overflow: hidden;
  }
  .btn-sm { padding: 9px 14px; font-size: 12px; }
  .btn-primary {
    background: var(--primary); color: #fff;
    box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 38%, transparent);
  }
  .btn-ghost {
    background: var(--primary-10); color: var(--primary);
    border: 1px solid var(--primary-20); font-weight: 600;
  }

  /* Shimmer — MagicUI */
  .btn-shimmer::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 55%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
    animation: shimmer 2.4s ease infinite;
  }
  @keyframes shimmer { to { left: 150%; } }

  /* ═══ Responsivo ═══ */
  @media (max-width: 1060px) {
    .cards-3   { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .about-grid { grid-template-columns: 1fr; }
    .steps     { grid-template-columns: 1fr; }
  }
  @media (max-width: 820px) {
    body { padding: 12px; }
    .surface { padding: 24px; }
    .hero-grid, .hero-img-left .hero-grid { grid-template-columns: 1fr; }
    .hero-visual { display: none; }
    .cards-3 { grid-template-columns: 1fr; }
    .topbar-nav { display: none; }
  }
`.trim();
}

// ─── Função principal ─────────────────────────────────────────────────────────

function buildPrototypeHtml({ leadDesignData, leadContext, analysis, siteQuality, visualDNA, strategy }) {
  const nicheConfig = resolveNicheConfig(
    leadDesignData?.niche || '',
    { nicho: leadContext?.nicho, nome: leadDesignData?.companyName, categoria: leadDesignData?.categoria }
  );

  const templateName = strategy.templateName || 'institucional_premium';
  const structure = layoutTemplateLibrary[templateName] || layoutTemplateLibrary.institucional_premium;
  const css = buildCss(visualDNA, nicheConfig);

  const payload = { leadDesignData, leadContext, analysis, siteQuality, strategy, nicheConfig };
  const sectionsHtml = structure.map(name => renderSection(name, payload)).join('\n');

  const fontQ = nicheConfig.fontPair?.heading
    ? `family=${nicheConfig.fontPair.heading}&family=${nicheConfig.fontPair.body}&display=swap`
    : 'family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Protótipo — ${escapeHtml(leadDesignData.companyName || 'Empresa')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?${fontQ}" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
  <main class="shell">
    ${renderCover(leadDesignData, strategy, nicheConfig)}
    ${sectionsHtml}
  </main>
</body>
</html>`;
}

module.exports = { layoutTemplateLibrary, buildPrototypeHtml };
