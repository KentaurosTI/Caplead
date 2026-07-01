const db = require('../database/db');

// Wrapper utilitário abstrato para retornar Promises ao invés de callbacks
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const allQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const normalizeMissingContactValue = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const comparable = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(nao encontrado|n\/a|null|undefined)$/.test(comparable) ? null : text;
};

const normalizeContactKey = (value) => normalizeMissingContactValue(value)?.toLowerCase() || '';

const hasCjkText = (value = '') => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(String(value || ''));

const runQueryOptional = (query) => {
  return new Promise((resolve) => {
    db.run(query, () => resolve());
  });
};

const ensureResetColumns = async () => {
  await runQueryOptional(`ALTER TABLE leads_sites ADD COLUMN manual_validation INTEGER DEFAULT 0`);
  await runQueryOptional(`ALTER TABLE leads_sistemas ADD COLUMN manual_validation INTEGER DEFAULT 0`);
  await runQueryOptional(`ALTER TABLE leads_linkedin ADD COLUMN manual_validation INTEGER DEFAULT 0`);
  await ensureLayoutColumns();
};

const ensureLayoutColumns = async () => {
  for (const table of ['leads_sites', 'leads_sistemas', 'leads_linkedin']) {
    await runQueryOptional(`ALTER TABLE ${table} ADD COLUMN layout_status TEXT`);
    await runQueryOptional(`ALTER TABLE ${table} ADD COLUMN layout_gerado_path TEXT`);
    await runQueryOptional(`ALTER TABLE ${table} ADD COLUMN layout_preview_path TEXT`);
    await runQueryOptional(`ALTER TABLE ${table} ADD COLUMN layout_prompt_path TEXT`);
    await runQueryOptional(`ALTER TABLE ${table} ADD COLUMN layout_gerado_at TEXT`);
  }
};

const ensureSystemAppColumns = async () => {
  const columns = [
    "tipo_origem TEXT DEFAULT 'web'",
    'app_store_url TEXT',
    'package_id TEXT',
    'developer_name TEXT',
    'developer_email TEXT',
    'developer_site TEXT',
    'privacy_policy_url TEXT',
    'app_category TEXT',
    'rating TEXT',
    'reviews_count TEXT',
    'installs TEXT',
    'last_update TEXT',
    'icon_url TEXT',
    'screenshots_json TEXT',
    'features_json TEXT',
    'contacts_json TEXT',
    'raw_metadata_json TEXT',
    'email TEXT',
    'telefone TEXT'
  ];

  for (const column of columns) {
    await runQueryOptional(`ALTER TABLE leads_sistemas ADD COLUMN ${column}`);
  }
  await runQueryOptional(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sistemas_package ON leads_sistemas (package_id) WHERE package_id IS NOT NULL AND TRIM(package_id) != ''`);
  await runQueryOptional(`CREATE INDEX IF NOT EXISTS idx_leads_sistemas_origem ON leads_sistemas (tipo_origem)`);
};

const crmLeadTypesByTable = {
  leads_sites: ['sites', 'site'],
  leads_sistemas: ['sistema', 'sistemas'],
  leads_linkedin: ['linkedin']
};

const buildProtectedLeadWhere = (table) => {
  const crmTypes = crmLeadTypesByTable[table] || [];
  const crmTypeList = crmTypes.map(type => `'${type}'`).join(', ');
  const funilClauses = table === 'leads_linkedin' ? [] : [
    "(funil_status IS NOT NULL AND TRIM(funil_status) != '' AND funil_status != 'novo')",
    "(proximo_passo IS NOT NULL AND TRIM(proximo_passo) != '')",
    "(followup_date IS NOT NULL AND TRIM(followup_date) != '')"
  ];

  return [
    "COALESCE(manual_validation, 0) = 1",
    "COALESCE(email_enviado, 0) = 1",
    "COALESCE(wpp_enviado, 0) = 1",
    "COALESCE(respondeu_email, 0) = 1",
    "COALESCE(is_pinned, 0) = 1",
    "(documentacao IS NOT NULL AND TRIM(documentacao) != '')",
    "(layout_status IS NOT NULL AND TRIM(layout_status) != '')",
    "(layout_gerado_path IS NOT NULL AND TRIM(layout_gerado_path) != '')",
    ...funilClauses,
    `EXISTS (
      SELECT 1 FROM crm_interacoes ci
      WHERE ci.lead_id = ${table}.id
        AND ci.lead_tipo IN (${crmTypeList})
    )`
  ].join('\n    OR ');
};

const crud = {
  // === LEADS SITES ===
  createLeadSite: async (data) => {
    if (data.url) {
      const exists = await getQuery(`SELECT id FROM leads_sites WHERE url = ?`, [data.url]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }
    if (data.site_oficial) {
      const exists = await getQuery(`SELECT id FROM leads_sites WHERE site_oficial = ?`, [data.site_oficial]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }
    if (data.maps_url) {
      const exists = await getQuery(`SELECT id FROM leads_sites WHERE maps_url = ?`, [data.maps_url]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }
    if (data.titulo && data.localizacao) {
      const exists = await getQuery(`SELECT id FROM leads_sites WHERE titulo = ? AND localizacao = ?`, [data.titulo, data.localizacao]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }

    const sql = `INSERT OR IGNORE INTO leads_sites (url, titulo, descricao, score_design, data_ultima_atualizacao, data_coleta, telefone, categoria, localizacao, maps_url, site_oficial, has_digital_presence) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    return runQuery(sql, [
      data.url, data.titulo, data.descricao, data.score_design, 
      data.data_ultima_atualizacao, data.data_coleta || new Date().toISOString(),
      data.telefone, data.categoria, data.localizacao, data.maps_url, 
      data.site_oficial, data.has_digital_presence ?? 1
    ]);
  },
  getAllLeadSites: async () => {
    const sql = `
      SELECT s.*, 
             (SELECT COUNT(*) FROM contatos c WHERE c.lead_id = s.id AND c.email IS NOT NULL AND TRIM(c.email) != '' AND LOWER(TRIM(c.email)) NOT LIKE '%encontrado%' AND LOWER(TRIM(c.email)) NOT IN ('n/a', 'null', 'undefined')) as has_email_count,
             (SELECT COUNT(*) FROM contatos c WHERE c.lead_id = s.id AND c.telefone IS NOT NULL AND TRIM(c.telefone) != '' AND LOWER(TRIM(c.telefone)) NOT IN ('n/a', 'null', 'undefined')) as has_phone_count
      FROM leads_sites s 
      WHERE s.is_blocked = 0 
      ORDER BY s.id DESC
    `;
    return allQuery(sql);
  },
  updateLeadSite: async (id, data) => {
    const sql = `UPDATE leads_sites SET url = ?, titulo = ?, descricao = ?, score_design = ?, data_ultima_atualizacao = ?, telefone = ?, categoria = ?, localizacao = ?, maps_url = ?, site_oficial = ?, has_digital_presence = ? WHERE id = ?`;
    return runQuery(sql, [
      data.url, data.titulo, data.descricao, data.score_design, 
      data.data_ultima_atualizacao, data.telefone, data.categoria, 
      data.localizacao, data.maps_url, data.site_oficial, 
      data.has_digital_presence ?? 1, id
    ]);
  },
  deleteLeadSite: async (id) => {
    return runQuery(`DELETE FROM leads_sites WHERE id = ?`, [id]);
  },
  updateLeadDesignEvaluation: async (id, score, problemas, breakdown = null) => {
    const sql = `UPDATE leads_sites SET score_design = ?, problemas = ?, breakdown_score = ?, data_ultima_atualizacao = ? WHERE id = ?`;
    return runQuery(sql, [score, problemas, breakdown, new Date().toISOString(), id]);
  },
  updateSiteStatus: async (id, status) => {
    // status: 'online' | 'offline' | 'pendente'
    const sql = `UPDATE leads_sites SET site_status = ?, site_status_at = ? WHERE id = ?`;
    return runQuery(sql, [status, new Date().toISOString(), id]);
  },
  updateLeadLayoutStatus: async (table, id, data) => {
    await ensureLayoutColumns();
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    const sql = `UPDATE ${table} SET layout_status = ?, layout_gerado_path = ?, layout_preview_path = ?, layout_prompt_path = ?, layout_gerado_at = ? WHERE id = ?`;
    return runQuery(sql, [data.status, data.path, data.preview, data.prompt, data.generatedAt, id]);
  },
  updateLeadUXEvaluation: async (id, score, problemas, breakdown = null) => {
    const sql = `UPDATE leads_sistemas SET score_ux = ?, problemas = ?, breakdown_score = ?, data_ultima_atualizacao = ? WHERE id = ?`;
    return runQuery(sql, [score, problemas, breakdown, new Date().toISOString(), id]);
  },
  updateLeadLinkedinEvaluation: async (id, score, problemas, breakdown = null) => {
    const sql = `UPDATE leads_linkedin SET score_design = ?, problemas = ?, breakdown_score = ?, data_ultima_atualizacao = ? WHERE id = ?`;
    return runQuery(sql, [score, problemas, breakdown, new Date().toISOString(), id]);
  },

  // === CONTATOS ===
  createContato: async (data) => {
    const email = normalizeMissingContactValue(data.email);
    const telefone = normalizeMissingContactValue(data.telefone);
    if (!email && !telefone) return { id: null, changes: 0, skipped: true };

    const existing = await allQuery(`SELECT email, telefone FROM contatos WHERE lead_id = ?`, [data.lead_id]);
    const emailKey = normalizeContactKey(email);
    const phoneKey = normalizeContactKey(telefone)?.replace(/\D/g, '') || '';
    const alreadyExists = existing.some((item) => {
      const existingEmail = normalizeContactKey(item.email);
      const existingPhone = normalizeContactKey(item.telefone)?.replace(/\D/g, '') || '';
      return (emailKey && existingEmail === emailKey) || (phoneKey && existingPhone === phoneKey);
    });

    if (alreadyExists) return { id: null, changes: 0, skipped: true };

    const sql = `INSERT INTO contatos (lead_id, email, telefone, fonte) VALUES (?, ?, ?, ?)`;
    return runQuery(sql, [data.lead_id, email, telefone, data.fonte || 'AI SCRAPER']);
  },
  getContatosByLead: async (leadId) => {
    return allQuery(`SELECT * FROM contatos WHERE lead_id = ?`, [leadId]);
  },
  updateContato: async (id, data) => {
    const sql = `UPDATE contatos SET email = ?, telefone = ?, fonte = ? WHERE id = ?`;
    return runQuery(sql, [data.email, data.telefone, data.fonte, id]);
  },
  deleteContato: async (id) => {
    return runQuery(`DELETE FROM contatos WHERE id = ?`, [id]);
  },

  // === LEADS SISTEMAS ===
  createLeadSistema: async (data) => {
    await ensureSystemAppColumns();
    const rawSignal = [data.nome, data.descricao, data.url, data.app_store_url, data.developer_name].filter(Boolean).join(' ');
    const comparableSignal = rawSignal.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const articleTerms = ['introducao ', 'exemplos', 'entenda ', 'diferenca ', 'o que e ', '/blog', 'blog/', 'wikipedia', 'medium.com'];
    if (hasCjkText(rawSignal) || String(data.url || '').toLowerCase().includes('bing.com/ck') || articleTerms.some(term => comparableSignal.includes(term))) {
      return { id: null, changes: 0, skipped: true, invalid: true };
    }
    if (data.package_id) {
      const exists = await getQuery(`SELECT id FROM leads_sistemas WHERE package_id = ?`, [data.package_id]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }
    if (data.url) {
      const exists = await getQuery(`SELECT id FROM leads_sistemas WHERE url = ?`, [data.url]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }
    if (data.app_store_url) {
      const exists = await getQuery(`SELECT id FROM leads_sistemas WHERE app_store_url = ?`, [data.app_store_url]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }
    if (data.developer_email && data.nome) {
      const exists = await getQuery(`SELECT id FROM leads_sistemas WHERE LOWER(nome) = LOWER(?) AND LOWER(developer_email) = LOWER(?)`, [data.nome, data.developer_email]);
      if (exists) return { id: exists.id, changes: 0, duplicate: true };
    }

    const sql = `
      INSERT OR IGNORE INTO leads_sistemas (
        nome, url, descricao, score_ux, problemas, data_ultima_atualizacao, data_coleta, is_validated, breakdown_score,
        tipo_origem, app_store_url, package_id, developer_name, developer_email, developer_site, privacy_policy_url,
        app_category, rating, reviews_count, installs, last_update, icon_url, screenshots_json, features_json,
        contacts_json, raw_metadata_json, email, telefone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return runQuery(sql, [
      data.nome, 
      data.url, 
      data.descricao, 
      data.score_ux, 
      data.problemas, 
      data.data_ultima_atualizacao || new Date().toISOString(), 
      data.data_coleta || new Date().toISOString(), 
      data.is_validated || 0,
      data.breakdown_score || null,
      data.tipo_origem || 'web',
      data.app_store_url || null,
      data.package_id || null,
      data.developer_name || null,
      data.developer_email || null,
      data.developer_site || null,
      data.privacy_policy_url || null,
      data.app_category || null,
      data.rating || null,
      data.reviews_count || null,
      data.installs || null,
      data.last_update || null,
      data.icon_url || null,
      data.screenshots_json || null,
      data.features_json || null,
      data.contacts_json || null,
      data.raw_metadata_json || null,
      data.email || data.developer_email || null,
      data.telefone || null
    ]);
  },
  getAllLeadSistemas: async () => {
    await ensureSystemAppColumns();
    return allQuery(`
      SELECT *,
        CASE
          WHEN email IS NOT NULL AND TRIM(email) != '' THEN 1
          WHEN developer_email IS NOT NULL AND TRIM(developer_email) != '' THEN 1
          ELSE 0
        END as has_email_count
      FROM leads_sistemas
      WHERE is_blocked = 0
      ORDER BY id DESC
    `);
  },
  updateLeadSistema: async (id, data) => {
    const sql = `UPDATE leads_sistemas SET nome = ?, url = ?, descricao = ?, score_ux = ?, problemas = ?, is_validated = ? WHERE id = ?`;
    return runQuery(sql, [data.nome, data.url, data.descricao, data.score_ux, data.problemas, data.is_validated || 0, id]);
  },
  deleteLeadSistema: async (id) => {
    return runQuery(`DELETE FROM leads_sistemas WHERE id = ?`, [id]);
  },

  // === LEADS LINKEDIN ===
  createLeadLinkedin: async (data) => {
    const sql = `INSERT OR IGNORE INTO leads_linkedin (url, nome, cargo, empresa, localizacao, nicho, lead_empresa_id, lead_empresa_tipo, data_ultima_atualizacao, data_coleta) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    return runQuery(sql, [
      data.url, 
      data.nome, 
      data.cargo, 
      data.empresa, 
      data.localizacao, 
      data.nicho,
      data.lead_empresa_id || null,
      data.lead_empresa_tipo || 'site',
      data.data_ultima_atualizacao || new Date().toISOString(), 
      data.data_coleta || new Date().toISOString()
    ]);
  },
  getLinkedinByEmpresa: async (empresaId, tipo = 'site') => {
    return allQuery(
      `SELECT * FROM leads_linkedin WHERE lead_empresa_id = ? AND lead_empresa_tipo = ? AND is_blocked = 0 ORDER BY id DESC`,
      [empresaId, tipo]
    );
  },
  linkDecisionMakerToEmpresa: async (linkedinId, empresaId, tipo = 'site') => {
    return runQuery(
      `UPDATE leads_linkedin SET lead_empresa_id = ?, lead_empresa_tipo = ? WHERE id = ?`,
      [empresaId, tipo, linkedinId]
    );
  },
  getAllLeadLinkedin: async () => {
    return allQuery(`SELECT * FROM leads_linkedin WHERE is_blocked = 0 ORDER BY id DESC`);
  },
  updateLeadLinkedin: async (id, data) => {
    const sql = `UPDATE leads_linkedin SET url = ?, nome = ?, cargo = ?, empresa = ?, localizacao = ?, nicho = ? WHERE id = ?`;
    return runQuery(sql, [data.url, data.nome, data.cargo, data.empresa, data.localizacao, data.nicho, id]);
  },
  deleteLeadLinkedin: async (id) => {
    return runQuery(`DELETE FROM leads_linkedin WHERE id = ?`, [id]);
  },

  // === AUXILIARES (RESET E VALIDAÇÃO) ===
  setLeadValidation: async (table, id, status, manual = false) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    return runQuery(
      `UPDATE ${table} SET is_validated = ?, manual_validation = ? WHERE id = ?`,
      [status ? 1 : 0, manual && status ? 1 : 0, id]
    );
  },
  blockLead: async (table, id, status = true) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    return runQuery(`UPDATE ${table} SET is_blocked = ? WHERE id = ?`, [status ? 1 : 0, id]);
  },
  isUrlBlocked: async (url) => {
    const site = await getQuery(`SELECT id FROM leads_sites WHERE url = ? AND is_blocked = 1`, [url]);
    if (site) return true;
    const sistema = await getQuery(`SELECT id FROM leads_sistemas WHERE url = ? AND is_blocked = 1`, [url]);
    if (sistema) return true;
    const linkedin = await getQuery(`SELECT id FROM leads_linkedin WHERE url = ? AND is_blocked = 1`, [url]);
    if (linkedin) return true;
    return false;
  },
  resetLeads: async (table, nicheFilter = null) => {
    await ensureResetColumns();
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    const protectedWhere = buildProtectedLeadWhere(table);

    if (nicheFilter && table === 'leads_sites') {
      return runQuery(
        `DELETE FROM ${table} WHERE NOT (${protectedWhere}) AND descricao LIKE ?`,
        [`%${nicheFilter}%`]
      );
    }
    return runQuery(`DELETE FROM ${table} WHERE NOT (${protectedWhere})`, []);
  },
  cleanCapturedSiteLeads: async () => {
    await ensureResetColumns();
    const normalizedPhone = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone, '+55', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '')`;
    const keepWhere = `
      EXISTS (
        SELECT 1 FROM contatos c
        WHERE c.lead_id = leads_sites.id
          AND c.email IS NOT NULL
          AND TRIM(c.email) != ''
          AND LOWER(TRIM(c.email)) NOT LIKE '%encontrado%'
          AND LOWER(TRIM(c.email)) NOT IN ('n/a', 'null', 'undefined')
      )
      OR (
        telefone IS NOT NULL
        AND TRIM(telefone) != ''
        AND LENGTH(${normalizedPhone}) = 11
        AND SUBSTR(${normalizedPhone}, 3, 1) = '9'
      )
      OR (layout_status IS NOT NULL AND TRIM(layout_status) != '')
      OR (layout_gerado_path IS NOT NULL AND TRIM(layout_gerado_path) != '')
      OR (layout_preview_path IS NOT NULL AND TRIM(layout_preview_path) != '')
    `;

    await runQuery(`DELETE FROM contatos WHERE lead_id IN (SELECT id FROM leads_sites WHERE NOT (${keepWhere}))`);
    const sites = await runQuery(`DELETE FROM leads_sites WHERE NOT (${keepWhere})`);
    return {
      success: true,
      deleted: { sites: sites.changes || 0 }
    };
  },
  deleteAllLeads: async () => {
    await ensureResetColumns();
    const sitesProtected = buildProtectedLeadWhere('leads_sites');
    const sistemasProtected = buildProtectedLeadWhere('leads_sistemas');
    const linkedinProtected = buildProtectedLeadWhere('leads_linkedin');

    await runQuery(`DELETE FROM contatos WHERE lead_id IN (SELECT id FROM leads_sites WHERE NOT (${sitesProtected}))`);
    const sites = await runQuery(`DELETE FROM leads_sites WHERE NOT (${sitesProtected})`);
    const sistemas = await runQuery(`DELETE FROM leads_sistemas WHERE NOT (${sistemasProtected})`);
    const linkedin = await runQuery(`DELETE FROM leads_linkedin WHERE NOT (${linkedinProtected})`);

    return {
      success: true,
      deleted: {
        sites: sites.changes || 0,
        sistemas: sistemas.changes || 0,
        linkedin: linkedin.changes || 0
      }
    };
  },

  // === FLUXO DE E-MAIL E DOCUMENTACAO ===
  updateLeadDocumentacao: async (table, id, documentacao) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    return runQuery(`UPDATE ${table} SET documentacao = ? WHERE id = ?`, [documentacao, id]);
  },
  updateLeadEmailStatus: async (table, id, status) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    const sentAt = status ? new Date().toISOString() : null;
    return runQuery(`UPDATE ${table} SET email_enviado = ?, email_enviado_at = ? WHERE id = ?`, [status ? 1 : 0, sentAt, id]);
  },
  getEmailSendStatsToday: async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const since = start.toISOString();
    const tables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    let total = 0;
    for (const table of tables) {
      const row = await getQuery(`SELECT COUNT(*) as count FROM ${table} WHERE email_enviado = 1 AND email_enviado_at >= ?`, [since]);
      total += row?.count || 0;
    }
    return { sentToday: total, since };
  },
  updateLeadWppStatus: async (table, id, status) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    const sentAt = status ? new Date().toISOString() : null;
    return runQuery(`UPDATE ${table} SET wpp_enviado = ?, wpp_enviado_at = ? WHERE id = ?`, [status ? 1 : 0, sentAt, id]);
  },
  togglePinLead: async (table, id, status) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    return runQuery(`UPDATE ${table} SET is_pinned = ? WHERE id = ?`, [status ? 1 : 0, id]);
  },
  updateLeadRetornoStatus: async (table, id, status) => {
    const validTables = ['leads_sites', 'leads_sistemas', 'leads_linkedin'];
    if (!validTables.includes(table)) throw new Error("Tabela inválida");
    const respondeuAt = status ? new Date().toISOString() : null;
    return runQuery(`UPDATE ${table} SET respondeu_email = ?, respondeu_email_at = ? WHERE id = ?`, [status ? 1 : 0, respondeuAt, id]);
  },

  // === CRM OPERACIONAL ===
  addInteracao: async (leadId, leadTipo, canal, descricao) => {
    const canaisValidos = ['email', 'whatsapp', 'ligacao', 'reuniao', 'observacao'];
    if (!canaisValidos.includes(canal)) throw new Error('Canal inválido');
    const sql = `INSERT INTO crm_interacoes (lead_id, lead_tipo, canal, descricao, data_hora) VALUES (?, ?, ?, ?, ?)`;
    return runQuery(sql, [leadId, leadTipo, canal, descricao || '', new Date().toISOString()]);
  },
  getInteracoes: async (leadId, leadTipo) => {
    return allQuery(
      `SELECT * FROM crm_interacoes WHERE lead_id = ? AND lead_tipo = ? ORDER BY data_hora DESC`,
      [leadId, leadTipo]
    );
  },
  deleteInteracao: async (id) => {
    return runQuery(`DELETE FROM crm_interacoes WHERE id = ?`, [id]);
  },
  updateLeadFunil: async (table, id, status, proximoPasso, followupDate) => {
    const validTables = ['leads_sites', 'leads_sistemas'];
    if (!validTables.includes(table)) throw new Error('Tabela inválida para CRM');
    const validStatus = ['novo', 'contatado', 'respondeu', 'reuniao', 'proposta', 'fechado', 'perdido'];
    if (!validStatus.includes(status)) throw new Error('Status de funil inválido');
    return runQuery(
      `UPDATE ${table} SET funil_status = ?, proximo_passo = ?, followup_date = ? WHERE id = ?`,
      [status, proximoPasso || null, followupDate || null, id]
    );
  },

  // === CONFIGURACOES ===
  getConfig: async (chave) => {
    const row = await getQuery(`SELECT valor FROM configuracoes WHERE chave = ?`, [chave]);
    if (row && chave === 'gmail_pass') {
      try {
        const electron = require('electron');
        const safeStorage = electron.safeStorage || electron.app?.safeStorage;
        if (row.valor && row.valor.startsWith('enc:')) {
          if (safeStorage && safeStorage.isEncryptionAvailable()) {
            const buffer = Buffer.from(row.valor.slice(4), 'base64');
            row.valor = safeStorage.decryptString(buffer);
          } else {
            console.warn('safeStorage não disponível para decriptar a senha.');
            row.valor = ''; 
          }
        } else if (row.valor) {
          // Migração on-the-fly: senha legada em texto puro, vamos encriptar e salvar
          if (safeStorage && safeStorage.isEncryptionAvailable()) {
            const buffer = safeStorage.encryptString(row.valor);
            const encValue = 'enc:' + buffer.toString('base64');
            await runQuery(`UPDATE configuracoes SET valor = ? WHERE chave = ?`, [encValue, chave]);
          }
        }
      } catch (err) {
        console.error('Falha ao processar a senha do gmail:', err);
      }
    }
    return row;
  },
  setConfig: async (chave, valor) => {
    let finalValor = valor;
    if (chave === 'gmail_pass' && valor) {
      try {
        const electron = require('electron');
        const safeStorage = electron.safeStorage || electron.app?.safeStorage;
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const buffer = safeStorage.encryptString(valor);
          finalValor = 'enc:' + buffer.toString('base64');
        } else {
          console.warn('safeStorage não disponível para encriptar a senha.');
        }
      } catch (err) {
        console.error('Falha ao encriptar a senha do gmail:', err);
      }
    }

    const exists = await getQuery(`SELECT chave FROM configuracoes WHERE chave = ?`, [chave]);
    if (exists) {
      return runQuery(`UPDATE configuracoes SET valor = ? WHERE chave = ?`, [finalValor, chave]);
    } else {
      return runQuery(`INSERT INTO configuracoes (chave, valor) VALUES (?, ?)`, [chave, finalValor]);
    }
  },

  // === DASHBOARD ===
  getDashboardMetrics: async () => {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    // Total leads (Somando sites, sistemas e linkedin, excluindo bloqueados)
    const sitesResult = await getQuery(`SELECT COUNT(*) as count FROM leads_sites WHERE is_blocked = 0`);
    const sistemasResult = await getQuery(`SELECT COUNT(*) as count FROM leads_sistemas WHERE is_blocked = 0`);
    const linkedinResult = await getQuery(`SELECT COUNT(*) as count FROM leads_linkedin WHERE is_blocked = 0`);
    const totalLeads = (sitesResult.count || 0) + (sistemasResult.count || 0) + (linkedinResult.count || 0);

    // Analyzed today (Leads que foram auditados hoje - possuem score e data de atualização hoje)
    const sitesToday = await getQuery(`SELECT COUNT(*) as count FROM leads_sites WHERE is_blocked = 0 AND score_design IS NOT NULL AND data_ultima_atualizacao LIKE ?`, [`${today}%`]);
    const sistemasToday = await getQuery(`SELECT COUNT(*) as count FROM leads_sistemas WHERE is_blocked = 0 AND score_ux IS NOT NULL AND data_ultima_atualizacao LIKE ?`, [`${today}%`]);
    const linkedinToday = await getQuery(`SELECT COUNT(*) as count FROM leads_linkedin WHERE is_blocked = 0 AND score_design IS NOT NULL AND data_ultima_atualizacao LIKE ?`, [`${today}%`]);
    const analyzedToday = (sitesToday.count || 0) + (sistemasToday.count || 0) + (linkedinToday.count || 0);
    
    return {
      totalLeads,
      analyzedToday
    };
  },

  getLatestAnalyses: async (limit = 5) => {
    const sites = await allQuery(`SELECT *, 'site' as type FROM leads_sites WHERE is_blocked = 0 ORDER BY data_coleta DESC LIMIT ?`, [limit]);
    const sistemas = await allQuery(`SELECT *, 'sistema' as type FROM leads_sistemas WHERE is_blocked = 0 ORDER BY data_coleta DESC LIMIT ?`, [limit]);
    const linkedin = await allQuery(`SELECT *, 'linkedin' as type FROM leads_linkedin WHERE is_blocked = 0 ORDER BY data_coleta DESC LIMIT ?`, [limit]);
    const combined = [...sites, ...sistemas, ...linkedin]
      .sort((a, b) => new Date(b.data_coleta) - new Date(a.data_coleta))
      .slice(0, limit);
    return combined;
  },

  // Task 1 — Deduplicação entre execuções
  getExistingLeadKeys: async () => {
    const keys = new Set();
    const sites = await allQuery(`SELECT url, maps_url, titulo, localizacao FROM leads_sites`);
    const sistemas = await allQuery(`SELECT url, package_id FROM leads_sistemas`);
    sites.forEach(r => {
      if (r.url) keys.add(r.url);
      if (r.maps_url) keys.add(r.maps_url);
      if (r.titulo && r.localizacao) keys.add(`${r.titulo}|${r.localizacao}`);
    });
    sistemas.forEach(r => {
      if (r.url) keys.add(r.url);
      if (r.package_id) keys.add(r.package_id);
    });
    return keys;
  },

  // Task 3 — Dashboard estatísticas avançadas
  getDashboardStats: async () => {
    const today = new Date().toISOString().split('T')[0];
    const thirteenDaysAgo = new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0];

    const [
      totalSites, totalSistemas, totalLinkedin,
      emailEnviados, wppEnviados, responderam,
      reunioes, fechados,
      followupsDue
    ] = await Promise.all([
      getQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE is_blocked=0`),
      getQuery(`SELECT COUNT(*) as c FROM leads_sistemas WHERE is_blocked=0`),
      getQuery(`SELECT COUNT(*) as c FROM leads_linkedin WHERE is_blocked=0`),
      getQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE email_enviado=1`),
      getQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE wpp_enviado=1`),
      getQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE respondeu_email=1`),
      getQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE funil_status='reuniao'`),
      getQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE funil_status='fechado'`),
      allQuery(`SELECT COUNT(*) as c FROM leads_sites WHERE followup_date IS NOT NULL AND followup_date <= ? AND funil_status NOT IN ('fechado','perdido') AND is_blocked=0`, [today])
    ]);

    // Leads por dia (últimos 14 dias)
    const dailyRows = await allQuery(
      `SELECT substr(data_coleta,1,10) as dia, COUNT(*) as total
       FROM leads_sites WHERE data_coleta >= ? GROUP BY dia ORDER BY dia`,
      [thirteenDaysAgo]
    );
    const dailyMap = {};
    dailyRows.forEach(r => { dailyMap[r.dia] = r.total; });
    const dailyLeads = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      dailyLeads.push({ dia: d, total: dailyMap[d] || 0 });
    }

    return {
      totals: {
        sites: totalSites?.c || 0,
        sistemas: totalSistemas?.c || 0,
        linkedin: totalLinkedin?.c || 0,
        total: (totalSites?.c || 0) + (totalSistemas?.c || 0) + (totalLinkedin?.c || 0)
      },
      funil: {
        capturado: totalSites?.c || 0,
        contatado: emailEnviados?.c || wppEnviados?.c || 0,
        respondeu: responderam?.c || 0,
        reuniao: reunioes?.c || 0,
        fechado: fechados?.c || 0
      },
      followupsDue: followupsDue[0]?.c || 0,
      emailEnviados: emailEnviados?.c || 0,
      wppEnviados: wppEnviados?.c || 0,
      dailyLeads
    };
  },

  // Task 6 — Follow-ups vencidos
  getFollowupsDue: async () => {
    const today = new Date().toISOString().split('T')[0];
    const sites = await allQuery(
      `SELECT *, 'sites' as _tipo FROM leads_sites WHERE followup_date IS NOT NULL AND followup_date <= ? AND funil_status NOT IN ('fechado','perdido') AND is_blocked=0 ORDER BY followup_date`,
      [today]
    );
    const sistemas = await allQuery(
      `SELECT *, 'sistemas' as _tipo FROM leads_sistemas WHERE followup_date IS NOT NULL AND followup_date <= ? AND funil_status NOT IN ('fechado','perdido') AND is_blocked=0 ORDER BY followup_date`,
      [today]
    );
    return [...sites, ...sistemas];
  },

  // Task 9 — Templates de mensagem por nicho
  getMessageTemplates: async () => {
    return allQuery(`SELECT * FROM message_templates WHERE ativo=1 ORDER BY nicho, canal`);
  },
  saveMessageTemplate: async (data) => {
    if (data.id) {
      return runQuery(
        `UPDATE message_templates SET nicho=?, canal=?, has_site=?, nome=?, corpo=?, ativo=1 WHERE id=?`,
        [data.nicho || null, data.canal || 'whatsapp', data.has_site ?? null, data.nome, data.corpo, data.id]
      );
    }
    return runQuery(
      `INSERT INTO message_templates (nicho, canal, has_site, nome, corpo) VALUES (?,?,?,?,?)`,
      [data.nicho || null, data.canal || 'whatsapp', data.has_site ?? null, data.nome, data.corpo]
    );
  },
  deleteMessageTemplate: async (id) => {
    return runQuery(`UPDATE message_templates SET ativo=0 WHERE id=?`, [id]);
  },

  // T07 — Histórico de e-mails por lead
  addEmailHistory: async (leadId, leadTipo, toEmail, subject, bodyPreview) => {
    return runQuery(
      `INSERT INTO email_history (lead_id, lead_tipo, to_email, subject, body_preview) VALUES (?,?,?,?,?)`,
      [leadId, leadTipo, toEmail || '', subject || '', (bodyPreview || '').slice(0, 300)]
    );
  },
  getEmailHistory: async (leadId, leadTipo) => {
    return allQuery(`SELECT * FROM email_history WHERE lead_id=? AND lead_tipo=? ORDER BY sent_at DESC LIMIT 20`, [leadId, leadTipo]);
  },

  // T13 — Score override
  saveScoreOverride: async (table, id, value) => {
    const tbl = table === 'sistema' ? 'leads_sistemas' : 'leads_sites';
    return runQuery(`UPDATE ${tbl} SET score_override=? WHERE id=?`, [value === null ? null : Number(value), id]);
  },

  // T14 — Ticket value
  saveTicketValue: async (table, id, value) => {
    const tbl = table === 'sistema' ? 'leads_sistemas' : 'leads_sites';
    return runQuery(`UPDATE ${tbl} SET ticket_value=? WHERE id=?`, [value === null ? null : Number(value), id]);
  },

  // T27 — Activity log
  logActivity: async (tipo, detalhe, extra) => {
    return runQuery(`INSERT INTO activity_log (tipo, detalhe, extra) VALUES (?,?,?)`,
      [tipo, detalhe || '', extra ? JSON.stringify(extra) : null]);
  },
  getActivityLog: async (limit = 50) => {
    return allQuery(`SELECT * FROM activity_log ORDER BY criado_em DESC LIMIT ?`, [limit]);
  },

  // T10 — Backup/Restore/Export
  exportLeadsJson: async () => {
    const sites = await allQuery(`SELECT * FROM leads_sites WHERE is_blocked=0`);
    const sistemas = await allQuery(`SELECT * FROM leads_sistemas WHERE is_blocked=0`);
    const linkedin = await allQuery(`SELECT * FROM leads_linkedin WHERE is_blocked=0`);
    const interacoes = await allQuery(`SELECT * FROM crm_interacoes`);
    return { sites, sistemas, linkedin, interacoes, exportedAt: new Date().toISOString() };
  },
  importLeadsJson: async (data) => {
    let imported = 0;
    const sites = Array.isArray(data.sites) ? data.sites : [];
    for (const lead of sites) {
      try {
        const r = await crud.createLeadSite(lead);
        if (!r.duplicate) imported++;
      } catch (_) {}
    }
    return { imported, total: sites.length };
  }
};

module.exports = crud;
