const crud = require('./crud');
const scraper = require('./scraper');
const analyzer = require('./aiAnalyzer');
const contactExtractor = require('./contactExtractor');
const systemAnalyzer = require('./systemAnalyzer');
const prototypeGenerator = require('./prototypeGenerator');
const clientLayoutPipeline = require('./clientLayoutPipeline');
const emailService = require('./emailService');
const linkedinScraper = require('./linkedinScraper');
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function setupIpcHandlers(ipcMain, mainWindow) {
  ipcMain.handle('ping', () => 'pong');

  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      await shell.showItemInFolder(filePath);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('open-path', async (event, targetPath) => {
    try {
      let resolvedPath = targetPath;
      if (targetPath === '__CAPLEAD_USER_MANUAL__') {
        const candidates = [
          path.join(process.resourcesPath || '', 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf'),
          path.join(process.cwd(), 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf'),
          path.resolve(__dirname, '..', 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf')
        ];
        resolvedPath = candidates.find(candidate => candidate && fs.existsSync(candidate));
        if (!resolvedPath) {
          return { success: false, error: 'Manual do usuário não encontrado.' };
        }
      }
      const result = await shell.openPath(resolvedPath);
      if (result) return { success: false, error: result };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  const broadcastUpdate = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('db-update');
    }
  };

  const handleIpc = (channel, crudMethod, isMutation = false) => {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        const data = await crudMethod(...args);
        
        // Se a operação altera dados, notifica a UI
        if (isMutation) {
          broadcastUpdate();
        }
        
        return { success: true, data };
      } catch (err) {
        console.error(`Erro em IPC '${channel}':`, err);
        return { success: false, error: err.message };
      }
    });
  };

  // Queries de Dashboard
  handleIpc('get-dashboard-metrics', crud.getDashboardMetrics);
  handleIpc('get-latest-analyses', crud.getLatestAnalyses);

  // Ações de Busca (Scraping Real Local via IPC)
  ipcMain.handle('search-leads', async (event, params) => {
    try {
      const info = await scraper.buscarLeads(params.nicho, params.regiao, params.onlyWithoutSite, {
        requireEmail: Boolean(params.requireEmail),
        requireWhatsapp: Boolean(params.requireWhatsapp),
        limit: params.limit
      }, (progress) => {
        event.sender.send('capture-progress', progress);
      });
      if (info.count > 0) {
        broadcastUpdate();
      }
      return { 
        success: true, 
        message: `Captura finalizada. ${info.count}/${info.target || params.limit || info.count} leads salvos, ${info.duplicates || 0} repetidos ignorados.`,
        data: info.capturados,
        count: info.count,
        target: info.target || params.limit,
        contactFilterMode: info.contactFilterMode
      };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  });

  // Ações de Avaliação IA Local (Design)
  ipcMain.handle('analyze-lead', async (event, data) => {
    try {
      // Recebe o ID e a URL do lead
      const result = await analyzer.capturarEValidar(data.id, data.url, data.table);
      
      // Notifica as telas caso houve sucesso no DB
      if (result.success) {
        broadcastUpdate();
      }
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Ações Auxiliares: Web Scraping de Contatos Orgânicos
  ipcMain.handle('extract-contact', async (event, data) => {
    try {
      const result = await contactExtractor.extractPublicContact(data.id, data.url);
      if (result.success && result.found) {
        broadcastUpdate();
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Ações de Avaliação de Sistemas SaaS
  ipcMain.handle('search-sistemas', async (event, params) => {
    try {
      const info = await systemAnalyzer.searchAndAnalyzeSystems(params, (progress) => {
        event.sender.send('capture-progress', progress);
      });
      if (info.count > 0) {
        broadcastUpdate();
      }
      return info;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Ações de Prototipagem IA
  ipcMain.handle('generate-prototype', async (event, url, context) => {
    try {
      const result = await prototypeGenerator.generatePrototype(url, context);
      if (result.success) {
        // Preparar variáveis de exportação (visíveis no escopo externo)
        let baseDir;
        let clientDir;
        // Se houver dados de lead no contexto, exportar para a pasta do cliente automaticamente
        if (context && context.lead) {
          try {
            const lead = context.lead;
            baseDir = path.join(process.cwd(), 'Clientes');
            if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
            const safeName = (lead.name || lead.url || 'lead').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_');
            clientDir = path.join(baseDir, safeName);
            if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir);

            // Export stitch prompt e artefatos gerados
            if (result.stitchPrompt) {
              fs.writeFileSync(path.join(clientDir, 'prompt_stitch.txt'), result.stitchPrompt, 'utf8');
            }
            if (result.pdfPath) {
              fs.copyFileSync(result.pdfPath, path.join(clientDir, 'prototype_proposta.pdf'));
            }
            if (result.htmlPath) {
              fs.copyFileSync(result.htmlPath, path.join(clientDir, 'prototype_caplead.html'));
            }
            if (result.prototypeScreenshot) {
              fs.copyFileSync(result.prototypeScreenshot, path.join(clientDir, 'prototype_geral.png'));
            }
            if (result.previewImages && Array.isArray(result.previewImages)) {
              result.previewImages.forEach((p, idx) => {
                if (fs.existsSync(p)) {
                  const dest = path.join(clientDir, `prototype_secao_${idx + 1}.png`);
                  fs.copyFileSync(p, dest);
                }
              });
            }
          } catch (exportErr) {
            console.error('Erro ao exportar protótipo para pasta do cliente:', exportErr);
          }
        }

        // ZIP export
        try {
          const archiver = require('archiver');
          const cliDir = clientDir; // já definido acima
          const zipNameId = (context && context.lead && context.lead.id) ? context.lead.id : 'lead';
          const zipNameLabel = (context && context.lead && context.lead.name) ? context.lead.name.toString().toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'lead';
          const zipPath = path.join(baseDir, `${zipNameId}_${zipNameLabel}.zip`);
          const output = fs.createWriteStream(zipPath);
          const archive = archiver('zip', { zlib: { level: 9 } });
          output.on('close', () => {
            console.log(`ZIP criado com sucesso: ${zipPath} (${archive.pointer()} bytes)`);
          });
          archive.pipe(output);
          archive.directory(cliDir, false);
          await archive.finalize();
        } catch (zipErr) {
          console.warn('Archiver não disponível ou falha ao zipar: ' + (zipErr && zipErr.message));
        }
      }
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('generate-client-layout', async (event, lead) => {
    try {
      const result = await clientLayoutPipeline.generateClientLayoutPipeline(lead);
      broadcastUpdate();
      return result;
    } catch (err) {
      console.error('[Client Layout Pipeline] Error:', err);
      broadcastUpdate();
      return {
        success: false,
        error: err.message,
        message: 'Não foi possível gerar o layout deste lead. Verifique se o site está acessível e tente novamente.'
      };
    }
  });

  // Ações de Protótipo a partir de dados estruturados (novo pipeline)
  const protoFromData = require('./prototypeSystem');
  ipcMain.handle('generate-prototype-from-data', async (event, input) => {
    try {
      const result = await protoFromData.generatePrototypeFromData(input);
      if (result.status === 'success') broadcastUpdate();
      return result;
    } catch (err) {
      return { status: 'invalid', error: err.message };
    }
  });

  // Validação e Reset
  ipcMain.handle('set-lead-validation', async (event, table, id, status, manual = false) => {
    try {
      const result = await crud.setLeadValidation(table, id, status, manual);
      broadcastUpdate();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reset-leads', async (event, table, nicheFilter) => {
    try {
      const result = await crud.resetLeads(table, nicheFilter);
      broadcastUpdate();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('total-reset', async (event) => {
    try {
      const result = await crud.deleteAllLeads();
      broadcastUpdate();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle('clean-captured-site-leads', async (event) => {
    try {
      const result = await crud.cleanCapturedSiteLeads();
      broadcastUpdate();
      return { success: true, data: result };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  });

  // Ações de Auxiliares e Locais (CRUD)
  handleIpc('create-lead-site', crud.createLeadSite, true);
  handleIpc('get-lead-sites', crud.getAllLeadSites);
  handleIpc('update-lead-site', crud.updateLeadSite, true);
  handleIpc('delete-lead-site', crud.deleteLeadSite, true);

  // Contatos
  handleIpc('create-contato', crud.createContato, true);
  handleIpc('get-contatos', crud.getContatosByLead);
  handleIpc('update-contato', crud.updateContato, true);
  handleIpc('delete-contato', crud.deleteContato, true);

  // Leads Sistemas
  handleIpc('create-lead-sistema', crud.createLeadSistema, true);
  handleIpc('get-lead-sistemas', crud.getAllLeadSistemas);
  handleIpc('update-lead-sistema', crud.updateLeadSistema, true);
  handleIpc('delete-lead-sistema', crud.deleteLeadSistema, true);
  
  // Leads LinkedIn
  ipcMain.handle('search-linkedin', async (event, params) => {
    try {
      const info = await linkedinScraper.searchLinkedinLeads(params.nicho, params.regiao);
      if (info.count > 0) broadcastUpdate();
      return info;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ABM: Busca decisores vinculados a uma empresa específica
  ipcMain.handle('search-linkedin-for-lead', async (event, lead, tipo) => {
    try {
      const info = await linkedinScraper.searchLinkedInForLead(lead, tipo || 'site');
      if (info.count > 0) broadcastUpdate();
      return info;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ABM: Busca decisores já vinculados a uma empresa no DB
  handleIpc('get-linkedin-by-empresa', crud.getLinkedinByEmpresa);
  handleIpc('link-decision-maker', crud.linkDecisionMakerToEmpresa, true);

  handleIpc('create-lead-linkedin', crud.createLeadLinkedin, true);
  handleIpc('get-lead-linkedin', crud.getAllLeadLinkedin);
  handleIpc('update-lead-linkedin', crud.updateLeadLinkedin, true);
  handleIpc('delete-lead-linkedin', crud.deleteLeadLinkedin, true);

  // Configuracoes e E-mail
  ipcMain.handle('get-config', async (event, chave) => {
    try { return await crud.getConfig(chave); } catch (err) { return null; }
  });
  ipcMain.handle('set-config', async (event, chave, valor) => {
    try { return await crud.setConfig(chave, valor); } catch (err) { return null; }
  });
  handleIpc('update-lead-documentacao', crud.updateLeadDocumentacao, true);
  handleIpc('update-lead-email-status', crud.updateLeadEmailStatus, true);
  handleIpc('update-lead-wpp-status', crud.updateLeadWppStatus, true);
  handleIpc('update-lead-retorno-status', crud.updateLeadRetornoStatus, true);
  handleIpc('toggle-pin-lead', crud.togglePinLead, true);
  handleIpc('block-lead', crud.blockLead, true);

  // CRM Operacional
  handleIpc('add-interacao', crud.addInteracao, true);
  handleIpc('get-interacoes', crud.getInteracoes);
  handleIpc('delete-interacao', crud.deleteInteracao, true);
  handleIpc('update-lead-funil', crud.updateLeadFunil, true);
  handleIpc('get-email-send-stats-today', crud.getEmailSendStatsToday);

  ipcMain.handle('send-email', async (event, to, subject, body, attachments) => {
    try {
      const result = await emailService.sendEmail(to, subject, body, attachments);
      broadcastUpdate();
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('verify-smtp', async () => {
    return await emailService.verifySMTP();
  });

  ipcMain.handle('create-client-folder', async (event, data) => {
    const fs = require('fs');
    const path = require('path');
    const { shell } = require('electron');
    const { lead, docText, protoPaths, stitchPrompt, screenshotPath, pngSections } = data;

    try {
      const clientsBaseDir = path.join(process.cwd(), 'Clientes');
      if (!fs.existsSync(clientsBaseDir)) {
        fs.mkdirSync(clientsBaseDir);
      }

      const clientFolderName = (lead.nome || lead.url.replace(/https?:\/\/|www\.|\/.*/g, '')).replace(/[^a-z0-9]/gi, '_');
      const clientDir = path.join(clientsBaseDir, clientFolderName);
      
      if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir);
      }

      const proposalPath = path.join(clientDir, 'proposta_prospeccao.txt');
      fs.writeFileSync(proposalPath, docText || '', 'utf8');

      if (stitchPrompt) {
        const promptPath = path.join(clientDir, 'prompt_stitch.txt');
        fs.writeFileSync(promptPath, stitchPrompt, 'utf8');
      }

      if (screenshotPath && fs.existsSync(screenshotPath)) {
        const destScreenshot = path.join(clientDir, 'screenshot_antes.png');
        fs.copyFileSync(screenshotPath, destScreenshot);
      }

      if (protoPaths) {
        if (protoPaths.pdf && fs.existsSync(protoPaths.pdf)) {
          const destPdf = path.join(clientDir, 'prototype_caplead.pdf');
          fs.copyFileSync(protoPaths.pdf, destPdf);
        }
        if (protoPaths.html && fs.existsSync(protoPaths.html)) {
          const destHtml = path.join(clientDir, 'prototype_caplead.html');
          fs.copyFileSync(protoPaths.html, destHtml);
        }
        if (protoPaths.prototypeScreenshot && fs.existsSync(protoPaths.prototypeScreenshot)) {
          const destProtoShot = path.join(clientDir, 'prototype_geral.png');
          fs.copyFileSync(protoPaths.prototypeScreenshot, destProtoShot);
        }
        if (protoPaths.pngSections && Array.isArray(protoPaths.pngSections)) {
          protoPaths.pngSections.forEach((pngPath, idx) => {
            if (fs.existsSync(pngPath)) {
              const destPng = path.join(clientDir, `prototype_secao_${idx + 1}.png`);
              fs.copyFileSync(pngPath, destPng);
            }
          });
        }
      }

      shell.openPath(clientDir);

      return { success: true, path: clientDir };
    } catch (error) {
      console.error('Erro ao criar pasta do cliente:', error);
      return { success: false, error: error.message };
    }
  });

  // Verifica se o site de um lead está online ou offline
  ipcMain.handle('check-site-status', async (event, { id, url }) => {
    if (!url) return { success: false, error: 'URL não informada' };

    // Garante que a URL começa com http
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    const checkUrl = (targetUrl) => new Promise((resolve) => {
      const isHttps = targetUrl.startsWith('https');
      const lib = isHttps ? https : http;
      const options = {
        method: 'HEAD',
        timeout: 8000,
        rejectUnauthorized: false, // aceita certificados auto-assinados
      };
      try {
        const req = lib.request(targetUrl, options, (res) => {
          resolve({ ok: res.statusCode < 500, status: res.statusCode });
        });
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 'timeout' }); });
        req.on('error', () => resolve({ ok: false, status: 'error' }));
        req.end();
      } catch {
        resolve({ ok: false, status: 'error' });
      }
    });

    try {
      let result = await checkUrl(fullUrl);
      // Se https falhou, tenta http como fallback
      if (!result.ok && fullUrl.startsWith('https')) {
        result = await checkUrl(fullUrl.replace('https://', 'http://'));
      }
      const siteStatus = result.ok ? 'online' : 'offline';
      await crud.updateSiteStatus(id, siteStatus);
      broadcastUpdate();
      return { success: true, data: { site_status: siteStatus, statusCode: result.status } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ========================================
  // INTEGRAÇÃO COM KENTAUROS
  // ========================================

  // Envia leads capturados para a API da Kentauros
  ipcMain.handle('export-to-kentauros', async (event, { kentaurosUrl, leads, userId, userEmail, userName }) => {
    if (!kentaurosUrl) {
      return { success: false, error: 'URL da Kentauros não configurada' };
    }
    if (!leads || leads.length === 0) {
      return { success: false, error: 'Nenhum lead para exportar' };
    }

    console.log('[Export] Enviando', leads.length, 'leads para Kentauros');

    try {
      // Normalizar dados dos leads para o formato esperado pela Kentauros
      const normalizedLeads = leads.map(lead => ({
        nome: lead.nome || lead.company || '',
        empresa: lead.empresa || lead.company || '',
        site_oficial: lead.site_oficial || lead.website || lead.url || '',
        url: lead.site_oficial || lead.website || lead.url || '',
        email: lead.email || '',
        telefone: lead.telefone || lead.phone || '',
        nicho: lead.nicho || lead.industry || '',
        categoria: lead.categoria || lead.category || '',
        cidade: lead.cidade || lead.city || '',
        estado: lead.estado || lead.state || '',
        descricao: lead.descricao || lead.description || '',
        maps_url: lead.maps_url || '',
        source: lead.source || 'CapLead',
      }));

      const response = await fetch(`${kentaurosUrl}/api/leads/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leads: normalizedLeads,
          userId,
          userEmail,
          userName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('[Export] Sucesso:', result.summary);
        return {
          success: true,
          imported: result.summary.imported,
          duplicates: result.summary.duplicates,
          failed: result.summary.failed,
        };
      } else {
        console.error('[Export] Erro:', result.message);
        return { success: false, error: result.message };
      }
    } catch (error) {
      console.error('[Export] Erro na requisição:', error);
      return { success: false, error: error.message };
    }
  });

  // Testa conexão com a API da Kentauros
  ipcMain.handle('test-kentauros-connection', async (event, kentaurosUrl) => {
    if (!kentaurosUrl) {
      return { success: false, error: 'URL da Kentauros não informada' };
    }

    try {
      const response = await fetch(`${kentaurosUrl}/api/leads/import`, {
        method: 'GET',
      });
      const data = await response.json();
      return { success: data.ok === true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = setupIpcHandlers;
