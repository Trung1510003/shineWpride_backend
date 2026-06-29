import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processManualWatermarkUpload } from "./watermark-upload.server";

const mocks = vi.hoisted(() => ({
  watermarkImage: vi.fn(),
  uploadWatermarkedMedia: vi.fn(),
  watermarkLogCreate: vi.fn(),
}));

vi.mock("./watermark.server", () => ({
  watermarkImage: mocks.watermarkImage,
}));

vi.mock("./shopify-media.server", () => ({
  uploadWatermarkedMedia: mocks.uploadWatermarkedMedia,
}));

vi.mock("../db.server", () => ({
  default: {
    watermarkLog: {
      create: mocks.watermarkLogCreate,
    },
  },
}));

const admin = {} as AdminApiContext;

function createFile(name: string, contents: string) {
  return {
    name,
    arrayBuffer: async () => Buffer.from(contents).buffer,
  };
}

describe("processManualWatermarkUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.watermarkImage.mockResolvedValue(Buffer.from("watermarked"));
    mocks.uploadWatermarkedMedia.mockResolvedValue({
      mediaId: "gid://shopify/MediaImage/1",
      imageUrl: "https://cdn.shopify.com/image.webp",
    });
    mocks.watermarkLogCreate.mockResolvedValue({});
  });

  it("watermarks and uploads each file", async () => {
    const results = await processManualWatermarkUpload(
      admin,
      "gid://shopify/Product/1",
      [createFile("photo.jpg", "raw"), createFile("hero.png", "raw-2")],
    );

    expect(results).toEqual([
      {
        name: "photo.jpg",
        status: "success",
        mediaId: "gid://shopify/MediaImage/1",
        imageUrl: "https://cdn.shopify.com/image.webp",
      },
      {
        name: "hero.png",
        status: "success",
        mediaId: "gid://shopify/MediaImage/1",
        imageUrl: "https://cdn.shopify.com/image.webp",
      },
    ]);

    expect(mocks.watermarkImage).toHaveBeenCalledTimes(2);
    expect(mocks.uploadWatermarkedMedia).toHaveBeenNthCalledWith(
      1,
      admin,
      "gid://shopify/Product/1",
      Buffer.from("watermarked"),
      "photo-watermarked.webp",
    );
  });

  it("returns per-file errors and writes WatermarkLog when processing fails", async () => {
    mocks.watermarkImage.mockRejectedValueOnce(new Error("Invalid image data"));

    const results = await processManualWatermarkUpload(
      admin,
      "gid://shopify/Product/1",
      [createFile("broken.jpg", "bad")],
    );

    expect(results).toEqual([
      {
        name: "broken.jpg",
        status: "failed",
        error: "Invalid image data",
      },
    ]);

    expect(mocks.watermarkLogCreate).toHaveBeenCalledWith({
      data: {
        shopifyMediaId: "unknown",
        productId: "gid://shopify/Product/1",
        status: "FAILED",
        originalUrl: "broken.jpg",
      },
    });
    expect(mocks.uploadWatermarkedMedia).not.toHaveBeenCalled();
  });
});
