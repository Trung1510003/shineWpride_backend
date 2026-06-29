import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { Subscriber } from "@prisma/client";

import prisma from "../db.server";

export const POPUP_DISCOUNT_CODE = "WELCOME10";
export const SUBSCRIBER_SOURCE = "popup";
export const SUBSCRIBER_TAGS = ["newsletter", "popup-discount"] as const;

type GraphQLUserError = {
  field?: string[] | null;
  message: string;
};

type CustomerByEmailResponse = {
  data?: {
    customers?: {
      edges?: Array<{
        node?: {
          id: string;
          tags: string[];
        } | null;
      }>;
    };
  };
};

type CustomerMutationResponse = {
  data?: {
    customerCreate?: {
      customer?: { id: string } | null;
      userErrors?: GraphQLUserError[];
    };
    customerUpdate?: {
      customer?: { id: string } | null;
      userErrors?: GraphQLUserError[];
    };
  };
};

const CUSTOMER_BY_EMAIL_QUERY = `#graphql
  query customerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          tags
        }
      }
    }
  }
`;

const CUSTOMER_CREATE_MUTATION = `#graphql
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CUSTOMER_UPDATE_MUTATION = `#graphql
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function mergeTags(existing: string[], required: readonly string[]): string[] {
  return [...new Set([...existing, ...required])];
}

function assertNoUserErrors(
  operation: string,
  userErrors: GraphQLUserError[] | undefined,
): void {
  if (!userErrors?.length) {
    return;
  }

  const message = userErrors.map((error) => error.message).join("; ");
  throw new Error(`${operation} failed: ${message}`);
}

async function findCustomerByEmail(
  admin: AdminApiContext,
  email: string,
): Promise<{ id: string; tags: string[] } | null> {
  const response = await admin.graphql(CUSTOMER_BY_EMAIL_QUERY, {
    variables: { query: `email:${email}` },
  });
  const payload = (await response.json()) as CustomerByEmailResponse;
  const node = payload.data?.customers?.edges?.[0]?.node;

  if (!node?.id) {
    return null;
  }

  return { id: node.id, tags: node.tags ?? [] };
}

async function createShopifyCustomer(
  admin: AdminApiContext,
  email: string,
): Promise<string> {
  const response = await admin.graphql(CUSTOMER_CREATE_MUTATION, {
    variables: {
      input: {
        email,
        tags: [...SUBSCRIBER_TAGS],
      },
    },
  });
  const payload = (await response.json()) as CustomerMutationResponse;
  const result = payload.data?.customerCreate;

  assertNoUserErrors("customerCreate", result?.userErrors);

  if (!result?.customer?.id) {
    throw new Error("customerCreate did not return a customer id");
  }

  return result.customer.id;
}

async function updateShopifyCustomerTags(
  admin: AdminApiContext,
  customerId: string,
  existingTags: string[],
): Promise<string> {
  const response = await admin.graphql(CUSTOMER_UPDATE_MUTATION, {
    variables: {
      input: {
        id: customerId,
        tags: mergeTags(existingTags, SUBSCRIBER_TAGS),
      },
    },
  });
  const payload = (await response.json()) as CustomerMutationResponse;
  const result = payload.data?.customerUpdate;

  assertNoUserErrors("customerUpdate", result?.userErrors);

  if (!result?.customer?.id) {
    throw new Error("customerUpdate did not return a customer id");
  }

  return result.customer.id;
}

export async function syncShopifyCustomer(
  admin: AdminApiContext,
  email: string,
): Promise<string> {
  const existing = await findCustomerByEmail(admin, email);

  if (existing) {
    return updateShopifyCustomerTags(admin, existing.id, existing.tags);
  }

  return createShopifyCustomer(admin, email);
}

export async function registerPopupSubscriber(
  admin: AdminApiContext,
  shopDomain: string,
  email: string,
): Promise<Subscriber> {
  const normalizedEmail = email.trim().toLowerCase();
  const shopifyCustomerId = await syncShopifyCustomer(admin, normalizedEmail);

  return prisma.subscriber.upsert({
    where: {
      shopDomain_email: {
        shopDomain,
        email: normalizedEmail,
      },
    },
    create: {
      email: normalizedEmail,
      shopDomain,
      source: SUBSCRIBER_SOURCE,
      status: "ACTIVE",
      shopifyCustomerId,
    },
    update: {
      source: SUBSCRIBER_SOURCE,
      status: "ACTIVE",
      shopifyCustomerId,
    },
  });
}
