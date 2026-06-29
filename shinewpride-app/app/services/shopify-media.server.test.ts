import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadWatermarkedMedia } from "./shopify-media.server";

const { watermarkLogCreate } = vi.hoisted(() => ({
  watermarkLogCreate: vi.fn(),
}));

vi.mock("../db.server", () => ({
  default: {
    watermarkLog: {
      create: watermarkLogCreate,
    },
  },
}));

function createAdminMock(
  handlers: Record<string, () => Promise<{ json: () => Promise<unknown> }>>,
): AdminApiContext {
  return {
    graphql: vi.fn(async (query: string) => {
      if (query.includes("stagedUploadsCreate")) {
        return handlers.stagedUploadsCreate();
      }
      if (query.includes("productCreateMedia")) {
        return handlers.productCreateMedia();
      }
      if (query.includes("metafieldsSet")) {
        return handlers.metafieldsSet();
      }
      if (query.includes("mediaImage")) {
        return handlers.mediaImage();
      }

      throw new Error(`Unexpected GraphQL query: ${query}`);
    }),
  } as unknown as AdminApiContext;
}

describe("uploadWatermarkedMedia", () => {
  beforeEach(() => {
    watermarkLogCreate.mockReset();
    vi.restoreAllMocks();
  });

  it("uploads staged media, creates product media, sets metafields, and logs success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const admin = createAdminMock({
      stagedUploadsCreate: async () => ({
        json: async () => ({
          data: {
            stagedUploadsCreate: {
              stagedTargets: [
                {
                  url: "https://upload.example/staged",
                  resourceUrl: "https://shopify.example/resource.jpg",
                  parameters: [{ name: "x-goog-acl", value: "private" }],
                },
              ],
              userErrors: [],
            },
          },
        }),
      }),
      productCreateMedia: async () => ({
        json: async () => ({
          data: {
            productCreateMedia: {
              media: [
                {
                  id: "gid://shopify/MediaImage/123",
                  status: "READY",
                  image: { url: "https://cdn.shopify.com/watermarked.jpg" },
                },
              ],
              mediaUserErrors: [],
            },
          },
        }),
      }),
      metafieldsSet: async () => ({
        json: async () => ({
          data: {
            metafieldsSet: {
              userErrors: [],
            },
          },
        }),
      }),
      mediaImage: async () => ({
        json: async () => ({
          data: {
            node: {
              status: "READY",
              image: { url: "https://cdn.shopify.com/watermarked.jpg" },
            },
          },
        }),
      }),
    });

    const buffer = Buffer.from("fake-image");
    const result = await uploadWatermarkedMedia(
      admin,
      "gid://shopify/Product/456",
      buffer,
      "sample.webp",
    );

    expect(result).toEqual({
      mediaId: "gid://shopify/MediaImage/123",
      imageUrl: "https://cdn.shopify.com/watermarked.jpg",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.example/staged",
      expect.objectContaining({
        method: "PUT",
        body: new Uint8Array(buffer),
      }),
    );

    expect(watermarkLogCreate).toHaveBeenCalledWith({
      data: {
        shopifyMediaId: "gid://shopify/MediaImage/123",
        productId: "gid://shopify/Product/456",
        status: "DONE",
        originalUrl: "https://shopify.example/resource.jpg",
        watermarkedUrl: "https://cdn.shopify.com/watermarked.jpg",
      },
    });
  });

  it("logs failure when staged upload returns an error", async () => {
    const admin = createAdminMock({
      stagedUploadsCreate: async () => ({
        json: async () => ({
          data: {
            stagedUploadsCreate: {
              stagedTargets: [],
              userErrors: [{ message: "Invalid mime type" }],
            },
          },
        }),
      }),
      productCreateMedia: async () => ({
        json: async () => ({ data: {} }),
      }),
      metafieldsSet: async () => ({
        json: async () => ({ data: {} }),
      }),
      mediaImage: async () => ({
        json: async () => ({ data: {} }),
      }),
    });

    await expect(
      uploadWatermarkedMedia(
        admin,
        "gid://shopify/Product/456",
        Buffer.from("fake-image"),
        "sample.webp",
      ),
    ).rejects.toThrow("stagedUploadsCreate: Invalid mime type");

    expect(watermarkLogCreate).toHaveBeenCalledWith({
      data: {
        shopifyMediaId: "unknown",
        productId: "gid://shopify/Product/456",
        status: "FAILED",
        originalUrl: "sample.webp",
      },
    });
  });
});
