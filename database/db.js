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

  // Task 9 — Templates de mensagem por nicho
  db.run(`
    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nicho TEXT,
      canal TEXT NOT NULL DEFAULT 'whatsapp',
      has_site INTEGER,
      nome TEXT NOT NULL,
      corpo TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seeds dos templates padrão (inseridos apenas se a tabela estiver vazia)
  db.get(`SELECT COUNT(*) as c FROM message_templates`, [], (err, row) => {
    if (err || (row && row.c > 0)) return;
    const defaults = [
      { nicho: null, canal: 'whatsapp', has_site: 1, nome: 'Com site — Diagnóstico rápido', corpo: 'Olá! Tudo bem?\n\nEstava analisando rapidamente o {{empresa}}{{cidade}} e percebi alguns pontos que podem estar dificultando a transformação de visitantes em novos contatos.\n\nNada grave, mas são detalhes que costumam fazer pessoas interessadas desistirem antes mesmo de iniciar uma conversa.\n\nTrabalho na Kentauros, uma empresa especializada em identificar e corrigir esses gargalos digitais por meio de soluções tecnológicas.\n\nSe fizer sentido para você, posso te enviar um diagnóstico rápido com os 3 principais pontos que observei.' },
      { nicho: null, canal: 'whatsapp', has_site: 0, nome: 'Sem site — Proposta com exemplo', corpo: 'Olá! Tudo bem?\n\nVi que o {{empresa}}{{cidade}} ainda não tem um site e quis entrar em contato.\n\nMuitas empresas locais perdem clientes todo dia simplesmente por não aparecerem quando alguém pesquisa no Google.\n\nNa Kentauros criamos sites profissionais e rápidos focados em trazer novos clientes — e já ajudamos negócios parecidos com o seu.\n\nPosso te enviar um exemplo do que faríamos para o {{empresa}}? É rápido e sem custo nenhum.' },
      { nicho: 'saúde', canal: 'whatsapp', has_site: 1, nome: 'Saúde — Clínicas com site', corpo: 'Olá! Tudo bem?\n\nEstava fazendo uma análise de clínicas em {{cidade}} e vi o site do {{empresa}}.\n\nIdentifiquei alguns pontos que podem estar reduzindo o número de pacientes que entram em contato pelo site — especialmente vindo do Google.\n\nSou da Kentauros, especialistas em presença digital para clínicas e consultórios. Posso te enviar os 3 principais pontos em menos de 2 minutos?' },
      { nicho: 'juridico', canal: 'whatsapp', has_site: 1, nome: 'Jurídico — Escritórios com site', corpo: 'Olá! Tudo bem?\n\nAnalisei o site do {{empresa}}{{cidade}} e notei alguns pontos técnicos que podem estar prejudicando o posicionamento no Google e a conversão de visitantes em clientes.\n\nAtuamos com presença digital para escritórios de advocacia e consultórios jurídicos. Posso compartilhar um diagnóstico rápido e sem compromisso?' },
      { nicho: 'beleza', canal: 'whatsapp', has_site: 0, nome: 'Beleza — Sem site', corpo: 'Olá! Tudo bem?\n\nPassei pelo {{empresa}}{{cidade}} e vi que ainda não aparece no Google com site próprio.\n\nHoje, quem busca "salão de beleza em {{cidade}}" encontra a concorrência antes de você. Um site simples e rápido pode mudar isso completamente.\n\nCriamos sites para salões e estúdios com foco em agendar mais clientes. Posso te mostrar um exemplo?' }
    ];
    const stmt = db.prepare(`INSERT INTO message_templates (nicho, canal, has_site, nome, corpo) VALUES (?,?,?,?,?)`);
    defaults.forEach(t => stmt.run([t.nicho, t.canal, t.has_site ?? null, t.nome, t.corpo]));
    stmt.finalize();
  });

  // T13 — Score override manual
  db.run(`ALTER TABLE leads_sites ADD COLUMN score_override INTEGER`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN score_override INTEGER`, () => {});

  // T14 — Valor estimado do contrato
  db.run(`ALTER TABLE leads_sites ADD COLUMN ticket_value REAL`, () => {});
  db.run(`ALTER TABLE leads_sistemas ADD COLUMN ticket_value REAL`, () => {});

  // T07 — Histórico de e-mails por lead
  db.run(`
    CREATE TABLE IF NOT EXISTS email_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      lead_tipo TEXT NOT NULL,
      to_email TEXT,
      subject TEXT,
      body_preview TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'sent'
    )
  `);

  // T27 — Log de atividades do sistema
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      detalhe TEXT,
      extra TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    )
  `);

  // Índices de Unicidade para evitar duplicatas
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sites_url ON leads_sites (url)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sistemas_url ON leads_sistemas (url)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sistemas_package ON leads_sistemas (package_id) WHERE package_id IS NOT NULL AND TRIM(package_id) != ''`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_sistemas_origem ON leads_sistemas (tipo_origem)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_linkedin_url ON leads_linkedin (url)`);
});

// ── Sistema de Migrações ───────────────────────────────────────────────────────
// Tabela de controle de versão de schema. Cada migração é numerada e idempotente.
// Novas colunas/índices devem ser adicionados aqui (não como ALTER TABLE avulsos).

const MIGRATIONS = [
  // Migração 001: baseline — registra o estado inicial do schema.
  // Todas as colunas existentes foram criadas pelos ALTER TABLE no bloco acima.
  // Esta entrada serve como ponto de partida para rastrear versões futuras.
  { version: 1, description: 'baseline schema', sql: [] },

  // Para adicionar novas colunas, crie uma entrada aqui e NÃO use ALTER TABLE avulso:
  // { version: 2, description: 'add column X to leads_sites', sql: [
  //   `ALTER TABLE leads_sites ADD COLUMN x TEXT`
  // ]},
];

function runMigrations(database) {
  database.serialize(() => {
    database.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        description TEXT,
        applied_at TEXT NOT NULL
      )
    `);
  });

  MIGRATIONS.forEach(({ version, description, sql }) => {
    database.get(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [version],
      (err, row) => {
        if (err) {
          console.error(`[Migration] Erro ao verificar v${version}:`, err);
          return;
        }
        if (row) return;

        database.serialize(() => {
          sql.forEach(stmt =>
            database.run(stmt, (runErr) => {
              if (runErr) console.error(`[Migration v${version}] Erro ao executar SQL:`, runErr);
            })
          );
          database.run(
            'INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)',
            [version, description, new Date().toISOString()],
            (insertErr) => {
              if (insertErr) console.error(`[Migration] Erro ao registrar v${version}:`, insertErr);
              else console.log(`[Migration] v${version} aplicada: ${description}`);
            }
          );
        });
      }
    );
  });
}

runMigrations(db);

module.exports = db;
