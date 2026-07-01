const puppeteer = require('puppeteer');
const crud = require('./crud');
const { getBrowserPath } = require('./browserPath');

/**
 * Realiza uma auditoria técnica real usando o Puppeteer.
 * Coleta métricas de performance (FCP, LCP, CLS), SEO e Mobile.
 */
/**
 * Realiza uma auditoria técnica real usando o Puppeteer.
 * Coleta métricas de performance (FCP, LCP, CLS), SEO, UX e Mobile.
 * Pesos Revisados (T7): Performance (30%), SEO (25%), UX (25%), Mobile (20%).
 */
async function runTechnicalAudit(page) {
    return await page.evaluate(async () => {
        const metrics = {
            performance: { fcp: 0, lcp: 0, cls: 0, tbt: 0, domNodes: 0, score: 0, max: 30 },
            seo: { title: false, meta: false, h1: false, headings: false, ssl: false, lang: false, altTags: 0, robots: false, score: 0, max: 25 },
            ux: { modernLayout: false, fonts: false, cta: false, favicon: false, consoleErrors: 0, score: 0, max: 25 },
            mobile: { viewport: false, mediaQueries: false, tapTargets: 0, fontSize: false, score: 0, max: 20 },
            issues: []
        };

        const addIssue = (category, msg) => metrics.issues.push(`${category}: ${msg}`);

        // --- 1. PERFORMANCE (30 pts Max) ---
        let perfPoints = 0;
        
        // FCP (6 pts)
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
        if (fcpEntry) {
            metrics.performance.fcp = fcpEntry.startTime;
            if (metrics.performance.fcp < 1200) perfPoints += 6;
            else if (metrics.performance.fcp < 2500) perfPoints += 3;
            else addIssue("Performance", "Carregamento inicial (FCP) lento (" + (metrics.performance.fcp/1000).toFixed(1) + "s).");
        }

        // LCP (8 pts)
        if (window.lcpValue !== undefined && window.lcpValue > 0) {
            metrics.performance.lcp = window.lcpValue;
            if (metrics.performance.lcp < 2500) perfPoints += 8;
            else if (metrics.performance.lcp < 4000) perfPoints += 4;
            else addIssue("Performance", "Maior elemento visual (LCP) demora a carregar (" + (metrics.performance.lcp/1000).toFixed(1) + "s).");
        } else {
            perfPoints += 4;
        }
        
        // CLS (6 pts)
        if (window.clsValue !== undefined) {
            metrics.performance.cls = window.clsValue;
            if (metrics.performance.cls < 0.1) perfPoints += 6;
            else if (metrics.performance.cls < 0.25) perfPoints += 3;
            else addIssue("Performance", "Instabilidade no layout (CLS) detectada (" + metrics.performance.cls.toFixed(2) + ").");
        } else {
            perfPoints += 6;
        }

        // TBT Heuristic (6 pts)
        // Heurística baseada no tempo de execução de scripts capturados pelo observer
        const longTasks = performance.getEntriesByType('longtask');
        const totalLongTaskTime = longTasks.reduce((sum, task) => sum + (task.duration - 50), 0);
        metrics.performance.tbt = totalLongTaskTime;
        if (totalLongTaskTime < 200) perfPoints += 6;
        else if (totalLongTaskTime < 600) perfPoints += 3;
        else addIssue("Performance", "Execução pesada de JavaScript detectada (" + Math.round(totalLongTaskTime) + "ms TBT).");
        
        // DOM Size (4 pts)
        const domSize = document.querySelectorAll('*').length;
        metrics.performance.domNodes = domSize;
        if (domSize < 1200) perfPoints += 4;
        else if (domSize < 2500) perfPoints += 2;
        else addIssue("Performance", "Página com muitos elementos no DOM (" + domSize + ").");
        
        metrics.performance.score = Math.min(metrics.performance.max, perfPoints);

        // --- 2. SEO (25 pts Max) ---
        let seoPoints = 0;
        
        // Title & Meta (8 pts)
        const titleTag = document.title;
        const hasTitle = titleTag && titleTag.length > 20;
        const metaDesc = document.querySelector('meta[name="description"]');
        const hasMeta = metaDesc && metaDesc.content.length > 50;
        if (hasTitle) { seoPoints += 4; metrics.seo.title = true; } else addIssue("SEO", "Título da página ausente ou muito curto.");
        if (hasMeta) { seoPoints += 4; metrics.seo.meta = true; } else addIssue("SEO", "Meta description (resumo Google) ausente ou irrelevante.");

        // Hierarchy & Lang (7 pts)
        const h1s = document.querySelectorAll('h1');
        if (h1s.length === 1) { seoPoints += 4; metrics.seo.h1 = true; }
        else if (h1s.length > 1) addIssue("SEO", "Múltiplas tags H1 encontradas.");
        else addIssue("SEO", "Tag H1 principal não encontrada.");

        if (document.documentElement.lang) { seoPoints += 3; metrics.seo.lang = true; } else addIssue("SEO", "Atributo 'lang' ausente na tag HTML.");

        // Image Alt & Robots (10 pts)
        const images = Array.from(document.querySelectorAll('img'));
        const imagesWithoutAlt = images.filter(img => !img.alt || img.alt.trim().length === 0);
        metrics.seo.altTags = images.length - imagesWithoutAlt.length;
        if (images.length === 0 || imagesWithoutAlt.length === 0) seoPoints += 6;
        else {
            const ratio = (images.length - imagesWithoutAlt.length) / images.length;
            if (ratio > 0.8) seoPoints += 6;
            else if (ratio > 0.5) seoPoints += 3;
            else addIssue("SEO", imagesWithoutAlt.length + " imagens sem descrição (alt text).");
        }

        const metaRobots = document.querySelector('meta[name="robots"]');
        if (metaRobots || window.location.protocol === 'https:') { seoPoints += 4; metrics.seo.robots = true; } 
        else addIssue("SEO", "Meta robots ou HTTPS ausente (prejudica indexação).");

        metrics.seo.score = Math.min(metrics.seo.max, seoPoints);

        // --- 3. UX / DESIGN (25 pts Max) ---
        let uxPoints = 0;
        
        // Modern Layout (10 pts)
        const html = document.documentElement.innerHTML.toLowerCase();
        const hasModernLayout = html.includes('display:flex') || html.includes('display: flex') || html.includes('display:grid') || html.includes('tailwind') || html.includes('bootstrap');
        if (hasModernLayout) { uxPoints += 10; metrics.ux.modernLayout = true; } else addIssue("Design", "Layout parece antiquado (tabelas/floats).");

        // Typography & Brand (8 pts)
        const hasWebFonts = html.includes('fonts.googleapis.com') || html.includes('adobe') || html.includes('@font-face');
        if (hasWebFonts) { uxPoints += 8; metrics.ux.fonts = true; } else addIssue("Design", "Uso exclusivo de fontes padrão do sistema.");

        // CTA & Favicon (7 pts)
        const ctas = document.querySelectorAll('button, .btn, .button, a[role="button"], input[type="submit"]');
        const hasFavicon = !!document.querySelector('link[rel*="icon"]');
        if (ctas.length >= 1) { uxPoints += 4; metrics.ux.cta = true; } else addIssue("UX", "Nenhum botão de ação (CTA) em destaque.");
        if (hasFavicon) { uxPoints += 3; metrics.ux.favicon = true; } else addIssue("UX", "Site sem ícone de marca (favicon).");

        metrics.ux.score = Math.min(metrics.ux.max, uxPoints);

        // --- 4. MOBILE (20 pts Max) ---
        let mobilePoints = 0;
        
        // Viewport (10 pts)
        if (document.querySelector('meta[name="viewport"]')) { mobilePoints += 10; metrics.mobile.viewport = true; }
        else addIssue("Mobile", "Site não configurado para celulares (viewport).");

        // Touch Targets & Size (10 pts)
        const interactive = Array.from(document.querySelectorAll('button, a, input, select'));
        const smallOnes = interactive.filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.width < 40 || r.height < 40); // 40px base touch
        });
        metrics.mobile.tapTargets = smallOnes.length;
        
        const baseFontSize = parseInt(window.getComputedStyle(document.body).fontSize);
        if (baseFontSize >= 14) { mobilePoints += 5; metrics.mobile.fontSize = true; } else addIssue("Mobile", "Fontes muito pequenas para telas mobile.");
        
        if (smallOnes.length < 5) mobilePoints += 5;
        else addIssue("Mobile", "Elementos clicáveis muito pequenos ou próximos.");

        metrics.mobile.score = Math.min(metrics.mobile.max, mobilePoints);

        // --- 5. IMAGENS (até -15 pts de penalidade) ---
        let imagePenalty = 0;
        const allImgs = Array.from(document.querySelectorAll('img'));
        if (allImgs.length > 0) {
          const withoutLazy = allImgs.filter(img => img.getAttribute('loading') !== 'lazy').length;
          const withoutDims = allImgs.filter(img => !img.getAttribute('width') || !img.getAttribute('height')).length;
          const legacyFmt = allImgs.filter(img => /\.(jpg|jpeg|png|gif)(\?|$)/i.test(img.src)).length;
          if (withoutLazy > 3) { imagePenalty += 5; addIssue('Performance', `${withoutLazy} imagens sem lazy loading (aumenta tempo de carregamento).`); }
          if (withoutDims > 3) { imagePenalty += 5; addIssue('Performance', `${withoutDims} imagens sem largura/altura definida (causa instabilidade de layout).`); }
          if (legacyFmt > 2 && legacyFmt / allImgs.length > 0.5) { imagePenalty += 5; addIssue('Performance', 'Imagens em formato legado (JPG/PNG) — WebP reduziria até 35% do tamanho.'); }
        }

        // --- 6. CSS BLOQUEANTE (até -10 pts de penalidade) ---
        let cssPenalty = 0;
        const blockingSheets = document.querySelectorAll('link[rel="stylesheet"]:not([media="print"])');
        const preloadedSheets = document.querySelectorAll('link[rel="preload"][as="style"]');
        const hasGoogleFontsSwap = html.includes('display=swap') || html.includes('font-display:swap');
        if (blockingSheets.length > 3 && preloadedSheets.length === 0) {
          cssPenalty += 5;
          addIssue('Performance', `${blockingSheets.length} folhas CSS bloqueantes no carregamento sem preload configurado.`);
        }
        if (html.includes('fonts.googleapis.com') && !hasGoogleFontsSwap) {
          cssPenalty += 5;
          addIssue('Design', 'Google Fonts sem font-display:swap — bloqueia renderização do texto.');
        }

        const totalScore = metrics.performance.score + metrics.seo.score + metrics.ux.score + metrics.mobile.score - imagePenalty - cssPenalty;
        
        return {
            score: Math.round(totalScore),
            issues: metrics.issues,
            details: {
                performance: metrics.performance.score,
                seo: metrics.seo.score,
                ux: metrics.ux.score,
                mobile: metrics.mobile.score,
                full: metrics
            }
        };
    });
}

/**
 * Analisador Estático Heurístico (Para quando temos apenas o HTML bruto)
 */
function processHtmlAndGetScore(html) {
    const lowerHtml = html.toLowerCase();
    const metrics = {
        performance: 15, // Média conservadora para análise estática
        seo: 0,
        ux: 0,
        mobile: 0,
        issues: []
    };

    // SEO (Max 25)
    if (lowerHtml.includes('<title>')) metrics.seo += 8;
    if (lowerHtml.includes('name="description"')) metrics.seo += 8;
    if (lowerHtml.includes('<h1')) metrics.seo += 9;
    if (metrics.seo < 15) metrics.issues.push("SEO: Metadados básicos ou H1 ausentes.");

    // UX (Max 25)
    if (lowerHtml.includes('display: flex') || lowerHtml.includes('display:flex') || lowerHtml.includes('display: grid') || lowerHtml.includes('tailwind') || lowerHtml.includes('bootstrap')) metrics.ux += 15;
    if (lowerHtml.includes('fonts.googleapis.com') || lowerHtml.includes('@font-face')) metrics.ux += 10;
    if (metrics.ux < 15) metrics.issues.push("Design: Site parece não utilizar padrões visuais modernos.");

    // Mobile (Max 20)
    if (lowerHtml.includes('name="viewport"')) metrics.mobile += 10;
    if (lowerHtml.includes('@media')) metrics.mobile += 10;
    if (metrics.mobile < 15) metrics.issues.push("Mobile: Ausência de tags de responsividade.");

    return {
        score: Math.min(100, metrics.performance + metrics.seo + metrics.ux + metrics.mobile),
        issues: metrics.issues,
        details: {
            performance: metrics.performance,
            seo: metrics.seo,
            ux: metrics.ux,
            mobile: metrics.mobile
        }
    };
}

/**
 * Função conectora disparada pelo IPC para extração isolada por site
 */
async function capturarEValidar(leadId, url, table = 'leads_sites') {
  let browser;
  const formattedUrl = url.startsWith('http') ? url : `http://${url}`;
  const executablePath = getBrowserPath();

  const runAnalysis = async (currentTimeout) => {
    browser = await puppeteer.launch({ 
      headless: true,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Injeta observer para performance antes de navegar
    await page.evaluateOnNewDocument(() => {
        window.clsValue = 0;
        window.lcpValue = 0;
        try {
            new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (entry.entryType === 'layout-shift') {
                        if (!entry.hadRecentInput) window.clsValue += entry.value;
                    }
                }
            }).observe({ type: 'layout-shift', buffered: true });
            
            new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                if (entries.length > 0) {
                    window.lcpValue = entries[entries.length - 1].startTime;
                }
            }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch(e) {}
    });

    await page.goto(formattedUrl, { waitUntil: 'networkidle2', timeout: currentTimeout });
    
    // Delay para estabilidade
    await new Promise(r => setTimeout(r, 1500));
    
    // Executa auditoria técnica profunda
    const audit = await runTechnicalAudit(page);
    const siteSnapshot = await page.evaluate(() => {
        const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
        const absoluteUrl = (value) => {
            try { return new URL(value, window.location.href).href; } catch (e) { return value || ''; }
        };
        const text = document.body ? document.body.innerText : '';
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
        const searchable = `${text}\n${document.body?.innerHTML || ''}\n${linkSignals}`;
        const normalizePhone = (value = '') => {
            let digits = String(value || '').replace(/\D/g, '');
            if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
            return digits;
        };
        const isLikelyPhone = (value = '') => {
            const digits = normalizePhone(value);
            return digits.length >= 8 && digits.length <= 11 && !(digits.length === 8 && /^(19|20)\d{6}$/.test(digits));
        };
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
        const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/g;
        const linkHrefs = Array.from(document.querySelectorAll('a[href]')).map(a => a.href || a.getAttribute('href') || '');
        const mailtoEmails = linkHrefs.filter(href => href.startsWith('mailto:')).map(href => href.replace(/^mailto:/i, '').split('?')[0]);
        const whatsappLinks = linkHrefs.filter(href => /wa\.me|api\.whatsapp|whatsapp/i.test(href));
        const telPhones = linkHrefs.filter(href => href.startsWith('tel:')).map(href => href.replace(/^tel:/i, ''));
        const whatsappPhones = [];
        [
            /(?:https?:\/\/)?(?:www\.)?wa\.me\/(?:55)?(\d{10,11})/gi,
            /(?:https?:\/\/)?(?:api\.|web\.)?whatsapp\.com\/send\?[^"'<>]*?phone=(?:55)?(\d{10,11})/gi,
            /whatsapp:\/\/send\?[^"'<>]*?phone=(?:55)?(\d{10,11})/gi
        ].forEach(regex => {
            let match;
            while ((match = regex.exec(searchable)) !== null) whatsappPhones.push(match[1]);
        });

        return {
            title: clean(document.title),
            description: clean(document.querySelector('meta[name="description"]')?.content || ''),
            h1: Array.from(document.querySelectorAll('h1')).map(el => clean(el.innerText)).filter(Boolean).slice(0, 5),
            headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(el => clean(el.innerText)).filter(Boolean).slice(0, 25),
            ctas: Array.from(document.querySelectorAll('button, a, input[type="submit"]')).map(el => clean(el.innerText || el.value || el.getAttribute('aria-label') || '')).filter(Boolean).slice(0, 20),
            emails: [...new Set([...(searchable.match(emailRegex) || []), ...mailtoEmails])].filter(email => !/\.(png|jpe?g|webp|gif|svg)$/i.test(email)).slice(0, 10),
            phones: [...new Set([...(searchable.match(phoneRegex) || []), ...(searchable.match(/(?:\+?55)?\d{10,11}/g) || []), ...telPhones, ...whatsappPhones].map(normalizePhone).filter(isLikelyPhone))].slice(0, 10),
            whatsappLinks: [...new Set(whatsappLinks)].slice(0, 8),
            socialLinks: [...new Set(linkHrefs.filter(href => /instagram|facebook|linkedin|youtube|tiktok/i.test(href)))].slice(0, 12),
            images: Array.from(document.querySelectorAll('img')).map(img => ({ src: absoluteUrl(img.currentSrc || img.src), alt: clean(img.alt) })).filter(img => img.src).slice(0, 20),
            links: Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: clean(a.innerText || a.getAttribute('aria-label') || ''), href: absoluteUrl(a.getAttribute('href')) })).filter(link => link.href).slice(0, 40),
            textSample: clean(text).slice(0, 4000)
        };
    });
    
    // Tenta extrair contatos enquanto o browser está aberto
    try {
        const emails = siteSnapshot.emails || [];
        const phones = siteSnapshot.phones || [];
        const existing = await crud.getContatosByLead(leadId);
        const existingKeys = new Set(existing.map(item => `${item.email || ''}|${item.telefone || ''}`));
        const maxContacts = Math.max(emails.length, phones.length);
        
        for (let i = 0; i < maxContacts; i++) {
            const contact = {
                lead_id: leadId,
                email: emails[i] || null,
                telefone: phones[i] || null,
                fonte: i === 0 ? 'AI SCRAPER' : 'AI SCRAPER - EXTRA'
            };
            const key = `${contact.email || ''}|${contact.telefone || ''}`;
            if ((contact.email || contact.telefone) && !existingKeys.has(key)) {
                await crud.createContato(contact);
                existingKeys.add(key);
            }
        }
    } catch (e) {
        console.warn("Falha ao extrair contatos:", e.message);
    }

    const rawHtml = await page.content();
    const isOffline = !rawHtml || rawHtml.length < 250 || rawHtml.toLowerCase().includes('site under construction');

    // Atualiza o schema com os dados novos
    const finalScore = isOffline ? -1 : audit.score;
    const finalIssues = isOffline ? ["Site inacessível ou offline."] : audit.issues;

    if (table === 'leads_sistemas') {
      await crud.updateLeadUXEvaluation(leadId, finalScore, JSON.stringify(finalIssues), JSON.stringify({ ...(audit.details || {}), siteSnapshot }));
    } else if (table === 'leads_linkedin') {
      await crud.updateLeadLinkedinEvaluation(leadId, finalScore, JSON.stringify(finalIssues), JSON.stringify({ ...(audit.details || {}), siteSnapshot }));
    } else {
      await crud.updateLeadDesignEvaluation(leadId, finalScore, JSON.stringify(finalIssues), JSON.stringify({ ...(audit.details || {}), siteSnapshot }));
    }
    
    return {
      success: true,
      offline: isOffline,
      ...audit,
      score: finalScore
    };
  };

  try {
    try {
      return await runAnalysis(25000);
    } catch (firstError) {
      console.warn(`[Analyzer] Tentativa 2 para ${url}...`);
      if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
      return await runAnalysis(60000);
    }
  } catch (error) {
    console.error("Erro na Auditoria:", error);
    try {
      await crud.updateLeadDesignEvaluation(leadId, -1, JSON.stringify(["Falha técnica: " + error.message]));
    } catch (dbErr) {}
    return { success: false, error: error.message, offline: true };
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
  }
}

module.exports = { capturarEValidar, processHtmlAndGetScore };
