const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");

const { getBrowserPath } = require("./browserPath");
const { normalizeUrl } = require("./prototypePipeline/utils");
const { scrapeLeadDesignData } = require("./prototypePipeline/scraper");
const { analyzeLeadSite, classifySiteQuality } = require("./prototypePipeline/analyzer");
const { applyIdentityPolicy } = require("./prototypePipeline/identityPolicy");
const { buildVisualDNA } = require("./prototypePipeline/visualDna");
const { defineRedesignStrategy } = require("./prototypePipeline/strategy");
const { buildDynamicPrompt } = require("./prototypePipeline/promptBuilder");
const { buildPrototypeHtml } = require("./prototypePipeline/generator");
const { validatePrototypeQuality } = require("./prototypePipeline/validator");

function createRunId(url) {
  const digest = crypto.createHash("sha1").update(`${url}:${Date.now()}`).digest("hex").slice(0, 8);
  return `caplead_prototype_${Date.now()}_${digest}`;
}

function buildSummary({ leadDesignData, analysis, siteQuality, visualDNA, strategy, quality }) {
  const problems = (analysis.problems || []).slice(0, 4).join(" | ") || "Sem diagnostico explicito";
  return [
    "CAPLEAD PIPELINE REPORT",
    "SCRAPING -> ANALISE -> DNA -> ESTRATEGIA -> GERACAO -> VALIDACAO",
    "",
    `Empresa: ${leadDesignData.companyName}`,
    `Nicho: ${leadDesignData.niche}`,
    `Estilo detectado: ${analysis.style}`,
    `Score do site atual: ${siteQuality.score}/100`,
    `Classificacao do site: ${siteQuality.level}`,
    `Problemas: ${problems}`,
    `VisualDNA: primary=${visualDNA.primaryColor}, secondary=${visualDNA.secondaryColor}, accent=${visualDNA.accentColor}, typography=${visualDNA.typographyStyle}, tone=${visualDNA.brandTone}`,
    `Template: ${strategy.templateName}`,
    `Estrategia: pageType=${strategy.pageType}, mode=${strategy.sourceMode}, layout=${strategy.layoutVariant}, hero=${strategy.heroVariant}, cta=${strategy.ctaVariant}, spacing=${strategy.spacingVariant}`,
    `QualityGate: ${quality.passed ? "PASS" : "FAIL"} (${quality.score}/100)`,
  ].join("\n");
}

async function captureSectionShots(page, outputDir) {
  const selectors = [
    "[data-shot='hero']",
    "[data-shot='services']",
    "[data-shot='about']",
    "[data-shot='proof']",
    "[data-shot='cta']",
  ];
  const shots = [];

  for (let i = 0; i < selectors.length; i += 1) {
    const selector = selectors[i];
    try {
      const handle = await page.$(selector);
      if (!handle) continue;
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
      }, selector);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const box = await handle.boundingBox();
      if (!box || box.width < 220 || box.height < 140) continue;
      const imagePath = path.join(outputDir, `section_${i + 1}.png`);
      await page.screenshot({
        path: imagePath,
        clip: {
          x: Math.max(0, Math.floor(box.x)),
          y: Math.max(0, Math.floor(box.y)),
          width: Math.max(320, Math.floor(box.width)),
          height: Math.max(220, Math.floor(box.height)),
        },
      });
      shots.push(imagePath);
    } catch (err) {
      console.warn("[Prototype] section shot error", selector, err.message);
    }
  }

  return shots;
}

async function renderPrototypeArtifacts(browser, htmlPath, outputDir) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  const htmlUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
  await page.goto(htmlUrl, { waitUntil: "networkidle0", timeout: 50000 });
  await new Promise((resolve) => setTimeout(resolve, 900));

  const prototypeScreenshot = path.join(outputDir, "prototype_full.png");
  await page.screenshot({ path: prototypeScreenshot, fullPage: true });

  const previewImages = await captureSectionShots(page, outputDir);

  const pdfPath = path.join(outputDir, "prototype_proposta.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "10px",
      right: "10px",
      bottom: "10px",
      left: "10px",
    },
  });

  await page.close();
  return {
    pdfPath,
    prototypeScreenshot,
    previewImages,
  };
}

async function generatePrototype(url, leadContext = {}) {
  let browser = null;

  try {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) throw new Error("INVALID_URL");

    const outputDir = path.join(os.tmpdir(), createRunId(normalizedUrl));
    fs.mkdirSync(outputDir, { recursive: true });

    const executablePath = getBrowserPath();
    browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const { leadDesignData, sourceScreenshotPath } = await scrapeLeadDesignData(
      browser,
      normalizedUrl,
      leadContext,
      outputDir
    );
    const siteQuality = classifySiteQuality(leadDesignData);
    const identityPolicy = applyIdentityPolicy(leadDesignData, siteQuality, leadContext);
    const preparedLeadData = identityPolicy.data;
    const analysis = analyzeLeadSite(preparedLeadData);
    const visualDNA = buildVisualDNA(preparedLeadData, analysis, identityPolicy.decisions);

    const seedBase = `${normalizedUrl}:${preparedLeadData.companyName}:${Date.now()}`;
    let bestAttempt = null;
    let approvedAttempt = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const strategy = defineRedesignStrategy({
        leadDesignData: preparedLeadData,
        leadContext,
        analysis,
        siteQuality,
        seedBase,
        attempt,
      });

      const uniquePrompt = buildDynamicPrompt({
        leadDesignData: preparedLeadData,
        analysis,
        visualDNA,
        strategy,
        leadContext,
      });

      const html = buildPrototypeHtml({
        leadDesignData: preparedLeadData,
        leadContext,
        analysis,
        siteQuality,
        visualDNA,
        strategy,
      });

      const quality = validatePrototypeQuality({
        html,
        leadDesignData: preparedLeadData,
        visualDNA,
        strategy,
        siteQuality,
      });

      const candidate = { strategy, uniquePrompt, html, quality, attempt };
      if (!bestAttempt || candidate.quality.score > bestAttempt.quality.score) {
        bestAttempt = candidate;
      }
      if (quality.passed) {
        approvedAttempt = candidate;
        break;
      }
    }

    if (!approvedAttempt) {
      return {
        success: false,
        error: "QUALITY_GATE_FAILED",
        message: `Prototipo reprovado no quality gate apos 3 tentativas: ${(bestAttempt?.quality?.notes || []).join(" | ")}`,
        qualityReport: bestAttempt?.quality || null,
        redesignStrategy: bestAttempt?.strategy || null,
      };
    }

    const htmlPath = path.join(outputDir, "prototype_customizado.html");
    fs.writeFileSync(htmlPath, approvedAttempt.html, "utf8");

    const artifacts = await renderPrototypeArtifacts(browser, htmlPath, outputDir);
    const summary = buildSummary({
      leadDesignData: preparedLeadData,
      analysis,
      siteQuality,
      visualDNA,
      strategy: approvedAttempt.strategy,
      quality: approvedAttempt.quality,
    });

    // Enrich prompt com metadados do lead para aumentar riqueza do prompt do Stitch
    const leadMeta = `LeadMeta: id=${(leadContext && leadContext.lead && leadContext.lead.id) || ''}, name=${(leadContext && leadContext.lead && leadContext.lead.name) || preparedLeadData.companyName || ''}, url=${normalizedUrl}, niche=${leadContext?.lead?.niche || preparedLeadData.niche || ''}`;
    const stitchPrompt = `${summary}\n\n${leadMeta}\n${approvedAttempt.uniquePrompt}`;
    return {
      success: true,
      pdfPath: artifacts.pdfPath,
      htmlPath,
      screenshotPath: sourceScreenshotPath,
      prototypeScreenshot: artifacts.prototypeScreenshot,
      previewImages: artifacts.previewImages,
      stitchPrompt,
      designSummary: summary,
      uniquePrompt: approvedAttempt.uniquePrompt,
      leadDesignData: preparedLeadData,
      siteAnalysis: analysis,
      siteQuality,
      identityPolicy: identityPolicy.decisions,
      visualDNA,
      redesignStrategy: approvedAttempt.strategy,
      qualityReport: approvedAttempt.quality,

      // Compatibility fields used by current UI flow
      siteData: {
        title: preparedLeadData.pageTitle,
        h1: preparedLeadData.h1,
        companyName: preparedLeadData.companyName,
        headings: preparedLeadData.sections.map((s) => s.title).filter(Boolean),
        paragraphs: preparedLeadData.texts,
        images: preparedLeadData.images,
        logos: [preparedLeadData.logo].filter(Boolean),
        ctas: (preparedLeadData.ctas || []).map((text) => ({ text })),
        colors: preparedLeadData.colors,
      },
      visualIdentity: {
        companyName: preparedLeadData.companyName,
        industry: preparedLeadData.niche,
        colors: preparedLeadData.colors,
        primaryColor: visualDNA.primaryColor,
      },
      designStrategy: {
        approach: "Template profissional fixo + personalizacao + quality gate anti-design-ruim",
        ctas: preparedLeadData.ctas || [],
        pageType: approvedAttempt.strategy.pageType,
        visualStyle: approvedAttempt.strategy.visualStyle,
        templateName: approvedAttempt.strategy.templateName,
        sourceMode: approvedAttempt.strategy.sourceMode,
      },
    };
  } catch (error) {
    console.error("[Prototype Pipeline] Error:", error.message);
    if (error.message === "SITE_UNREACHABLE" || error.message === "INVALID_URL") {
      return {
        success: false,
        error: "SITE_ERROR",
        message: "Nao foi possivel acessar ou interpretar o site do lead.",
      };
    }
    return {
      success: false,
      error: "GENERAL_ERROR",
      message: error.message || "Erro desconhecido durante o pipeline de prototipo.",
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore close errors
      }
    }
  }
}

module.exports = {
  generatePrototype,
};
