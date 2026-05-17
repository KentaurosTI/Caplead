const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const isDev = !app || !app.isPackaged;
const dbFileName = 'database.sqlite';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(source, target) {
  if (!source || !fs.existsSync(source) || fs.existsSync(target)) return false;
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function createDailyBackup(source, backupDir) {
  if (!source || !fs.existsSync(source)) return;
  ensureDir(backupDir);
  const stamp = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(backupDir, `database-${stamp}.sqlite`);
  if (!fs.existsSync(backupPath)) fs.copyFileSync(source, backupPath);
}

function resolveDatabasePath() {
  if (isDev) {
    return path.join(__dirname, '..', dbFileName);
  }

  const userDataDir = app.getPath('userData');
  const persistentPath = path.join(userDataDir, dbFileName);
  const legacyCandidates = [
    path.join(process.resourcesPath || '', dbFileName),
    path.join(process.resourcesPath || '', 'database', dbFileName),
    path.join(path.dirname(app.getPath('exe')), dbFileName),
    path.join(__dirname, '..', dbFileName)
  ];

  const migrated = legacyCandidates.some(candidate => copyIfExists(candidate, persistentPath));
  if (migrated) {
    console.log(`[Database] Banco legado migrado para ${persistentPath}`);
  }

  createDailyBackup(persistentPath, path.join(userDataDir, 'backups'));
  return persistentPath;
}

const dbPath = resolveDatabasePath();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Ativando chaves estrangeiras no SQLite
db.run('PRAGMA foreign_keys = ON');

// Script de inicialização automática
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS leads_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      titulo TEXT,
      descricao TEXT,
      score_design INTEGER,
      problemas TEXT,
      data_ultima_atualizacao TEXT,
      data_coleta TEXT,
      is_validated INTEGER DEFAULT 0
    )
  `);

  // Ignora erro se a coluna já existir
  db.run(`ALTER TABLE leads_sites ADD COLUMN problemas TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN is_validated INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN manual_validation INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN layout_status TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN layout_gerado_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN layout_preview_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN layout_prompt_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN layout_gerado_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN telefone TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN categoria TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN localizacao TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN maps_url TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN site_oficial TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN has_digital_presence INTEGER DEFAULT 1`, () => {});


  db.run(`
    CREATE TABLE IF NOT EXISTS contatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      email TEXT,
      telefone TEXT,
      fonte TEXT,
      FOREIGN KEY(lead_id) REFERENCES leads_sites(id) ON DELETE CASCADE
    )
  `);

  db.run(`ALTER TABLE contatos ADD COLUMN fonte TEXT`, () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS leads_sistemas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      url TEXT,
      descricao TEXT,
      score_ux INTEGER,
      problemas TEXT,
      data_ultima_atualizacao TEXT,
      data_coleta TEXT,
      is_validated INTEGER DEFAULT 0
    )
  `);

  db.run(`ALTER TABLE leads_sistemas ADD COLUMN problemas TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN data_ultima_atualizacao TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN data_coleta TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN is_validated INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN manual_validation INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN layout_status TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN layout_gerado_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN layout_preview_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN layout_prompt_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN layout_gerado_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN tipo_origem TEXT DEFAULT 'web'`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN app_store_url TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN package_id TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN developer_name TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN developer_email TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN developer_site TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN privacy_policy_url TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN app_category TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN rating TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN reviews_count TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN installs TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN last_update TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN icon_url TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN screenshots_json TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN features_json TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN contacts_json TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN raw_metadata_json TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN email TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN telefone TEXT`, () => {});
  
  // Novas colunas para fluxo de E-mail
  db.run(`ALTER TABLE leads_sites ADD COLUMN documentacao TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN email_enviado INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN wpp_enviado INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN wpp_enviado_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN is_pinned INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN is_blocked INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN documentacao TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN email_enviado INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN wpp_enviado INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN wpp_enviado_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN is_pinned INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN is_blocked INTEGER DEFAULT 0`, () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS leads_linkedin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE,
      nome TEXT,
      cargo TEXT,
      empresa TEXT,
      localizacao TEXT,
      nicho TEXT,
      score_design INTEGER,
      problemas TEXT,
      breakdown_score TEXT,
      is_validated INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      email_enviado INTEGER DEFAULT 0,
      wpp_enviado INTEGER DEFAULT 0,
      wpp_enviado_at TEXT,
      documentacao TEXT,
      data_coleta TEXT,
      data_ultima_atualizacao TEXT,
      lead_empresa_id INTEGER,
      lead_empresa_tipo TEXT DEFAULT 'site'
    )
  `);

  db.run(`ALTER TABLE leads_linkedin ADD COLUMN lead_empresa_id INTEGER`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN lead_empresa_tipo TEXT DEFAULT 'site'`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN manual_validation INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN layout_status TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN layout_gerado_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN layout_preview_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN layout_prompt_path TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN layout_gerado_at TEXT`, () => {});

  db.run(`ALTER TABLE leads_sites ADD COLUMN breakdown_score TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN breakdown_score TEXT`, () => {});

  // === CRM Operacional: campos de funil e follow-up ===
  db.run(`ALTER TABLE leads_sites ADD COLUMN funil_status TEXT DEFAULT 'novo'`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN proximo_passo TEXT`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN followup_date TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN funil_status TEXT DEFAULT 'novo'`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN proximo_passo TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN followup_date TEXT`, () => {});

  // === Tabela de interações multicanal ===
  db.run(`
    CREATE TABLE IF NOT EXISTS crm_interacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      lead_tipo TEXT NOT NULL,
      canal TEXT NOT NULL,
      descricao TEXT,
      data_hora TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    )
  `);

  // Colunas de contato WPP (migração para bancos existentes)
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN wpp_enviado INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN wpp_enviado_at TEXT`, () => {});

  // Coluna de data/hora do envio de email (migração para bancos existentes)
  db.run(`ALTER TABLE leads_sites ADD COLUMN email_enviado_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN email_enviado_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN email_enviado_at TEXT`, () => {});

  // Status de acessibilidade do site (online / offline / pendente)
  db.run(`ALTER TABLE leads_sites ADD COLUMN site_status TEXT DEFAULT 'pendente'`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN site_status_at TEXT`, () => {});

  // Rastreamento de retorno/resposta do cliente (migração para bancos existentes)
  db.run(`ALTER TABLE leads_sites ADD COLUMN respondeu_email INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sites ADD COLUMN respondeu_email_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN respondeu_email INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN respondeu_email_at TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN respondeu_email INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN respondeu_email_at TEXT`, () => {});

  db.run(`ALTER TABLE leads_linkedin ADD COLUMN score_design INTEGER`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN problemas TEXT`, () => {});
  db.run(`ALTER TABLE leads_linkedin ADD COLUMN breakdown_score TEXT`, () => {});

  // Índices de Unicidade para evitar duplicatas
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sites_url ON leads_sites (url)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sistemas_url ON leads_sistemas (url)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sistemas_package ON leads_sistemas (package_id) WHERE package_id IS NOT NULL AND TRIM(package_id) != ''`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_sistemas_origem ON leads_sistemas (tipo_origem)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_linkedin_url ON leads_linkedin (url)`);
});

module.exports = db;
