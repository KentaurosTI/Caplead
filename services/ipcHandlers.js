const crud = require('./crud');
const scraper = require('./scraper');
const analyzer = require('./aiAnalyzer');
const contactExtractor = require('./contactExtractor');
const systemAnalyzer = require('./systemAnalyzer');
const prototypeGenerator = require('./prototypeGenerator');
const clientLayoutPipeline = require('./clientLayoutPipeline');
const emailService = require('./emailService');
const linkedinScraper = require('./linkedinScraper');
const kentaurosExport = require('./kentaurosExport');
const leadsExcelExport = require('./leadsExcelExport');
const pdfDiagnosticReport = require('./pdfDiagnosticReport');
const { app, shell, dialog, BrowserWindow } = require('electron');
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

  ipcMain.handle('open-external-url', async (event, url) => {
    try {
      const target = String(url || '').trim();
      if (!/^https?:\/\//i.test(target)) {
        return { success: false, error: 'URL externa invÃ¡lida.' };
      }
      await shell.openExternal(target);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  let _broadcastTimer = null;
  const broadcastUpdate = () => {
    if (_broadcastTimer) clearTimeout(_broadcastTimer);
    _broadcastTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('db-update');
      }
    }, 80);
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
      const searchFn = (params.nicho || '').includes(',') ? scraper.buscarLeadsMulti : scraper.buscarLeads;
      const info = await searchFn(params.nicho, params.regiao, params.onlyWithoutSite, {
        requireEmail: Boolean(params.requireEmail),
        requireWhatsapp: Boolean(params.requireWhatsapp),
        limit: params.limit
      }, (progress) => {
        event.sender.send('capture-progress', progress);
      });
      if (info.count > 0) {
        broadcastUpdate();
      }

      let kentaurosSync = null;
      if (info.capturados?.length) {
        kentaurosSync = await kentaurosExport.syncCapturedLeadsToKentauros(info.capturados, {
          userEmail: params.userEmail,
          userName: params.userName,
        });
      }

      return { 
        success: true, 
        message: `Captura finalizada. ${info.count}/${info.target || params.limit || info.count} leads salvos, ${info.duplicates || 0} repetidos ignorados.`,
        data: info.capturados,
        count: info.count,
        target: info.target || params.limit,
        contactFilterMode: info.contactFilterMode,
        kentaurosSync,
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

      let kentaurosSync = null;
      if (info.capturados?.length) {
        kentaurosSync = await kentaurosExport.syncCapturedLeadsToKentauros(info.capturados, {
          userEmail: params.userEmail,
          userName: params.userName,
        });
      }

      return { ...info, kentaurosSync };
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
  ipcMain.handle('export-leads-excel', async (event, { leads = [] } = {}) => {
    try {
      if (!Array.isArray(leads) || leads.length === 0) {
        return { success: false, error: 'Nenhum lead para exportar.' };
      }

      const downloadsPath = app?.getPath ? app.getPath('downloads') : process.cwd();
      const defaultPath = path.join(downloadsPath, `caplead-leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar leads para Excel',
        defaultPath,
        filters: [{ name: 'Planilha Excel', extensions: ['xlsx'] }],
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const result = leadsExcelExport.writeLeadsExcelFile(filePath, leads);
      shell.showItemInFolder(filePath);
      return { success: true, ...result };
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      return { success: false, error: err.message || 'Falha ao exportar Excel.' };
    }
  });

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

      let kentaurosSync = null;
      if (info.capturados?.length) {
        kentaurosSync = await kentaurosExport.syncCapturedLeadsToKentauros(info.capturados, {
          userEmail: params.userEmail,
          userName: params.userName,
        });
      }

      return { ...info, kentaurosSync };
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

  ipcMain.handle('get-kentauros-config', async () => {
    try {
      const config = await kentaurosExport.getKentaurosConfig();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-kentauros-config', async (event, { url, enabled, apiKey, tenantId, userId }) => {
    try {
      if (url !== undefined) await crud.setConfig('kentauros_url', url);
      if (enabled !== undefined) await crud.setConfig('kentauros_enabled', enabled ? '1' : '0');
      if (apiKey !== undefined) await crud.setConfig('kentauros_api_key', apiKey);
      if (tenantId !== undefined) await crud.setConfig('kentauros_tenant_id', tenantId);
      if (userId !== undefined) await crud.setConfig('kentauros_user_id', String(userId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-to-kentauros', async (event, payload = {}) => {
    const { kentaurosUrl, leads, leadIds, source, userId, userEmail, userName, capturedBySource, tenantId, apiKey } = payload;

    if ((!leads || leads.length === 0) && (!leadIds || leadIds.length === 0)) {
      return { success: false, error: 'Nenhum lead para exportar' };
    }

    try {
      return await kentaurosExport.exportLeadsToKentauros({
        kentaurosUrl,
        leads,
        leadIds,
        source: source || 'sites',
        userId,
        userEmail,
        userName,
        capturedBySource,
        tenantId,
        apiKey,
        onProgress: (progress) => {
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('kentauros-export-progress', progress);
          }
        },
      });
    } catch (error) {
      console.error('[Export] Erro na requisição:', error);
      return { success: false, error: error.message || 'Falha ao exportar para Kentauros' };
    }
  });

  ipcMain.handle('test-kentauros-connection', async (event, kentaurosUrl) => {
    try {
      return await kentaurosExport.testKentaurosConnection(kentaurosUrl);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Task 2 — Cancelar captura em andamento
  ipcMain.handle('cancel-search', async () => {
    try {
      scraper.cancelSearch();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Task 3 — Dashboard estatísticas avançadas
  handleIpc('get-dashboard-stats', crud.getDashboardStats);

  // Task 6 — Follow-ups vencidos
  handleIpc('get-followups-due', crud.getFollowupsDue);

  // Task 7 — Gerar PDF de diagnóstico
  ipcMain.handle('generate-diagnostic-pdf', async (event, { lead, problems, score, breakdown }) => {
    try {
      const result = await pdfDiagnosticReport.generateDiagnosticReport({ lead, problems, score, breakdown });
      if (result.success && result.path) shell.showItemInFolder(result.path);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Task 9 — Templates de mensagem por nicho
  handleIpc('get-message-templates', crud.getMessageTemplates);
  ipcMain.handle('save-message-template', async (event, data) => {
    try {
      const result = await crud.saveMessageTemplate(data);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('delete-message-template', async (event, id) => {
    try {
      await crud.deleteMessageTemplate(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Task 10 — Backup manual e export/import JSON
  ipcMain.handle('backup-db-manual', async () => {
    try {
      const userDataDir = app.getPath('userData');
      const dbPath = path.join(userDataDir, 'database.sqlite');
      const fallbackDbPath = path.join(process.cwd(), 'database.sqlite');
      const sourcePath = fs.existsSync(dbPath) ? dbPath : fallbackDbPath;
      if (!fs.existsSync(sourcePath)) return { success: false, error: 'Banco de dados não encontrado.' };

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Salvar backup do banco',
        defaultPath: path.join(app.getPath('downloads'), `caplead-backup-${new Date().toISOString().slice(0,10)}.sqlite`),
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
      });
      if (canceled || !filePath) return { success: false, canceled: true };
      fs.copyFileSync(sourcePath, filePath);
      shell.showItemInFolder(filePath);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('restore-db', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Selecionar backup para restaurar',
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
      });
      if (canceled || !filePaths[0]) return { success: false, canceled: true };

      const userDataDir = app.getPath('userData');
      const dbPath = path.join(userDataDir, 'database.sqlite');
      const fallbackDbPath = path.join(process.cwd(), 'database.sqlite');
      const targetPath = fs.existsSync(userDataDir) ? dbPath : fallbackDbPath;

      // Faz backup do estado atual antes de restaurar
      const safePath = targetPath.replace('.sqlite', `_pre_restore_${Date.now()}.sqlite`);
      if (fs.existsSync(targetPath)) fs.copyFileSync(targetPath, safePath);

      fs.copyFileSync(filePaths[0], targetPath);
      broadcastUpdate();
      return { success: true, message: 'Banco restaurado. Reinicie o aplicativo para carregar os dados.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('export-leads-json', async () => {
    try {
      const data = await crud.exportLeadsJson();
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar leads em JSON',
        defaultPath: path.join(app.getPath('downloads'), `caplead-leads-${new Date().toISOString().slice(0,10)}.json`),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled || !filePath) return { success: false, canceled: true };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      shell.showItemInFolder(filePath);
      return { success: true, path: filePath, count: data.sites.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('import-leads-json', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Importar leads de JSON',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      });
      if (canceled || !filePaths[0]) return { success: false, canceled: true };
      const raw = fs.readFileSync(filePaths[0], 'utf8');
      const data = JSON.parse(raw);
      const result = await crud.importLeadsJson(data);
      broadcastUpdate();
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // T07 — Histórico de e-mails
  handleIpc('get-email-history', crud.getEmailHistory);
  handleIpc('add-email-history', crud.addEmailHistory, true);

  // T13 — Score override
  handleIpc('save-score-override', crud.saveScoreOverride, true);

  // T14 — Ticket value
  handleIpc('save-ticket-value', crud.saveTicketValue, true);

  // T26 — Export CSV
  ipcMain.handle('export-leads-csv', async (event, { rows, filename }) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar CSV',
        defaultPath: filename || 'leads.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (canceled || !filePath) return { success: false, error: 'cancelled' };
      if (!rows || rows.length === 0) return { success: false, error: 'sem dados' };
      const keys = Object.keys(rows[0]);
      const escape = (v) => {
        const s = String(v === null || v === undefined ? '' : v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [keys.join(','), ...rows.map(r => keys.map(k => escape(r[k])).join(','))].join('\n');
      fs.writeFileSync(filePath, '﻿' + csv, 'utf8');
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // T27 — Activity log
  handleIpc('log-activity', crud.logActivity, true);
  handleIpc('get-activity-log', crud.getActivityLog);

  // T30 — App health
  ipcMain.handle('get-app-health', async () => {
    try {
      const dbFile = app.isPackaged
        ? path.join(app.getPath('userData'), 'database.sqlite')
        : path.join(process.cwd(), 'database.sqlite');
      const dbSize = fs.existsSync(dbFile) ? Math.round(fs.statSync(dbFile).size / 1024) : 0;
      const backupDir = path.join(
        app.isPackaged ? app.getPath('userData') : process.cwd(),
        'backups', 'auto'
      );
      const lastBackup = fs.existsSync(backupDir)
        ? fs.readdirSync(backupDir).filter(f => f.endsWith('.sqlite')).sort().pop() || null
        : null;
      const mem = process.memoryUsage();
      return {
        success: true,
        version: app.getVersion(),
        dbSizeKb: dbSize,
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        lastBackup: lastBackup ? lastBackup.replace('db-auto-', '').replace('.sqlite', '') : null,
        platform: process.platform,
        uptime: Math.round(process.uptime())
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // T21 — Busca global em todos os leads
  ipcMain.handle('search-all-leads', async (event, query) => {
    try {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return { success: true, results: [] };
      const [sites, sistemas, linkedin] = await Promise.all([
        crud.getLeadSites(),
        crud.getLeadSistemas(),
        crud.getAllLeadLinkedin()
      ]);
      const match = (lead) => {
        const str = [lead.nome, lead.titulo, lead.url, lead.site_oficial, lead.nicho, lead.categoria, lead.localizacao, lead.email, lead.telefone, lead.empresa].join(' ').toLowerCase();
        return str.includes(q);
      };
      const results = [
        ...sites.filter(match).slice(0, 10).map(l => ({ ...l, _typeCode: 'sites' })),
        ...sistemas.filter(match).slice(0, 10).map(l => ({ ...l, _typeCode: 'sistema' })),
        ...linkedin.filter(match).slice(0, 10).map(l => ({ ...l, _typeCode: 'linkedin' }))
      ].slice(0, 20);
      return { success: true, results };
    } catch (e) {
      return { success: false, error: e.message, results: [] };
    }
  });

  // ─── WhatsApp AutoPilot ────────────────────────────────────────────────────
  let wppPilotWindow = null;

  function getWppWindow() {
    return wppPilotWindow && !wppPilotWindow.isDestroyed() ? wppPilotWindow : null;
  }

  ipcMain.handle('wpp:pilot-init', async () => {
    try {
      if (!getWppWindow()) {
        wppPilotWindow = new BrowserWindow({
          width: 1100,
          height: 780,
          title: 'CapLead — WhatsApp Automático',
          parent: mainWindow,
          webPreferences: {
            partition: 'persist:wpp-autopilot',
            nodeIntegration: false,
            contextIsolation: true,
          },
          icon: path.join(__dirname, '../assets/icon.png'),
        });
        wppPilotWindow.on('closed', () => { wppPilotWindow = null; });
      }
      wppPilotWindow.show();
      await wppPilotWindow.loadURL('https://web.whatsapp.com');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('wpp:pilot-check', async () => {
    try {
      const win = getWppWindow();
      if (!win) return { success: false, error: 'Janela não inicializada' };
      const status = await win.webContents.executeJavaScript(`(() => {
        const hasQr = !!document.querySelector('[data-testid="qrcode"]') ||
                      !!(Array.from(document.querySelectorAll('canvas')).find(c => c.getAttribute('aria-label')));
        const hasApp = !!document.querySelector('[data-testid="chat-list"]') ||
                       !!document.querySelector('#side') ||
                       !!document.querySelector('[data-testid="cell-frame-container"]');
        return { needsQR: hasQr, loggedIn: hasApp };
      })()`);
      return { success: true, ...status };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('wpp:pilot-send', async (event, { phone, message }) => {
    try {
      const win = getWppWindow();
      if (!win) return { success: false, error: 'Janela WhatsApp não inicializada' };

      const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
      await win.loadURL(url);

      const result = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const TIMEOUT = 30000;
          const start = Date.now();
          let clicked = false;
          const tick = setInterval(() => {
            // QR code — sessão expirou
            if (document.querySelector('[data-testid="qrcode"]') ||
                Array.from(document.querySelectorAll('canvas')).some(c => c.getAttribute('aria-label'))) {
              clearInterval(tick);
              return resolve({ status: 'qr-needed' });
            }
            // Número inválido
            const popup = document.querySelector('[data-testid="popup-contents"]');
            if (popup && /inválido|invalid|not found/i.test(popup.textContent)) {
              clearInterval(tick);
              return resolve({ status: 'invalid-phone' });
            }

            if (!clicked) {
              // Fase 1 — aguarda botão enviar e clica
              const btn = document.querySelector('[data-testid="send"]') ||
                          document.querySelector('span[data-icon="send"]') ||
                          document.querySelector('[data-testid="compose-btn-send"]') ||
                          document.querySelector('button[aria-label="Send"]') ||
                          document.querySelector('button[aria-label="Enviar"]');
              if (btn) {
                btn.click();
                clicked = true;
              }
            } else {
              // Fase 2 — aguarda textarea esvaziar (confirma envio e evita texto duplo)
              const box = document.querySelector('[contenteditable="true"][data-tab="10"]') ||
                          document.querySelector('[contenteditable="true"].selectable-text') ||
                          document.querySelector('[data-testid="conversation-compose-box-input"]');
              if (!box || !box.textContent.trim()) {
                clearInterval(tick);
                return resolve({ status: 'sent' });
              }
            }

            if (Date.now() - start > TIMEOUT) {
              clearInterval(tick);
              return resolve({ status: clicked ? 'sent' : 'timeout' });
            }
          }, 500);
        })
      `, true);

      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('wpp:pilot-stop', async () => {
    try {
      const win = getWppWindow();
      if (win) { win.close(); wppPilotWindow = null; }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  // T18 — PageSpeed API check
  ipcMain.handle('pagespeed-check', async (event, url) => {
    try {
      const apiKey = await crud.getConfig('pagespeed_api_key');
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile${apiKey ? '&key=' + apiKey : ''}`;
      const data = await new Promise((resolve, reject) => {
        const mod = apiUrl.startsWith('https') ? https : http;
        mod.get(apiUrl, (res) => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
      const cats = data.lighthouseResult?.categories;
      const audits = data.lighthouseResult?.audits;
      if (!cats) return { success: false, error: 'Sem dados' };
      return {
        success: true,
        performance: Math.round((cats.performance?.score || 0) * 100),
        seo: Math.round((cats.seo?.score || 0) * 100),
        accessibility: Math.round((cats.accessibility?.score || 0) * 100),
        bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
        lcp: audits?.['largest-contentful-paint']?.displayValue,
        cls: audits?.['cumulative-layout-shift']?.displayValue,
        fcp: audits?.['first-contentful-paint']?.displayValue,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = setupIpcHandlers;
