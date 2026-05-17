const { contextBridge, ipcRenderer } = require('electron');

const safeInvoke = async (channel, ...args) => {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    console.error(`[IPC Error] Falha no canal '${channel}':`, error);
    return { success: false, error: `Falha de comunicação interna: ${error.message}` };
  }
};

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => safeInvoke('ping'),
  
  // Leads Sites (UI/UX)
  createLeadSite: (data) => safeInvoke('create-lead-site', data),
  getLeadSites: () => safeInvoke('get-lead-sites'),
  updateLeadSite: (id, data) => safeInvoke('update-lead-site', id, data),
  deleteLeadSite: (id) => safeInvoke('delete-lead-site', id),

  // Contatos
  createContato: (data) => safeInvoke('create-contato', data),
  getContatos: (leadId) => safeInvoke('get-contatos', leadId),
  updateContato: (id, data) => safeInvoke('update-contato', id, data),
  deleteContato: (id) => safeInvoke('delete-contato', id),

  // Leads Sistemas
  createLeadSistema: (data) => safeInvoke('create-lead-sistema', data),
  getLeadSistemas: () => safeInvoke('get-lead-sistemas'),
  updateLeadSistema: (id, data) => safeInvoke('update-lead-sistema', id, data),
  deleteLeadSistema: (id) => safeInvoke('delete-lead-sistema', id),

  // Dashboard
  getDashboardMetrics: () => safeInvoke('get-dashboard-metrics'),
  getLatestAnalyses: () => safeInvoke('get-latest-analyses'),

  // Busca & IA
  searchLeads: (data) => safeInvoke('search-leads', data),
  searchSistemas: (data) => safeInvoke('search-sistemas', data),
  analyzeLeadDesign: (data) => safeInvoke('analyze-lead', data),
  extractContact: (data) => safeInvoke('extract-contact', data),
  generatePrototype: (url, context) => safeInvoke('generate-prototype', url, context),
  generateClientLayout: (lead) => safeInvoke('generate-client-layout', lead),
  openUserManual: () => safeInvoke('open-path', '__CAPLEAD_USER_MANUAL__'),
  openFile: (path) => safeInvoke('open-file', path),
  openPath: (path) => safeInvoke('open-path', path),
  openExternalUrl: (url) => safeInvoke('open-external-url', url),
  checkSiteStatus: (id, url) => safeInvoke('check-site-status', { id, url }),
  setLeadValidation: (table, id, status, manual = false) => safeInvoke('set-lead-validation', table, id, status, manual),
  resetLeads: (table, nicheFilter) => safeInvoke('reset-leads', table, nicheFilter),
  totalReset: () => safeInvoke('total-reset'),
  cleanCapturedSiteLeads: () => safeInvoke('clean-captured-site-leads'),
  exportLeadsExcel: (data) => safeInvoke('export-leads-excel', data),
  blockLead: (table, id, status) => safeInvoke('block-lead', table, id, status),

  // Real-time events
  onDbUpdate: (callback) => {
    ipcRenderer.removeAllListeners('db-update');
    ipcRenderer.on('db-update', () => callback());
  },
  onCaptureProgress: (callback) => {
    ipcRenderer.removeAllListeners('capture-progress');
    ipcRenderer.on('capture-progress', (_event, progress) => callback(progress));
  },

  // E-mail & Configuração
  getConfig: (chave) => safeInvoke('get-config', chave),
  setConfig: (chave, valor) => safeInvoke('set-config', chave, valor),
  updateLeadDocumentacao: (table, id, doc) => safeInvoke('update-lead-documentacao', table, id, doc),
  updateLeadEmailStatus: (table, id, status) => safeInvoke('update-lead-email-status', table, id, status),
  getEmailSendStatsToday: () => safeInvoke('get-email-send-stats-today'),
  updateLeadWppStatus: (table, id, status) => safeInvoke('update-lead-wpp-status', table, id, status),
  updateLeadRetornoStatus: (table, id, status) => safeInvoke('update-lead-retorno-status', table, id, status),
  togglePinLead: (table, id, status) => safeInvoke('toggle-pin-lead', table, id, status),
  sendEmail: (to, subject, body, attachments) => safeInvoke('send-email', to, subject, body, attachments),
  verifySMTP: () => safeInvoke('verify-smtp'),
  createClientFolder: (data) => safeInvoke('create-client-folder', data),

  // Leads LinkedIn
  createLeadLinkedin: (data) => safeInvoke('create-lead-linkedin', data),
  getLeadLinkedin: () => safeInvoke('get-lead-linkedin'),
  updateLeadLinkedin: (id, data) => safeInvoke('update-lead-linkedin', id, data),
  deleteLeadLinkedin: (id) => safeInvoke('delete-lead-linkedin', id),
  searchLinkedin: (data) => safeInvoke('search-linkedin', data),

  // ABM: Decisores vinculados a empresa
  searchLinkedinForLead: (lead, tipo) => safeInvoke('search-linkedin-for-lead', lead, tipo),
  getLinkedinByEmpresa: (empresaId, tipo) => safeInvoke('get-linkedin-by-empresa', empresaId, tipo),
  linkDecisionMaker: (linkedinId, empresaId, tipo) => safeInvoke('link-decision-maker', linkedinId, empresaId, tipo),

  // CRM Operacional
  addInteracao: (leadId, leadTipo, canal, descricao) => safeInvoke('add-interacao', leadId, leadTipo, canal, descricao),
  getInteracoes: (leadId, leadTipo) => safeInvoke('get-interacoes', leadId, leadTipo),
  deleteInteracao: (id) => safeInvoke('delete-interacao', id),
  updateLeadFunil: (table, id, status, proximoPasso, followupDate) => safeInvoke('update-lead-funil', table, id, status, proximoPasso, followupDate),

  // Kentauros Integration
  getKentaurosConfig: () => safeInvoke('get-kentauros-config'),
  saveKentaurosConfig: (config) => safeInvoke('save-kentauros-config', config),
  exportToKentauros: (data) => safeInvoke('export-to-kentauros', data),
  onKentaurosExportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('kentauros-export-progress', listener);
    return () => ipcRenderer.removeListener('kentauros-export-progress', listener);
  },
  testKentaurosConnection: (url) => safeInvoke('test-kentauros-connection', url),
});
