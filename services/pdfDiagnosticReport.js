const fs = require('fs');
const path = require('path');

/**
 * Gera um relatório de diagnóstico em HTML (convertido para PDF via Puppeteer)
 * com os problemas identificados no site do lead, em linguagem comercial.
 */
async function generateDiagnosticReport({ lead, problems = [], score = 0, breakdown = null }) {
  const company = lead.nome || lead.titulo || lead.empresa || 'sua empresa';
  const url = lead.url || lead.site_oficial || '';
  const date = new Date().toLocaleDateString('pt-BR');

  const scoreColor = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score >= 70 ? 'Bom' : score >= 50 ? 'Regular' : 'Crítico';

  const categoryIcons = {
    'Performance': '⚡',
    'SEO': '🔍',
    'Mobile': '📱',
    'Design': '🎨',
    'UX': '👆',
    'Acessibilidade': '♿'
  };

  const displayProblems = problems.slice(0, 6);

  const problemsHtml = displayProblems.map((p, i) => {
    const raw = typeof p === 'string' ? p : (p.impact || String(p));
    const catMatch = raw.match(/^([A-Za-záéíóúÁÉÍÓÚ\s/]+):\s*/);
    const category = catMatch ? catMatch[1].trim() : 'Site';
    const detail = catMatch ? raw.slice(catMatch[0].length) : raw;
    const icon = categoryIcons[category] || '⚠️';
    const bgColor = i % 2 === 0 ? '#1e293b' : '#162032';
    return `
      <div style="background:${bgColor};border-radius:12px;padding:16px 20px;margin-bottom:10px;border-left:3px solid #3b82f6;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="font-size:20px;margin-top:2px;">${icon}</span>
          <div>
            <div style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${category}</div>
            <div style="color:#e2e8f0;font-size:14px;line-height:1.5;">${detail}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  const breakdownHtml = breakdown ? (() => {
    const items = [
      { label: 'Performance', value: breakdown.performance || 0, max: 30 },
      { label: 'SEO', value: breakdown.seo || 0, max: 25 },
      { label: 'UX / Design', value: breakdown.ux || 0, max: 25 },
      { label: 'Mobile', value: breakdown.mobile || 0, max: 20 },
    ];
    return items.map(item => {
      const pct = Math.round((item.value / item.max) * 100);
      const barColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="color:#cbd5e1;font-size:12px;">${item.label}</span>
            <span style="color:#94a3b8;font-size:12px;">${item.value}/${item.max}</span>
          </div>
          <div style="background:#1e293b;border-radius:6px;height:6px;">
            <div style="background:${barColor};width:${pct}%;height:6px;border-radius:6px;"></div>
          </div>
        </div>`;
    }).join('');
  })() : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #1e293b; }
  .brand { font-size: 22px; font-weight: 900; color: #fff; letter-spacing: -0.5px; }
  .brand span { color: #3b82f6; }
  .date { color: #64748b; font-size: 13px; }
  .lead-info { background: #1e293b; border-radius: 16px; padding: 24px; margin-bottom: 28px; }
  .lead-name { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px; }
  .lead-url { color: #64748b; font-size: 13px; }
  .score-section { display: flex; align-items: center; gap: 24px; margin-bottom: 28px; background: #1e293b; border-radius: 16px; padding: 24px; }
  .score-circle { width: 90px; height: 90px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 4px solid ${scoreColor}; flex-shrink: 0; }
  .score-num { font-size: 32px; font-weight: 900; color: ${scoreColor}; line-height: 1; }
  .score-label-small { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .score-text h3 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px; }
  .score-text p { color: #94a3b8; font-size: 13px; line-height: 1.5; }
  .section-title { font-size: 13px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
  .cta { background: linear-gradient(135deg, #1d4ed8, #2563eb); border-radius: 16px; padding: 28px; text-align: center; margin-top: 28px; }
  .cta h3 { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 8px; }
  .cta p { color: #bfdbfe; font-size: 13px; margin-bottom: 16px; }
  .cta-tag { display: inline-block; background: #fff; color: #1d4ed8; font-weight: 800; font-size: 13px; padding: 10px 24px; border-radius: 100px; }
  .footer { margin-top: 24px; text-align: center; color: #334155; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">Kent<span>auros</span></div>
    <div class="date">Diagnóstico gerado em ${date}</div>
  </div>

  <div class="lead-info">
    <div class="lead-name">${company}</div>
    ${url ? `<div class="lead-url">🌐 ${url}</div>` : ''}
  </div>

  <div class="score-section">
    <div class="score-circle">
      <div class="score-num">${Math.max(0, score)}</div>
      <div class="score-label-small">${scoreLabel}</div>
    </div>
    <div class="score-text">
      <h3>Pontuação Digital: ${scoreLabel}</h3>
      <p>
        ${score < 50
          ? 'O site apresenta problemas críticos que estão prejudicando a visibilidade no Google e a experiência dos visitantes. Cada dia sem correção representa clientes que estão indo para a concorrência.'
          : score < 70
          ? 'O site tem uma base razoável, mas há oportunidades claras de melhoria que podem dobrar a quantidade de visitantes que se tornam clientes.'
          : 'O site está em bom estado geral, mas identificamos refinamentos que podem ampliar os resultados já obtidos.'
        }
      </p>
      ${breakdownHtml ? `<div style="margin-top:16px;">${breakdownHtml}</div>` : ''}
    </div>
  </div>

  ${screenshotHtml}

  ${displayProblems.length > 0 ? `
  <div class="section-title">Pontos identificados (${displayProblems.length})</div>
  ${problemsHtml}
  ` : ''}

  <div class="cta">
    <h3>Quer corrigir esses pontos?</h3>
    <p>Nossa equipe pode entregar as correções em até 7 dias, sem necessidade de conhecimento técnico da sua parte.</p>
    <div class="cta-tag">Agendar conversa gratuita → kentauros.com.br</div>
  </div>

  <div class="footer">
    Este relatório foi gerado automaticamente pela Kentauros Tecnologia. Análise válida para o estado atual do site em ${date}.
  </div>
</body>
</html>`;

  // T16 — Screenshot do site via Puppeteer (antes de salvar)
  let screenshotHtml = '';
  if (url) {
    try {
      const puppeteer = require('puppeteer');
      const { getBrowserPath } = require('./browserPath');
      const ssExe = getBrowserPath();
      const ssBrowser = await puppeteer.launch({
        headless: true, executablePath: ssExe || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const ssPage = await ssBrowser.newPage();
      await ssPage.setViewport({ width: 1200, height: 800 });
      await ssPage.goto(url.startsWith('http') ? url : `https://${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const ssBuffer = await ssPage.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y: 0, width: 1200, height: 800 } });
      await ssBrowser.close();
      const b64 = ssBuffer.toString('base64');
      screenshotHtml = `<div style="margin-bottom:28px;"><div class="section-title">Aparência atual do site</div><div style="border-radius:12px;overflow:hidden;border:1px solid #1e293b;"><img src="data:image/jpeg;base64,${b64}" style="width:100%;display:block;" /></div></div>`;
    } catch (_) {}
  }

  // Salvar em Clientes/
  const clientsDir = path.join(process.cwd(), 'Clientes');
  if (!fs.existsSync(clientsDir)) fs.mkdirSync(clientsDir, { recursive: true });

  const safeName = company.toLowerCase().replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  const dateStr = new Date().toISOString().slice(0, 10);
  const htmlPath = path.join(clientsDir, `${safeName}_diagnostico_${dateStr}.html`);

  fs.writeFileSync(htmlPath, html, 'utf8');

  // Tentar converter para PDF via Puppeteer
  let pdfPath = null;
  try {
    const puppeteer = require('puppeteer');
    const { getBrowserPath } = require('./browserPath');
    const executablePath = getBrowserPath();
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 20000 });
    pdfPath = htmlPath.replace('.html', '.pdf');
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    await browser.close();
    fs.unlinkSync(htmlPath);
    return { success: true, path: pdfPath, type: 'pdf' };
  } catch (pdfErr) {
    console.warn('[PDF Diagnostic] Puppeteer PDF falhou, entregando HTML:', pdfErr.message);
    return { success: true, path: htmlPath, type: 'html' };
  }
}

module.exports = { generateDiagnosticReport };
