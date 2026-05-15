const path = require("path");
const { normalizeUrl, normalizeFontName, rgbToHex, unique } = require("./utils");

const NICHE_KEYWORDS = [
  { niche: "saude", words: ["clinica", "medico", "saude", "consulta", "hospital"] },
  { niche: "odontologia", words: ["dentista", "odontologia", "odontologico", "implante", "ortodontia"] },
  { niche: "juridico", words: ["advogado", "juridico", "direito", "advocacia", "escritorio"] },
  { niche: "imoveis", words: ["imovel", "imobiliaria", "corretor", "apartamento", "casa"] },
  { niche: "educacao", words: ["curso", "escola", "aula", "formacao", "ensino"] },
  { niche: "tecnologia", words: ["software", "tecnologia", "sistema", "plataforma", "app"] },
  { niche: "beleza", words: ["beleza", "estetica", "salon", "barbearia", "spa"] },
];

function inferNiche(text, fallback = "geral") {
  const sample = String(text || "").toLowerCase();
  for (const row of NICHE_KEYWORDS) {
    if (row.words.some((w) => sample.includes(w))) return row.niche;
  }
  return fallback || "geral";
}

function normalizeHexColors(rawColors) {
  const list = [];
  for (const item of rawColors || []) {
    const hex = rgbToHex(item);
    if (hex) list.push(hex);
  }
  return unique(list).slice(0, 10);
}

function classifySectionHint(section) {
  const sample = `${section.tag || ""} ${section.id || ""} ${section.className || ""} ${section.title || ""}`.toLowerCase();
  if (/header|navbar|menu|nav/.test(sample)) return "header";
  if (/hero|banner|destaque|inicio|home/.test(sample)) return "hero";
  if (/servico|service|produto|solucao/.test(sample)) return "servicos";
  if (/sobre|quem-somos|about|empresa/.test(sample)) return "sobre";
  if (/depoimento|testimonial|feedback|avaliacao/.test(sample)) return "prova";
  if (/contato|contact|fale-conosco|endereco|mapa/.test(sample)) return "contato";
  if (/faq|duvida/.test(sample)) return "faq";
  if (/footer|rodape/.test(sample)) return "footer";
  return "section";
}

async function scrapeLeadDesignData(browser, rawUrl, leadContext, outputDir) {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    throw new Error("INVALID_URL");
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
  await page.setBypassCSP(true);

  let responseOk = true;
  try {
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    responseOk = !response || response.ok();
  } catch (err) {
    responseOk = false;
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
  const sourceScreenshotPath = path.join(outputDir, "site_original.png");
  await page.screenshot({ path: sourceScreenshotPath, fullPage: false });

  const extracted = await page.evaluate(() => {
    const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const toAbs = (value) => {
      if (!value) return null;
      try {
        return new URL(value, window.location.href).href;
      } catch {
        return null;
      }
    };

    const getTopColors = () => {
      const score = {};
      const normalizeColor = (raw) => {
        if (!raw) return null;
        const color = String(raw).trim().toLowerCase();
        if (color === "transparent" || color === "inherit") return null;
        if (/^#[0-9a-f]{6}$/.test(color)) return color;
        if (/^#[0-9a-f]{3}$/.test(color)) {
          return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
        }
        const match = color.match(/rgba?\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (!match) return null;
        const toHex = (n) => Number(n).toString(16).padStart(2, "0");
        return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
      };

      const elements = Array.from(document.querySelectorAll("*")).slice(0, 2500);
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const colors = [style.color, style.backgroundColor, style.borderColor];
        for (const raw of colors) {
          const normalized = normalizeColor(raw);
          if (!normalized) continue;
          score[normalized] = (score[normalized] || 0) + 1;
        }
      }

      return Object.entries(score)
        .sort((a, b) => b[1] - a[1])
        .map((row) => row[0])
        .slice(0, 10);
    };

    const getTopFonts = () => {
      const score = {};
      const elements = Array.from(document.querySelectorAll("*")).slice(0, 2500);
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const raw = cleanText(style.fontFamily);
        if (!raw) continue;
        const first = raw.split(",")[0].replace(/^["']|["']$/g, "");
        if (!first) continue;
        score[first] = (score[first] || 0) + 1;
      }
      return Object.entries(score)
        .sort((a, b) => b[1] - a[1])
        .map((row) => row[0])
        .slice(0, 6);
    };

    const textNodes = [];
    const headingNodes = Array.from(document.querySelectorAll("h1, h2, h3"));
    for (const h of headingNodes) {
      const text = cleanText(h.innerText || h.textContent);
      if (text.length >= 3 && text.length <= 180) textNodes.push(text);
    }
    const paragraphNodes = Array.from(document.querySelectorAll("p, li"));
    for (const p of paragraphNodes) {
      const text = cleanText(p.innerText || p.textContent);
      if (text.length >= 24 && text.length <= 320) textNodes.push(text);
    }

    const ctaSelectors = Array.from(
      document.querySelectorAll("button, a[href], [role='button'], input[type='submit']")
    );
    const ctas = [];
    for (const el of ctaSelectors) {
      const text = cleanText(el.innerText || el.value || el.textContent);
      if (!text || text.length > 60) continue;
      if (!/[a-zA-Z]/.test(text)) continue;
      ctas.push({
        text,
        href: cleanText(el.getAttribute("href")),
      });
    }

    const images = [];
    for (const img of Array.from(document.querySelectorAll("img[src]")).slice(0, 80)) {
      const src = toAbs(img.getAttribute("src"));
      if (!src || src.startsWith("data:")) continue;
      images.push({
        src,
        alt: cleanText(img.getAttribute("alt")),
        width: Number(img.naturalWidth || img.width || 0),
        height: Number(img.naturalHeight || img.height || 0),
      });
    }

    const logoCandidates = [];
    const logoElements = document.querySelectorAll(
      "img[alt*='logo' i], img[src*='logo' i], header img, nav img, [class*='logo' i] img"
    );
    for (const img of logoElements) {
      const src = toAbs(img.getAttribute("src"));
      if (src) logoCandidates.push(src);
    }
    const favicon = toAbs(document.querySelector("link[rel*='icon']")?.getAttribute("href"));
    if (favicon) logoCandidates.unshift(favicon);

    const sections = [];
    const sectionNodes = Array.from(document.querySelectorAll("header, section, article, footer, nav")).slice(0, 20);
    for (const el of sectionNodes) {
      const title =
        cleanText(el.querySelector("h1, h2, h3")?.innerText) ||
        cleanText(el.getAttribute("aria-label")) ||
        cleanText(el.getAttribute("id"));
      const localTexts = Array.from(el.querySelectorAll("h1, h2, h3, p"))
        .slice(0, 5)
        .map((node) => cleanText(node.innerText))
        .filter(Boolean);

      sections.push({
        tag: el.tagName.toLowerCase(),
        id: cleanText(el.getAttribute("id")),
        className: cleanText(el.getAttribute("class")),
        title,
        texts: localTexts,
      });
    }

    const bodyText = cleanText(document.body?.innerText || "").slice(0, 10000);
    const emailMatch = bodyText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    const phoneMatch = bodyText.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-\s]?\d{4})/);

    const whatsappLink =
      document.querySelector("a[href*='wa.me'], a[href*='whatsapp' i]")?.getAttribute("href") || "";
    const mailto = document.querySelector("a[href^='mailto:']")?.getAttribute("href") || "";
    const tel = document.querySelector("a[href^='tel:']")?.getAttribute("href") || "";

    return {
      pageTitle: cleanText(document.title),
      metaDescription: cleanText(document.querySelector("meta[name='description']")?.getAttribute("content")),
      ogTitle: cleanText(document.querySelector("meta[property='og:title']")?.getAttribute("content")),
      h1: cleanText(document.querySelector("h1")?.innerText),
      bodyText,
      fonts: getTopFonts(),
      colors: getTopColors(),
      images,
      logos: logoCandidates.filter(Boolean),
      ctas,
      sections,
      texts: Array.from(new Set(textNodes)).slice(0, 80),
      contactInfo: {
        email: (mailto || "").replace(/^mailto:/i, "") || (emailMatch ? emailMatch[0] : ""),
        phone: (tel || "").replace(/^tel:/i, "") || (phoneMatch ? phoneMatch[0] : ""),
        whatsapp: whatsappLink,
      },
      links: {
        contact: Array.from(document.querySelectorAll("a[href*='contato' i], a[href*='contact' i]"))
          .slice(0, 8)
          .map((el) => toAbs(el.getAttribute("href")))
          .filter(Boolean),
      },
    };
  });

  await page.close();

  const hasCoreSignals = extracted.pageTitle || extracted.h1 || (extracted.texts || []).length > 0;
  if (!hasCoreSignals || !responseOk) {
    throw new Error("SITE_UNREACHABLE");
  }

  const companyFromUrl = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  const companyName =
    extracted.ogTitle ||
    extracted.h1 ||
    extracted.pageTitle ||
    (leadContext && leadContext.nome) ||
    companyFromUrl;

  const normalizedSections = (extracted.sections || []).map((section) => ({
    type: classifySectionHint(section),
    title: section.title || "",
    texts: section.texts || [],
  }));

  const rawNicheSignal = `${leadContext?.nicho || ""} ${extracted.pageTitle || ""} ${extracted.metaDescription || ""} ${extracted.bodyText || ""}`;
  const niche = inferNiche(rawNicheSignal, leadContext?.nicho || "geral");

  const leadDesignData = {
    logo: extracted.logos[0] || "",
    colors: normalizeHexColors(extracted.colors),
    fonts: (extracted.fonts || []).map(normalizeFontName).filter(Boolean),
    sections: normalizedSections,
    images: extracted.images || [],
    texts: extracted.texts || [],
    contactInfo: extracted.contactInfo || {},
    niche,
    companyName,
    pageTitle: extracted.pageTitle || "",
    h1: extracted.h1 || "",
    ctas: unique((extracted.ctas || []).map((item) => item.text)).slice(0, 8),
    sourceUrl: url,
  };

  return {
    leadDesignData,
    sourceScreenshotPath,
  };
}

module.exports = {
  scrapeLeadDesignData,
};
