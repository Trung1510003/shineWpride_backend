import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { WatermarkStatus } from "@prisma/client";

import prisma from "../db.server";

export type UploadWatermarkedMediaResult = {
  mediaId: string;
  imageUrl: string;
};

type GraphQLUserError = {
  field?: string[] | null;
  message: string;
};

type StagedUploadTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

type StagedUploadsCreateResponse = {
  data?: {
    stagedUploadsCreate?: {
      stagedTargets?: StagedUploadTarget[];
      userErrors?: GraphQLUserError[];
    };
  };
};

type ProductCreateMediaResponse = {
  data?: {
    productCreateMedia?: {
      media?: Array<{
        id: string;
        status: string;
        image?: { url?: string | null } | null;
        preview?: { image?: { url?: string | null } | null } | null;
      }>;
      mediaUserErrors?: GraphQLUserError[];
    };
  };
};

type MetafieldsSetResponse = {
  data?: {
    metafieldsSet?: {
      userErrors?: GraphQLUserError[];
    };
  };
};

type ProductDeleteMediaResponse = {
  data?: {
    productDeleteMedia?: {
      deletedMediaIds?: string[];
      mediaUserErrors?: GraphQLUserError[];
    };
  };
};

type MediaImageNodeResponse = {
  data?: {
    node?: {
      status?: string;
      image?: { url?: string | null } | null;
      preview?: { image?: { url?: string | null } | null } | null;
    } | null;
  };
};

const STAGED_UPLOADS_CREATE_MUTATION = `#graphql
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRODUCT_CREATE_MEDIA_MUTATION = `#graphql
  mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
    productCreateMedia(media: $media, productId: $productId) {
      media {
        id
        status
        ... on MediaImage {
          image {
            url
          }
          preview {
            image {
              url
            }
          }
        }
      }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const MEDIA_IMAGE_QUERY = `#graphql
  query mediaImage($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        status
        image {
          url
        }
        preview {
          image {
            url
          }
        }
      }
    }
  }
`;

const PRODUCT_DELETE_MEDIA_MUTATION = `#graphql
  mutation productDeleteMedia($mediaIds: [ID!]!, $productId: ID!) {
    productDeleteMedia(mediaIds: $mediaIds, productId: $productId) {
      deletedMediaIds
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

function assertNoUserErrors(
  userErrors: GraphQLUserError[] | undefined,
  context: string,
): void {
  if (!userErrors?.length) {
    return;
  }

  const message = userErrors.map((error) => error.message).join(", ");
  throw new Error(`${context}: ${message}`);
}

function mimeTypeFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function mediaImageUrl(
  media:
    | {
        image?: { url?: string | null } | null;
        preview?: { image?: { url?: string | null } | null } | null;
      }
    | undefined,
): string | undefined {
  return media?.image?.url ?? media?.preview?.image?.url ?? undefined;
}

async function createStagedUploadTarget(
  admin: AdminApiContext,
  filename: string,
  mimeType: string,
): Promise<StagedUploadTarget> {
  const response = await admin.graphql(STAGED_UPLOADS_CREATE_MUTATION, {
    variables: {
      input: [
        {
          filename,
          mimeType,
          httpMethod: "PUT",
          resource: "PRODUCT_IMAGE",
        },
      ],
    },
  });

  const json = (await response.json()) as StagedUploadsCreateResponse;
  const payload = json.data?.stagedUploadsCreate;

  assertNoUserErrors(payload?.userErrors, "stagedUploadsCreate");

  const target = payload?.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl) {
    throw new Error("stagedUploadsCreate did not return an upload target");
  }

  return target;
}

async function uploadToStagedTarget(
  target: StagedUploadTarget,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const headers = new Headers({
    "Content-Type": mimeType,
  });

  for (const parameter of target.parameters) {
    headers.set(parameter.name, parameter.value);
  }

  const uploadResponse = await fetch(target.url, {
    method: "PUT",
    headers,
    body: new Uint8Array(buffer),
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Staged upload failed with status ${uploadResponse.status}`,
    );
  }
}

async function createProductMedia(
  admin: AdminApiContext,
  productId: string,
  resourceUrl: string,
  filename: string,
): Promise<{ mediaId: string; imageUrl?: string }> {
  const response = await admin.graphql(PRODUCT_CREATE_MEDIA_MUTATION, {
    variables: {
      productId,
      media: [
        {
          originalSource: resourceUrl,
          mediaContentType: "IMAGE",
          alt: filename,
        },
      ],
    },
  });

  const json = (await response.json()) as ProductCreateMediaResponse;
  const payload = json.data?.productCreateMedia;

  assertNoUserErrors(payload?.mediaUserErrors, "productCreateMedia");

  const media = payload?.media?.[0];
  if (!media?.id) {
    throw new Error("productCreateMedia did not return media");
  }

  return {
    mediaId: media.id,
    imageUrl: mediaImageUrl(media),
  };
}

async function waitForMediaImageUrl(
  admin: AdminApiContext,
  mediaId: string,
  attempts = 10,
  delayMs = 500,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await admin.graphql(MEDIA_IMAGE_QUERY, {
      variables: { id: mediaId },
    });
    const json = (await response.json()) as MediaImageNodeResponse;
    const node = json.data?.node;
    const imageUrl = mediaImageUrl(node ?? undefined);

    if (imageUrl && (node?.status === "READY" || attempt === attempts - 1)) {
      return imageUrl;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("Media image URL was not ready in time");
}

async function setWatermarkedMetafields(
  admin: AdminApiContext,
  productId: string,
  mediaId: string,
): Promise<void> {
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: mediaId,
          namespace: "custom",
          key: "watermarked",
          type: "single_line_text_field",
          value: "true",
        },
        {
          ownerId: productId,
          namespace: "custom",
          key: "watermarked",
          type: "single_line_text_field",
          value: "true",
        },
      ],
    },
  });

  const json = (await response.json()) as MetafieldsSetResponse;
  assertNoUserErrors(json.data?.metafieldsSet?.userErrors, "metafieldsSet");
}

async function writeWatermarkLog(data: {
  shopifyMediaId: string;
  productId: string;
  status: WatermarkStatus;
  originalUrl: string;
  watermarkedUrl?: string;
}): Promise<void> {
  await prisma.watermarkLog.create({ data });
}

export async function deleteProductMedia(
  admin: AdminApiContext,
  productId: string,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) {
    return;
  }

  const response = await admin.graphql(PRODUCT_DELETE_MEDIA_MUTATION, {
    variables: {
      productId,
      mediaIds,
    },
  });

  const json = (await response.json()) as ProductDeleteMediaResponse;
  assertNoUserErrors(
    json.data?.productDeleteMedia?.mediaUserErrors,
    "productDeleteMedia",
  );
}

export async function uploadWatermarkedMedia(
  admin: AdminApiContext,
  productId: string,
  buffer: Buffer,
  filename: string,
): Promise<UploadWatermarkedMediaResult> {
  const mimeType = mimeTypeFromFilename(filename);
  let resourceUrl = filename;

  try {
    const stagedTarget = await createStagedUploadTarget(
      admin,
      filename,
      mimeType,
    );
    resourceUrl = stagedTarget.resourceUrl;

    await uploadToStagedTarget(stagedTarget, buffer, mimeType);

    const createdMedia = await createProductMedia(
      admin,
      productId,
      stagedTarget.resourceUrl,
      filename,
    );

    const imageUrl =
      createdMedia.imageUrl ??
      (await waitForMediaImageUrl(admin, createdMedia.mediaId));

    await setWatermarkedMetafields(admin, productId, createdMedia.mediaId);

    await writeWatermarkLog({
      shopifyMediaId: createdMedia.mediaId,
      productId,
      status: WatermarkStatus.DONE,
      originalUrl: resourceUrl,
      watermarkedUrl: imageUrl,
    });

    return {
      mediaId: createdMedia.mediaId,
      imageUrl,
    };
  } catch (error) {
    await writeWatermarkLog({
      shopifyMediaId: "unknown",
      productId,
      status: WatermarkStatus.FAILED,
      originalUrl: resourceUrl,
    }).catch(() => undefined);

    throw error;
  }
}
