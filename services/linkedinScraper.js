const puppeteer = require('puppeteer');
const crud = require('./crud');
const { getBrowserPath } = require('./browserPath');

/**
 * Realiza o scraping de perfis do LinkedIn usando Google Dorks.
 * Evita bloqueios do LinkedIn buscando via resultados orgânicos do Google.
 */
async function searchLinkedinLeads(nicho, regiao) {
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

    // Dork: site:linkedin.com/in/ "nicho" "regiao"
    const query = `site:linkedin.com/in/ "${nicho}" "${regiao}"`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&lr=lang_pt&hl=pt-BR&gl=br&cr=countryBR`;

    console.log(`[LinkedInScraper] Buscando: ${query}`);
    
    const tryLinkedinSearch = async (timeout) => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    };

    try {
      await tryLinkedinSearch(20000);
    } catch (err) {
      console.warn(`[LinkedInScraper] Falha na 1ª tentativa: ${err.message}. Retentando com 45s...`);
      await tryLinkedinSearch(45000);
    }

    await new Promise(r => setTimeout(r, 2000));

    const content = await page.content();
    if (content.includes('Our systems have detected unusual traffic') || content.includes('g-recaptcha')) {
      throw new Error('Captcha detectado no Google ao buscar LinkedIn.');
    }

    const profiles = await page.evaluate(() => {
      const results = [];
      const blocks = document.querySelectorAll('div.g, div.MjjYud, div.yuRUbf');
      
      blocks.forEach(el => {
        const linkEl = el.querySelector('a[href*="linkedin.com/in/"]');
        const titleEl = el.querySelector('h3');
        const descEl = el.querySelector('.VwiC3b, .lEBKkf');

        if (linkEl && titleEl) {
          const rawTitle = titleEl.innerText.trim(); // Ex: "Fulano de Tal - Diretor Comercial - Empresa X | LinkedIn"
          const parts = rawTitle.split(/ - | \| /);
          
          results.push({
            url: linkEl.href.split('?')[0],
            nome: parts[0] || 'N/A',
            cargo: parts[1] || 'N/A',
            empresa: parts[2] || 'N/A',
            descricao: descEl ? descEl.innerText.trim() : ''
          });
        }
      });
      return results;
    });

    console.log(`[LinkedInScraper] Encontrados ${profiles.length} perfis brutos.`);

    let savedCount = 0;
    const savedLeads = [];

    for (const profile of profiles) {
      if (await crud.isUrlBlocked(profile.url)) continue;

      try {
        const leadData = {
          url: profile.url,
          nome: profile.nome,
          cargo: profile.cargo,
          empresa: profile.empresa,
          localizacao: regiao,
          nicho: nicho,
          data_coleta: new Date().toISOString()
        };

        const result = await crud.createLeadLinkedin(leadData);
        if (result.id) {
          savedCount++;
          savedLeads.push({ ...profile, id: result.id });
        }
      } catch (e) {
        // Provável duplicata
      }
    }

    return { success: true, count: savedCount, leads: savedLeads };

  } catch (error) {
    console.error('[LinkedInScraper] Erro:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Busca decisores no LinkedIn diretamente vinculados a uma empresa específica.
 * Estratégia ABM (Account-Based Marketing): usa o nome da empresa + região + cargos-alvo.
 * @param {object} lead - Objeto do lead (id, titulo, localizacao)
 * @param {string} tipo - 'site' ou 'sistema'
 * @returns {object} - { success, count, leads }
 */
async function searchLinkedInForLead(lead, tipo = 'site') {
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

    // Nome da empresa pode vir de titulo, nome ou da URL limpa
    const companyName = lead.titulo || lead.nome || (lead.url || '').replace(/https?:\/\/|www\.|\/.*/g, '');
    const region = lead.localizacao || '';

    // Dork ABM focado: empresa + cargos decisores + região
    const cargos = '"CEO" OR "Founder" OR "Diretor" OR "Gerente" OR "Sócio" OR "Proprietário" OR "President"';
    const query = `site:linkedin.com/in/ (${cargos}) "${companyName}" ${region ? `"${region}"` : ''}`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&lr=lang_pt&hl=pt-BR&gl=br&cr=countryBR`;

    console.log(`[LinkedInScraper ABM] Buscando decisores para: ${companyName} | Região: ${region}`);

    const trySearch = async (timeout) => {
      await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout });
    };

    try {
      await trySearch(20000);
    } catch (err) {
      console.warn(`[LinkedInScraper ABM] Tentativa 2...`);
      await trySearch(45000);
    }

    await new Promise(r => setTimeout(r, 2000));

    const content = await page.content();
    if (content.includes('Our systems have detected unusual traffic') || content.includes('g-recaptcha')) {
      throw new Error('Captcha detectado no Google.');
    }

    const profiles = await page.evaluate(() => {
      const results = [];
      const blocks = document.querySelectorAll('div.g, div.MjjYud, div.yuRUbf');
      blocks.forEach(el => {
        const linkEl = el.querySelector('a[href*="linkedin.com/in/"]');
        const titleEl = el.querySelector('h3');
        const descEl = el.querySelector('.VwiC3b, .lEBKkf');
        if (linkEl && titleEl) {
          const rawTitle = titleEl.innerText.trim();
          const parts = rawTitle.split(/ - | \| /);
          results.push({
            url: linkEl.href.split('?')[0],
            nome: parts[0] || 'N/A',
            cargo: parts[1] || 'N/A',
            empresa: parts[2] || 'N/A',
            descricao: descEl ? descEl.innerText.trim() : ''
          });
        }
      });
      return results;
    });

    console.log(`[LinkedInScraper ABM] Encontrados ${profiles.length} decisores para ${companyName}.`);

    let savedCount = 0;
    const savedLeads = [];

    for (const profile of profiles) {
      if (await crud.isUrlBlocked(profile.url)) continue;
      try {
        const leadData = {
          url: profile.url,
          nome: profile.nome,
          cargo: profile.cargo,
          empresa: profile.empresa,
          localizacao: region,
          nicho: companyName,
          lead_empresa_id: lead.id,
          lead_empresa_tipo: tipo,
          data_coleta: new Date().toISOString()
        };
        const result = await crud.createLeadLinkedin(leadData);
        // Se o perfil já existia (0 changes), vincula ao lead mesmo assim
        if (result.id) {
          savedCount++;
          savedLeads.push({ ...profile, id: result.id });
        } else if (result.changes === 0) {
          // Tenta vincular perfil existente ao lead atual
          const existing = await crud.getLinkedinByEmpresa(lead.id, tipo);
          // Se não está ainda vinculado, atualiza
          if (!existing.find(e => e.url === profile.url)) {
            await crud.linkDecisionMakerToEmpresa(result.id, lead.id, tipo);
          }
        }
      } catch (e) { /* duplicata */ }
    }

    return { success: true, count: savedCount, leads: savedLeads };

  } catch (error) {
    console.error('[LinkedInScraper ABM] Erro:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { searchLinkedinLeads, searchLinkedInForLead };

