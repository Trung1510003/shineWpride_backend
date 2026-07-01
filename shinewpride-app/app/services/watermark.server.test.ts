import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { watermarkImage } from "./watermark.server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "__fixtures__", "sample.jpg");

describe("watermarkImage", () => {
  it("returns a valid watermarked image buffer", async () => {
    const input = await readFile(fixturePath);
    const output = await watermarkImage(input);

    expect(output.length).toBeGreaterThan(0);

    const metadata = await sharp(output).metadata();
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
    expect(["jpeg", "webp"]).toContain(metadata.format);
  });

  it("respects custom text and opacity options", async () => {
    const input = await readFile(fixturePath);
    const output = await watermarkImage(input, {
      text: "CustomMark",
      opacity: 0.25,
    });

    expect(output.length).toBeGreaterThan(0);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("jpeg");
  });

  it("resizes images wider than 2000px", async () => {
    const largeInput = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: { r: 120, g: 80, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const output = await watermarkImage(largeInput);
    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBeLessThanOrEqual(2000);
    expect(metadata.height).toBeLessThanOrEqual(1000);
  });

  it("renders readable watermark text (not missing-glyph boxes)", async () => {
    const plain = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const watermarked = await watermarkImage(plain, { text: "ShineWpride", opacity: 0.35 });
    const plainStats = await sharp(plain).stats();
    const markedStats = await sharp(watermarked).stats();

    const plainMean =
      plainStats.channels.reduce((sum, channel) => sum + channel.mean, 0) /
      plainStats.channels.length;
    const markedMean =
      markedStats.channels.reduce((sum, channel) => sum + channel.mean, 0) /
      markedStats.channels.length;

    expect(markedMean).toBeGreaterThan(plainMean + 2);
  });
});
