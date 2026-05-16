const https = require('https');
const http = require('http');
const crud = require('./crud');
const { applyAiProjectValue } = require('./aiProjectValueEstimator');

const DEFAULT_KENTAUROS_URL = 'https://kentauros-os-app.vercel.app';
const BATCH_SIZE = 12;
const REQUEST_TIMEOUT_MS = 120000;

const normalizeKentaurosBaseUrl = (input) => {
  let url = String(input || DEFAULT_KENTAUROS_URL).trim();
  if (!url) url = DEFAULT_KENTAUROS_URL;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/leads\/?$/i, '');
  return url;
};

const normalizeLeadForKentauros = (lead) => {
  const pricedLead = applyAiProjectValue(lead);

  return {
    nome: pricedLead.nome || pricedLead.titulo || pricedLead.company || '',
    empresa: pricedLead.empresa || pricedLead.titulo || pricedLead.company || '',
    titulo: pricedLead.titulo || pricedLead.nome || '',
    site_oficial: pricedLead.site_oficial || pricedLead.website || pricedLead.url || '',
    url: pricedLead.site_oficial || pricedLead.website || pricedLead.url || pricedLead.maps_url || '',
    email: pricedLead.email || pricedLead.contato_email || '',
    telefone: pricedLead.telefone || pricedLead.phone || '',
    nicho: pricedLead.nicho || pricedLead.industry || '',
    categoria: pricedLead.categoria || pricedLead.category || '',
    cidade: pricedLead.cidade || pricedLead.city || '',
    estado: pricedLead.estado || pricedLead.state || '',
    localizacao: pricedLead.localizacao || '',
    descricao: pricedLead.descricao || pricedLead.description || '',
    maps_url: pricedLead.maps_url || '',
    source: pricedLead.captureSource || pricedLead.source || '',
    value: pricedLead.value,
    estimatedValue: pricedLead.estimatedValue,
    valor_estimado: pricedLead.valor_estimado,
    pricingModel: pricedLead.pricingModel,
    pricingBasis: pricedLead.pricingBasis,
  };
};

function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reject(new Error(`URL inválida: ${url}`));
      return;
    }

    const payload = body ? Buffer.from(body, 'utf8') : null;
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CapLead/1.0',
          ...headers,
          ...(payload ? { 'Content-Length': payload.length } : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = {};
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { message: text.slice(0, 200) };
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );

    req.on('error', (error) => {
      reject(new Error(`Falha de rede ao conectar em ${parsed.origin}: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout (${Math.round(timeoutMs / 1000)}s) ao enviar para ${parsed.origin}`));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function postImportBatch(baseUrl, batch, meta, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-caplead-api-key'] = apiKey;

  const body = JSON.stringify({
    leads: batch,
    userId: meta.userId ?? 1,
    userEmail: meta.userEmail || '',
    userName: meta.userName || meta.capturedBySource || 'CapLead',
    capturedBySource: meta.capturedBySource || 'CapLead',
    tenantId: meta.tenantId || 'tenant-a',
  });

  const { status, json } = await requestJson(`${baseUrl}/api/leads/import`, {
    method: 'POST',
    headers,
    body,
  });

  if (status < 200 || status >= 300 || !json.success) {
    const message = json.message || json.error || `HTTP ${status}`;
    throw new Error(message);
  }

  return json.summary || { imported: 0, duplicates: 0, failed: 0, total: batch.length };
}

async function getCaptureSourceName(override) {
  const custom = String(override || '').trim();
  if (custom) return custom;

  const sign = await crud.getConfig('smtp_signature');
  return String(sign?.valor || '').trim() || 'CapLead';
}

async function getKentaurosConfig() {
  const [urlConfig, enabledConfig, apiKeyConfig, tenantConfig, userIdConfig] = await Promise.all([
    crud.getConfig('kentauros_url'),
    crud.getConfig('kentauros_enabled'),
    crud.getConfig('kentauros_api_key'),
    crud.getConfig('kentauros_tenant_id'),
    crud.getConfig('kentauros_user_id'),
  ]);

  return {
    url: normalizeKentaurosBaseUrl(urlConfig?.valor || DEFAULT_KENTAUROS_URL),
    enabled: enabledConfig?.valor === '1' || enabledConfig?.valor === 'true',
    apiKey: apiKeyConfig?.valor || process.env.CAPLEAD_KENTAUROS_API_KEY || '',
    tenantId: tenantConfig?.valor || process.env.CAPLEAD_KENTAUROS_TENANT_ID || 'tenant-a',
    userId: userIdConfig?.valor ? Number(userIdConfig.valor) : 1,
  };
}

async function enrichLeadsFromDatabase(leads = [], source = 'sites') {
  const enriched = [];

  for (const lead of leads) {
    const row = { ...lead };
    if (!row.email && row.id) {
      try {
        const contacts = await crud.getContatosByLead(row.id);
        const primaryEmail = contacts.find((c) => c.email && String(c.email).trim());
        if (primaryEmail) row.email = primaryEmail.email;
        if (!row.telefone) {
          const primaryPhone = contacts.find((c) => c.telefone && String(c.telefone).trim());
          if (primaryPhone) row.telefone = primaryPhone.telefone;
        }
      } catch {
        // segue sem contato extra
      }
    }
    enriched.push(row);
  }

  return enriched;
}

async function resolveLeadsForExport({ leads, leadIds, source = 'sites' }) {
  if (leads?.length) {
    return enrichLeadsFromDatabase(leads, source);
  }

  if (!leadIds?.length) return [];

  let allLeads = [];
  if (source === 'sistemas') {
    allLeads = await crud.getAllLeadSistemas();
  } else if (source === 'linkedin') {
    allLeads = await crud.getAllLeadLinkedin();
  } else {
    allLeads = await crud.getAllLeadSites();
  }

  const idSet = new Set(leadIds.map((id) => Number(id)));
  const selected = allLeads.filter((lead) => idSet.has(Number(lead.id)));
  return enrichLeadsFromDatabase(selected, source);
}

async function exportLeadsToKentauros({
  kentaurosUrl,
  leads,
  leadIds,
  source,
  userId,
  userEmail,
  userName,
  capturedBySource,
  tenantId,
  apiKey,
  onProgress,
} = {}) {
  const config = await getKentaurosConfig();
  const baseUrl = normalizeKentaurosBaseUrl(kentaurosUrl || config.url);
  const resolvedLeads = await resolveLeadsForExport({ leads, leadIds, source });

  if (!resolvedLeads.length) {
    return { success: false, error: 'Nenhum lead para exportar', skipped: true };
  }

  const captureSourceName = await getCaptureSourceName(capturedBySource);
  const normalizedLeads = resolvedLeads.map((lead) =>
    normalizeLeadForKentauros({ ...lead, captureSource: captureSourceName })
  );
  const meta = {
    userId: userId ?? config.userId ?? 1,
    userEmail,
    userName: captureSourceName,
    capturedBySource: captureSourceName,
    tenantId: tenantId || config.tenantId || 'tenant-a',
  };
  const resolvedApiKey = apiKey || config.apiKey;

  console.log('[Kentauros Export] Enviando', normalizedLeads.length, 'lead(s) em lotes para', baseUrl);

  const totals = { imported: 0, duplicates: 0, failed: 0, total: normalizedLeads.length };
  const batches = Math.ceil(normalizedLeads.length / BATCH_SIZE);

  for (let i = 0; i < normalizedLeads.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const batch = normalizedLeads.slice(i, i + BATCH_SIZE);

    if (onProgress) {
      onProgress({
        batch: batchIndex,
        batches,
        message: `Enviando lote ${batchIndex}/${batches} (${batch.length} leads)...`,
      });
    }

    const summary = await postImportBatch(baseUrl, batch, meta, resolvedApiKey);
    totals.imported += summary.imported || 0;
    totals.duplicates += summary.duplicates || 0;
    totals.failed += summary.failed || 0;
  }

  console.log('[Kentauros Export] Concluído:', totals);

  return {
    success: true,
    imported: totals.imported,
    duplicates: totals.duplicates,
    failed: totals.failed,
    summary: totals,
  };
}

async function syncCapturedLeadsToKentauros(leads, actor = {}) {
  const config = await getKentaurosConfig();
  if (!config.enabled) {
    return { success: true, skipped: true, reason: 'Kentauros sync disabled' };
  }

  return exportLeadsToKentauros({
    kentaurosUrl: config.url,
    leads,
    userId: actor.userId,
    userEmail: actor.userEmail,
    userName: actor.userName,
    tenantId: actor.tenantId || config.tenantId,
    apiKey: config.apiKey,
  });
}

async function testKentaurosConnection(kentaurosUrl) {
  const baseUrl = normalizeKentaurosBaseUrl(kentaurosUrl);
  const { status, json } = await requestJson(`${baseUrl}/api/leads/import`, { method: 'GET', timeoutMs: 30000 });
  return { success: json.ok === true, data: json, status };
}

module.exports = {
  DEFAULT_KENTAUROS_URL,
  normalizeKentaurosBaseUrl,
  getCaptureSourceName,
  getKentaurosConfig,
  exportLeadsToKentauros,
  syncCapturedLeadsToKentauros,
  testKentaurosConnection,
  normalizeLeadForKentauros,
};
