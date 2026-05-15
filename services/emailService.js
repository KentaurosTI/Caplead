const nodemailer = require('nodemailer');
const crud = require('./crud');
const fs = require('fs');
const path = require('path');

const DEFAULT_SMTP = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: 'kentaurusti@gmail.com'
};

function getDefaultSmtpFromFile() {
  const candidates = [
    process.env.CAPLEAD_SMTP_CONFIG,
    path.join(process.resourcesPath || '', 'config', 'default-smtp.json'),
    path.join(process.cwd(), 'config', 'default-smtp.json'),
    path.join(__dirname, '..', 'config', 'default-smtp.json')
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (error) {
      console.warn(`[EmailService] Não foi possível carregar SMTP padrão em ${filePath}:`, error.message);
    }
  }

  return {};
}

function normalizeSmtpSecurity(port, secureRaw) {
  const numericPort = Number(port) || DEFAULT_SMTP.port;
  if (numericPort === 465) return true;
  if (numericPort === 587 || numericPort === 25) return false;
  if (secureRaw !== undefined && secureRaw !== null && secureRaw !== '') return secureRaw === true || secureRaw === 'true';
  return false;
}

async function buildTransportConfig() {
  const defaultSmtp = { ...DEFAULT_SMTP, ...getDefaultSmtpFromFile() };
  const host = (await crud.getConfig('smtp_host'))?.valor || defaultSmtp.host;
  const portRaw = (await crud.getConfig('smtp_port'))?.valor || String(defaultSmtp.port);
  const secureRaw = (await crud.getConfig('smtp_secure'))?.valor;
  const user = (await crud.getConfig('smtp_user'))?.valor || (await crud.getConfig('gmail_user'))?.valor || defaultSmtp.user;
  const rawPass = (await crud.getConfig('gmail_pass'))?.valor || process.env.CAPLEAD_SMTP_APP_PASSWORD || defaultSmtp.pass || defaultSmtp.password;
  const pass = rawPass ? String(rawPass).replace(/\s+/g, '') : '';
  const port = Number(portRaw) || defaultSmtp.port;
  const secure = normalizeSmtpSecurity(port, secureRaw);

  if (!user || !pass) {
    throw new Error('Senha de app SMTP não encontrada. Informe a senha de app uma vez em Configurações ou gere a build com config/default-smtp.json.');
  }

  return { 
    host, 
    port, 
    secure, 
    user, 
    pass 
  };
}

function createTransporter({ host, port, secure, user, pass }) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && Number(port) === 587,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      minVersion: 'TLSv1.2'
    },
    auth: { user, pass }
  });
}

async function tryVerify(transporter) {
  return new Promise((resolve, reject) => {
    // Timeout de 10 segundos para não travar a UI
    const timer = setTimeout(() => reject(new Error('Timeout na conexão SMTP (10s)')), 10000);
    transporter.verify((err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(true);
    });
  });
}

function mapSmtpError(err) {
  const code = err.code || '';
  const msg = err.message || '';

  if (code === 'EAUTH' || msg.includes('Invalid credentials')) {
    return 'Falha na autenticação: revise e-mail, senha/app password e permissões SMTP do provedor.';
  }
  if (code === 'ETIMEDOUT') {
    return 'Tempo esgotado: a conexão com o servidor SMTP demorou muito. Verifique internet, firewall e porta configurada.';
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return 'Conexão recusada: não foi possível conectar ao servidor SMTP. Verifique host, porta, SSL/TLS e antivírus/firewall.';
  }
  if (code === 'ENOTFOUND') {
    return 'Servidor não encontrado: verifique sua conexão com a internet ou o host SMTP informado.';
  }
  if (msg.includes('WRONG_VERSION_NUMBER')) {
    return 'SSL/TLS incompatível com a porta configurada. Use porta 465 com SSL direto ou porta 587 com STARTTLS.';
  }
  if (msg.includes('Timeout')) {
    return 'Tempo esgotado na tentativa de conexão (10s). Verifique sua rede.';
  }

  return msg || 'Erro desconhecido na configuração SMTP.';
}

async function sendEmail(to, subject, htmlBody, attachments = []) {
  if (!to || !to.trim()) {
    throw new Error('Endereço de e-mail de destino não informado.');
  }

  const config = await buildTransportConfig();
  console.log(`[EmailService] Tentando autenticação SMTP em ${config.host}:${config.port} para user=${config.user}`);

  let transporter = createTransporter(config);

  try {
    await tryVerify(transporter);
    console.log('[EmailService] ✓ Conexão SMTP verificada com sucesso.');
  } catch (err) {
    const friendlyError = mapSmtpError(err);
    console.error('[EmailService] ✗ Falha na conexão:', friendlyError);
    throw new Error(
      `Falha na autenticação SMTP: ${friendlyError}\n\n` +
      `Revise as configurações em Configurações > SMTP. Gmail e Microsoft podem exigir senha de app ou SMTP autenticado.`
    );
  }

  // Prepara o corpo do e-mail. Se receber texto puro com \n, substitui por <br/>
  // Caso já seja HTML (começa com <div ou possui tags), mantém como está (para retrocompatibilidade)
  let finalHtmlBody = htmlBody;
  if (!htmlBody.trim().startsWith('<') && !htmlBody.includes('<p>')) {
    finalHtmlBody = htmlBody.replace(/\n/g, '<br/>');
  }

  const mailOptions = {
    from: `"CapLead AI" <${config.user}>`,
    to,
    subject,
    html: finalHtmlBody,
  };

  if (attachments && attachments.length > 0) {
    const { app } = require('electron');
    
    mailOptions.attachments = attachments
      .map(item => {
        let filePath = item.path;
        if (item.name === 'Assinatura.png') {
          // Resolve caminho do asset na build ou no ambiente de dev
          const candidates = [
            app?.isPackaged ? path.join(process.resourcesPath, 'assets', 'Assinatura.png') : null,
            path.join(process.cwd(), 'assets', 'Assinatura.png'),
            path.join(process.cwd(), 'src', 'Assinatura.png'),
            path.join(__dirname, '..', 'assets', 'Assinatura.png'),
            path.join(__dirname, '..', 'src', 'Assinatura.png')
          ].filter(Boolean);
          filePath = candidates.find(candidate => fs.existsSync(candidate)) || item.path;
        }
        return { 
          path: filePath, 
          filename: item.filename || item.name,
          cid: item.cid
        };
      })
      .filter(item => fs.existsSync(item.path));
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] ✓ E-mail enviado! MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (sendErr) {
    console.error('[EmailService] Erro no sendMail:', sendErr);
    throw new Error('Erro ao enviar o e-mail: ' + mapSmtpError(sendErr));
  }
}

async function verifySMTP() {
  try {
    const config = await buildTransportConfig();
    const transporter = createTransporter(config);
    await tryVerify(transporter);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapSmtpError(err) };
  }
}

module.exports = { sendEmail, verifySMTP };
