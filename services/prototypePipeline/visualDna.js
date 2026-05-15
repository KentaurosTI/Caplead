const { isPaletteGood } = require("./identityPolicy");

function pickPalette(colors, niche) {
  const fallbackByNiche = {
    saude: ["#0f766e", "#0e7490", "#14b8a6"],
    odontologia: ["#2563eb", "#1d4ed8", "#06b6d4"],
    juridico: ["#111827", "#1f2937", "#b68b2e"],
    imoveis: ["#1d4ed8", "#0f172a", "#f59e0b"],
    tecnologia: ["#0f172a", "#1d4ed8", "#22d3ee"],
    educacao: ["#312e81", "#4c1d95", "#f59e0b"],
    beleza: ["#831843", "#be185d", "#fb7185"],
  };
  const fallback = fallbackByNiche[niche] || ["#0f172a", "#1d4ed8", "#16a34a"];
  const incoming = (colors || []).slice(0, 3);
  const palette = isPaletteGood(incoming) ? incoming : fallback.slice(0, 3);
  while (palette.length < 3) {
    palette.push(fallback[palette.length]);
  }
  return palette;
}

function inferTypographyStyle(fonts) {
  const first = (fonts || [])[0] || "";
  const sample = first.toLowerCase();
  if (/serif|times|georgia|garamond/.test(sample)) return "editorial";
  if (/mono|courier|consolas/.test(sample)) return "tech";
  if (/poppins|montserrat|dm sans|inter|manrope|nunito|sora/.test(sample)) return "modern";
  return "clean";
}

function inferBrandTone({ niche, qualityLevel }) {
  if (qualityLevel === "ruim") return "reposicionamento agressivo";
  if (["juridico", "contabilidade"].includes(niche)) return "autoridade confiavel";
  if (["saude", "odontologia", "psicologia"].includes(niche)) return "acolhedor profissional";
  if (["tecnologia"].includes(niche)) return "inovador objetivo";
  return "profissional orientado a conversao";
}

function buildVisualDNA(leadDesignData, analysis, identityDecisions) {
  const palette = pickPalette(leadDesignData.colors, leadDesignData.niche);
  const typographyStyle = inferTypographyStyle(leadDesignData.fonts);
  const qualityLevel = analysis.quality?.level || "medio";

  return {
    primaryColor: palette[0],
    secondaryColor: palette[1],
    accentColor: palette[2],
    typographyStyle,
    layoutStyle: analysis.style === "antigo" ? "modern-clean" : analysis.style,
    spacingStyle: "airy",
    brandTone: inferBrandTone({ niche: leadDesignData.niche, qualityLevel }),
    fontPair: {
      heading: (leadDesignData.fonts || [])[0] || "Poppins",
      body: (leadDesignData.fonts || [])[1] || (leadDesignData.fonts || [])[0] || "Inter",
    },
    palette,
    identityDecisions: identityDecisions || {},
  };
}

module.exports = {
  buildVisualDNA,
};
