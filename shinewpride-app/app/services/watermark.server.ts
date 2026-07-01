import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import sharp from "sharp";

const MAX_WIDTH = 2000;
const DEFAULT_TEXT = "ShineWpride";
const DEFAULT_OPACITY = 0.18;
const OUTPUT_QUALITY = 82;
const ROTATION_DEGREES = -30;
const WATERMARK_FONT_FAMILY = "SWP Watermark";

const require = createRequire(import.meta.url);
const WATERMARK_FONT_PATH = path.join(
  path.dirname(require.resolve("dejavu-fonts-ttf/package.json")),
  "ttf/DejaVuSans-Bold.ttf",
);

let cachedFontBase64: string | undefined;

export type WatermarkOptions = {
  text?: string;
  opacity?: number;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getWatermarkFontBase64(): string {
  if (!cachedFontBase64) {
    cachedFontBase64 = readFileSync(WATERMARK_FONT_PATH).toString("base64");
  }

  return cachedFontBase64;
}

function createWatermarkSvg(
  width: number,
  height: number,
  text: string,
  opacity: number,
): Buffer {
  const fontSize = Math.max(20, Math.round(width / 22));
  const patternWidth = Math.round(fontSize * text.length * 0.65);
  const patternHeight = Math.round(fontSize * 2.8);
  const safeText = escapeXml(text);
  const fontBase64 = getWatermarkFontBase64();

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: '${WATERMARK_FONT_FAMILY}';
        font-weight: 700;
        font-style: normal;
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
      }
    ]]></style>
    <pattern id="watermark" patternUnits="userSpaceOnUse"
      width="${patternWidth}" height="${patternHeight}"
      patternTransform="rotate(${ROTATION_DEGREES})">
      <text x="0" y="${Math.round(fontSize * 0.85)}"
        font-family="${WATERMARK_FONT_FAMILY}"
        font-size="${fontSize}"
        font-weight="700"
        fill="#ffffff"
        fill-opacity="${opacity}">${safeText}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#watermark)"/>
</svg>`;

  return Buffer.from(svg);
}

function outputFormat(
  originalFormat: string | undefined,
): "jpeg" | "webp" {
  if (originalFormat === "jpeg" || originalFormat === "jpg") {
    return "jpeg";
  }

  return "webp";
}

export async function watermarkImage(
  input: Buffer,
  opts: WatermarkOptions = {},
): Promise<Buffer> {
  const text = opts.text ?? DEFAULT_TEXT;
  const opacity = opts.opacity ?? DEFAULT_OPACITY;

  const sourceMetadata = await sharp(input).metadata();
  const format = outputFormat(sourceMetadata.format);

  let workingBuffer = input;
  if (sourceMetadata.width && sourceMetadata.width > MAX_WIDTH) {
    workingBuffer = await sharp(input)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .toBuffer();
  }

  const { width, height } = await sharp(workingBuffer).metadata();
  if (!width || !height) {
    throw new Error("Unable to read image dimensions");
  }

  const watermarkSvg = createWatermarkSvg(width, height, text, opacity);
  const composited = sharp(workingBuffer).composite([
    { input: watermarkSvg, top: 0, left: 0 },
  ]);

  if (format === "jpeg") {
    return composited.jpeg({ quality: OUTPUT_QUALITY }).toBuffer();
  }

  return composited.webp({ quality: OUTPUT_QUALITY }).toBuffer();
}
