const fs = require("node:fs/promises");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");

const DEFAULT_RENDER_WIDTH = 1200;
const DEFAULT_RENDER_HEIGHT = 630;
const DEFAULT_JPEG_QUALITY = 92;
const DEFAULT_BACKGROUND = "rgba(255,255,255,0)";

/**
 * Ermittelt das Projektverzeichnis für alle relativen Build-Pfade.
 * @returns {string} Absoluter Pfad zum Projektverzeichnis.
 */
function getRootDir() {
  return path.resolve(__dirname, "..");
}

/**
 * Liest die Konfiguration für die OG-Bilder.
 * @param {string} rootDir - Absoluter Pfad zum Projektverzeichnis.
 * @returns {Promise<object>} Geparste Build-Konfiguration.
 */
async function readConfig(rootDir) {
  const configPath = path.join(rootDir, "og-image.config.json");
  const rawConfig = await fs.readFile(configPath, "utf8");
  return JSON.parse(rawConfig);
}

/**
 * Liest das konfigurierte SVG-Ausgangsmotiv.
 * @param {string} rootDir - Absoluter Pfad zum Projektverzeichnis.
 * @param {object} config - Geparste Build-Konfiguration.
 * @returns {Promise<string>} SVG-Quelltext in UTF-8.
 */
async function readSourceSvg(rootDir, config) {
  const sourcePath = path.join(rootDir, config.source);
  return fs.readFile(sourcePath, "utf8");
}

/**
 * Normalisiert die Render-Einstellungen und ergänzt Standardwerte.
 * @param {object} config - Geparste Build-Konfiguration.
 * @returns {{renderWidth: number, renderHeight: number, loadSystemFonts: boolean, background: string}} Vollständige Render-Einstellungen.
 */
function getRenderSettings(config) {
  let renderConfig = {};
  if (config.render && typeof config.render === "object") {
    renderConfig = config.render;
  }

  let renderWidth = Number(renderConfig.width);
  if (!renderWidth) {
    renderWidth = DEFAULT_RENDER_WIDTH;
  }

  let renderHeight = Number(renderConfig.height);
  if (!renderHeight) {
    renderHeight = DEFAULT_RENDER_HEIGHT;
  }

  let loadSystemFonts = true;
  if (renderConfig.loadSystemFonts === false) {
    loadSystemFonts = false;
  }

  let background = renderConfig.background;
  if (!background) {
    background = DEFAULT_BACKGROUND;
  }

  return { renderWidth, renderHeight, loadSystemFonts, background };
}

/**
 * Rendert ein SVG anhand der gewünschten Einstellungen als PNG.
 * @param {string} svg - Vollständiger SVG-Quelltext.
 * @param {{renderWidth: number, loadSystemFonts: boolean, background: string}} renderSettings - Normalisierte Render-Einstellungen.
 * @returns {Buffer} Gerenderte PNG-Daten.
 */
function renderSvgToPng(svg, renderSettings) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: renderSettings.renderWidth },
    font: { loadSystemFonts: renderSettings.loadSystemFonts },
    background: renderSettings.background,
  });
  return resvg.render().asPng();
}

/**
 * Prüft, ob das Ergebnis exakt die konfigurierte OG-Größe besitzt.
 * @param {Buffer} pngBuffer - Gerenderte PNG-Daten.
 * @param {{renderWidth: number, renderHeight: number}} renderSettings - Erwartete Bildgröße.
 * @returns {Promise<void>} Erfüllt, wenn die Bildgröße stimmt.
 */
async function assertRenderedSize(pngBuffer, renderSettings) {
  const metadata = await sharp(pngBuffer).metadata();
  if (metadata.width !== renderSettings.renderWidth || metadata.height !== renderSettings.renderHeight) {
    throw new Error(`Unerwartete OG-Bildgröße: ${metadata.width}x${metadata.height} statt ${renderSettings.renderWidth}x${renderSettings.renderHeight}`);
  }
}

/**
 * Begrenzt eine konfigurierte JPEG-Qualität auf den unterstützten Bereich.
 * @param {object} output - Konfiguration einer Ausgabedatei.
 * @returns {number} JPEG-Qualität zwischen 1 und 100.
 */
function getJpegQuality(output) {
  let quality = Number(output.quality);
  if (!quality) {
    quality = DEFAULT_JPEG_QUALITY;
  }
  return Math.max(1, Math.min(100, quality));
}

/**
 * Schreibt eine PNG- oder JPEG-Ausgabe in den konfigurierten Zielpfad.
 * @param {string} rootDir - Absoluter Pfad zum Projektverzeichnis.
 * @param {object} output - Konfiguration einer Ausgabedatei.
 * @param {Buffer} pngBuffer - Kanonische PNG-Daten.
 * @returns {Promise<void>} Erfüllt, nachdem die Datei geschrieben wurde.
 */
async function writeOutputFile(rootDir, output, pngBuffer) {
  const targetPath = path.join(rootDir, output.path);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  if (output.format === "png") {
    await fs.writeFile(targetPath, pngBuffer);
    return;
  }

  if (output.format === "jpeg" || output.format === "jpg") {
    const quality = getJpegQuality(output);
    const jpegBuffer = await sharp(pngBuffer)
      .flatten({ background: "#E8F4ED" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    await fs.writeFile(targetPath, jpegBuffer);
    return;
  }

  throw new Error(`Nicht unterstütztes OG-Ausgabeformat: ${output.format}`);
}

/**
 * Liefert die konfigurierte Ausgabeliste oder eine leere Liste.
 * @param {object} config - Geparste Build-Konfiguration.
 * @returns {object[]} Konfigurierte Ausgabedateien.
 */
function getOutputs(config) {
  if (!Array.isArray(config.outputs)) {
    return [];
  }
  return config.outputs;
}

/**
 * Rendert das SVG und schreibt alle konfigurierten OG-Bilder.
 * @returns {Promise<void>} Erfüllt, nachdem alle Bilder erstellt wurden.
 */
async function main() {
  const rootDir = getRootDir();
  const config = await readConfig(rootDir);
  const svg = await readSourceSvg(rootDir, config);
  const renderSettings = getRenderSettings(config);
  const pngBuffer = renderSvgToPng(svg, renderSettings);
  await assertRenderedSize(pngBuffer, renderSettings);

  const outputs = getOutputs(config);
  for (const output of outputs) {
    await writeOutputFile(rootDir, output, pngBuffer);
  }

  process.stdout.write(`OG-Bilder aus ${config.source} erstellt.\n`);
}

/**
 * Meldet einen fehlgeschlagenen Build und setzt einen Fehlercode.
 * @param {Error} error - Fehler aus dem asynchronen Build.
 * @returns {void} Keine Rückgabe.
 */
function handleBuildError(error) {
  console.error(error);
  process.exitCode = 1;
}

main().catch(handleBuildError);
