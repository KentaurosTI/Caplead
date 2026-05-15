function hexToRgb(hex) {
  const raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const linear = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

function contrastRatio(hexA, hexB) {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isColorGood(color) {
  if (!color) return false;
  const contrastWhite = contrastRatio(color, "#ffffff");
  const contrastDark = contrastRatio(color, "#0f172a");
  return contrastWhite >= 2.8 || contrastDark >= 2.8;
}

function isPaletteGood(colors) {
  const safe = (colors || []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  if (safe.length < 2) return false;
  return safe.some((c) => isColorGood(c));
}

function isLogoGood(leadDesignData) {
  const logo = leadDesignData.logo || "";
  if (!logo) return false;
  if (/favicon|icon\.ico|apple-touch-icon/i.test(logo)) return false;
  const found = (leadDesignData.images || []).find((img) => img.src === logo);
  if (!found) return true;
  const width = Number(found.width || 0);
  const height = Number(found.height || 0);
  if (width && height && (width < 80 || height < 24)) return false;
  return true;
}

function buildCoreTexts(leadDesignData, leadContext) {
  const proposal =
    leadContext?.proposta ||
    leadContext?.proposal ||
    leadContext?.nicho ||
    `Projeto profissional para ${leadDesignData.companyName}.`;
  return [
    `Projeto para ${leadDesignData.companyName}`,
    `Nicho: ${leadDesignData.niche || leadContext?.nicho || "geral"}`,
    proposal,
  ];
}

function applyIdentityPolicy(leadDesignData, siteQuality, leadContext) {
  const level = siteQuality?.level || "medio";
  const logoApproved = isLogoGood(leadDesignData);
  const colorsApproved = isPaletteGood(leadDesignData.colors || []);

  // Se RUIM: ignora design atual, usa somente nome + nicho + proposta.
  if (level === "ruim") {
    return {
      data: {
        ...leadDesignData,
        logo: "",
        colors: [],
        images: [],
        texts: buildCoreTexts(leadDesignData, leadContext),
        sections: [],
        ctas: ["Solicitar proposta", "Falar com especialista"],
      },
      decisions: {
        sourceMode: "ignore_current_design",
        logoApproved: false,
        colorsApproved: false,
      },
    };
  }

  // Se MEDIO: mantem cores boas e melhora estrutura.
  if (level === "medio") {
    return {
      data: {
        ...leadDesignData,
        logo: logoApproved ? leadDesignData.logo : "",
        colors: colorsApproved ? leadDesignData.colors : [],
      },
      decisions: {
        sourceMode: "keep_colors_upgrade_structure",
        logoApproved,
        colorsApproved,
      },
    };
  }

  // Se BOM: redesign evolutivo (mantem ativos bons).
  return {
    data: {
      ...leadDesignData,
      logo: logoApproved ? leadDesignData.logo : "",
      colors: colorsApproved ? leadDesignData.colors : [],
    },
    decisions: {
      sourceMode: "evolutionary_upgrade",
      logoApproved,
      colorsApproved,
    },
  };
}

module.exports = {
  applyIdentityPolicy,
  isPaletteGood,
  isLogoGood,
};
