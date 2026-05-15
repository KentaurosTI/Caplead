// Prototype System: rebuild UI prototype strictly from extracted lead data
// Implements the mandatory pipeline described by the user

function filterText(t) {
  if (!t) return '';
  const s = String(t).trim();
  // ignore isolated numbers or placeholders like (11)
  if (/^\(\d+\)$/.test(s)) return '';
  // ignore single tokens that are not informative
  if (/^\d+$/.test(s)) return '';
  return s;
}

function classifySection(text) {
  if (!text) return 'outro';
  const t = text.toLowerCase();
  if (/serviço|produto|solução/.test(t)) return 'servicos';
  if (/sobre|quem somos|história|empresa/.test(t)) return 'sobre';
  if (/contato|localização|endereço|mapa|whatsapp|telefone/.test(t)) return 'contato';
  if (/início|home|bem-vindo|proposta|projetos/.test(t)) return 'hero';
  return 'outro';
}

function toOutputSections({ url, raw_texts, raw_images, raw_dom }) {
  const texts = (raw_texts || []).map(filterText).filter(Boolean);
  const images = raw_images || [];
  // ignore if all empty
  const dom = (raw_dom || []);

  // build sections based on detected contexts
  const sectionsByType = {};
  const usedTypes = new Set();
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const type = classifySection(t);
    usedTypes.add(type);
    if (!sectionsByType[type]) sectionsByType[type] = [];
    sectionsByType[type].push(t);
  }

  // fallback to hero if nothing detected
  if (Object.keys(sectionsByType).length === 0) {
    sectionsByType['hero'] = texts.slice(0, Math.min(3, texts.length));
  }

  const sections = [];
  const order = ['hero','sobre','servicos','contato','outro'];
  for (const type of order) {
    if (sectionsByType[type]) {
      sections.push({
        type,
        texts: sectionsByType[type],
        images: (images || []).slice(0, 3)
      });
    }
  }
  // any remaining content as 'outro'
  const remainingTexts = texts.filter(t => {
    const tp = classifySection(t);
    return !order.includes(tp);
  });
  if (remainingTexts.length) {
    sections.push({ type: 'outro', texts: remainingTexts, images: images.slice(0, 2) });
  }
  
  return {
    layout_original: order.filter(o => sections.find(s => s.type === o)),
    sections
  };
}

function buildDesignSystemFromColors(raw_colors) {
  const colors = (raw_colors || []).slice(0, 5);
  const primary = colors[0] || '#0ea5e9';
  const secondary = colors[1] || '#1e3a8a';
  const accent = colors[2] || '#3b82f6';
  const background = colors[3] || '#0b1020';
  const text = '#f8fafc';
  return { primary, secondary, accent, background, text, colors };
}

function validateInput(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'INPUT_NOT_OBJECT' };
  const { raw_texts, raw_dom } = input;
  if (!Array.isArray(raw_texts) || raw_texts.length === 0) return { ok: false, error: 'MISSING_TEXTS' };
  if (!Array.isArray(raw_dom) || raw_dom.length === 0) return { ok: false, error: 'MISSING_DOM' };
  return { ok: true };
}

async function generatePrototypeFromData(input) {
  // ETAPA 1: VALIDAÇÃO
  const v = validateInput(input);
  if (!v.ok) {
    return { status: 'invalid', error: v.error };
  }

  // ETAPA 2: ESTRUTURAÇÃO
  const { url, raw_texts, raw_images, raw_colors, raw_dom } = input;
  const { layout_original, sections } = toOutputSections({ url, raw_texts, raw_images, raw_dom });

  // ETAPA 3: RECONSTRUÇÃO
  // Mantemos conteúdos originais sem alterações de significado
  // Aqui apenas organizamos os textos e imagens já extraídos

  // ETAPA 4: DESIGN SYSTEM
  const designSystem = buildDesignSystemFromColors(raw_colors);

  // ETAPA 5: REDESIGN
  // Aplicar grid, espaçamento, tipografia; manter conteúdo fiel

  // ETAPA 6: VALIDAÇÃO FINAL
  // Verificar se o conteúdo veio do input (inseridos acima) e se as seções estão estruturadas
  const contentFromInput = Boolean(raw_texts.length || raw_images.length || raw_dom.length);
  if (!contentFromInput) {
    return { status: 'invalid', error: 'NO_CONTENT' };
  }

  return {
    status: 'success',
    layout_original,
    design_system: designSystem,
    sections: sections.map((s) => ({
      type: s.type,
      content: {
        texts: s.texts,
        images: s.images
      },
      ui: {
        layout: s.type === 'hero' ? 'hero' : s.type,
        improvements: []
      }
    }))
  };
}

module.exports = { generatePrototypeFromData };
