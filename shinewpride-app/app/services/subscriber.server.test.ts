import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  POPUP_DISCOUNT_CODE,
  registerPopupSubscriber,
  SUBSCRIBER_SOURCE,
  SUBSCRIBER_TAGS,
  syncShopifyCustomer,
} from "./subscriber.server";

const mocks = vi.hoisted(() => ({
  subscriberUpsert: vi.fn(),
}));

vi.mock("../db.server", () => ({
  default: {
    subscriber: {
      upsert: mocks.subscriberUpsert,
    },
  },
}));

function createAdmin(graphqlImpl: ReturnType<typeof vi.fn>): AdminApiContext {
  return {
    graphql: graphqlImpl,
  } as AdminApiContext;
}

describe("syncShopifyCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a customer when none exists", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: { customers: { edges: [] } },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            customerCreate: {
              customer: { id: "gid://shopify/Customer/1" },
              userErrors: [],
            },
          },
        }),
      });

    const customerId = await syncShopifyCustomer(
      createAdmin(graphql),
      "user@example.com",
    );

    expect(customerId).toBe("gid://shopify/Customer/1");
    expect(graphql).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("customerCreate"),
      {
        variables: {
          input: {
            email: "user@example.com",
            tags: [...SUBSCRIBER_TAGS],
          },
        },
      },
    );
  });

  it("updates tags when customer already exists", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            customers: {
              edges: [
                {
                  node: {
                    id: "gid://shopify/Customer/2",
                    tags: ["vip"],
                  },
                },
              ],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            customerUpdate: {
              customer: { id: "gid://shopify/Customer/2" },
              userErrors: [],
            },
          },
        }),
      });

    const customerId = await syncShopifyCustomer(
      createAdmin(graphql),
      "user@example.com",
    );

    expect(customerId).toBe("gid://shopify/Customer/2");
    expect(graphql).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("customerUpdate"),
      {
        variables: {
          input: {
            id: "gid://shopify/Customer/2",
            tags: ["vip", ...SUBSCRIBER_TAGS],
          },
        },
      },
    );
  });
});

describe("registerPopupSubscriber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriberUpsert.mockResolvedValue({
      id: "sub_1",
      email: "user@example.com",
      shopDomain: "shop.myshopify.com",
      source: SUBSCRIBER_SOURCE,
      status: "ACTIVE",
      shopifyCustomerId: "gid://shopify/Customer/1",
      createdAt: new Date(),
    });
  });

  it("upserts subscriber after syncing Shopify customer", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: { customers: { edges: [] } },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            customerCreate: {
              customer: { id: "gid://shopify/Customer/1" },
              userErrors: [],
            },
          },
        }),
      });

    const subscriber = await registerPopupSubscriber(
      createAdmin(graphql),
      "shop.myshopify.com",
      "  User@Example.com ",
    );

    expect(subscriber.email).toBe("user@example.com");
    expect(mocks.subscriberUpsert).toHaveBeenCalledWith({
      where: {
        shopDomain_email: {
          shopDomain: "shop.myshopify.com",
          email: "user@example.com",
        },
      },
      create: {
        email: "user@example.com",
        shopDomain: "shop.myshopify.com",
        source: SUBSCRIBER_SOURCE,
        status: "ACTIVE",
        shopifyCustomerId: "gid://shopify/Customer/1",
      },
      update: {
        source: SUBSCRIBER_SOURCE,
        status: "ACTIVE",
        shopifyCustomerId: "gid://shopify/Customer/1",
      },
    });
    expect(POPUP_DISCOUNT_CODE).toBe("WELCOME10");
  });
});
