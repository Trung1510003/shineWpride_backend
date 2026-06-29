import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchUnwatermarkedProductMedia,
  resolveProductId,
} from "./watermark-product-media.server";

describe("resolveProductId", () => {
  it("uses admin_graphql_api_id when present", () => {
    expect(
      resolveProductId({
        admin_graphql_api_id: "gid://shopify/Product/99",
        id: 1,
      }),
    ).toBe("gid://shopify/Product/99");
  });

  it("builds a gid from numeric id", () => {
    expect(resolveProductId({ id: 42 })).toBe("gid://shopify/Product/42");
  });
});

describe("fetchUnwatermarkedProductMedia", () => {
  const graphql = vi.fn();
  const admin = { graphql } as unknown as AdminApiContext;

  beforeEach(() => {
    graphql.mockReset();
  });

  it("returns only image media without the watermarked metafield", async () => {
    graphql.mockResolvedValue({
      json: async () => ({
        data: {
          product: {
            id: "gid://shopify/Product/1",
            media: {
              nodes: [
                {
                  id: "gid://shopify/MediaImage/1",
                  mediaContentType: "IMAGE",
                  image: { url: "https://cdn.shopify.com/raw.jpg" },
                  metafield: null,
                },
                {
                  id: "gid://shopify/MediaImage/2",
                  mediaContentType: "IMAGE",
                  image: { url: "https://cdn.shopify.com/done.jpg" },
                  metafield: { value: "true" },
                },
                {
                  id: "gid://shopify/Video/1",
                  mediaContentType: "VIDEO",
                  image: null,
                  metafield: null,
                },
              ],
            },
          },
        },
      }),
    });

    const result = await fetchUnwatermarkedProductMedia(
      admin,
      "gid://shopify/Product/1",
    );

    expect(result).toEqual([
      {
        mediaId: "gid://shopify/MediaImage/1",
        imageUrl: "https://cdn.shopify.com/raw.jpg",
      },
    ]);
  });
});
