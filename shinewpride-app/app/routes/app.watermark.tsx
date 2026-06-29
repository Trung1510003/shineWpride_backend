import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  json,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  DropZone,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  Thumbnail,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import { processManualWatermarkUpload } from "../services/watermark-upload.server";

type ProductOption = {
  id: string;
  title: string;
  imageUrl?: string;
};

type UploadResult = {
  name: string;
  status: "success" | "failed";
  imageUrl?: string;
  mediaId?: string;
  error?: string;
};

type LoaderData = {
  products: ProductOption[];
};

type ActionData = {
  results?: UploadResult[];
  error?: string;
};

const PRODUCTS_QUERY = `#graphql
  query watermarkProducts {
    products(first: 50, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        featuredImage {
          url
        }
      }
    }
  }
`;

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(PRODUCTS_QUERY);
  const responseJson = await response.json();

  const products =
    responseJson.data?.products?.nodes?.map((product: ProductOption & {
      featuredImage?: { url?: string | null } | null;
    }) => ({
      id: product.id,
      title: product.title,
      imageUrl: product.featuredImage?.url ?? undefined,
    })) ?? [];

  return json<LoaderData>({ products });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: 15_000_000,
  });
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler,
  );

  const productId = String(formData.get("productId") ?? "").trim();
  const fileEntries = formData.getAll("files").filter(isUploadFile);

  if (!productId) {
    return json<ActionData>(
      { error: "Please select a product before uploading images." },
      { status: 400 },
    );
  }

  if (fileEntries.length === 0) {
    return json<ActionData>(
      { error: "Please add at least one image to upload." },
      { status: 400 },
    );
  }

  const results = await processManualWatermarkUpload(
    admin,
    productId,
    fileEntries,
  );

  return json<ActionData>({ results });
};

export default function WatermarkPage() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [productId, setProductId] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const isSubmitting =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const productOptions = useMemo(
    () => [
      { label: "Select a product", value: "" },
      ...products.map((product) => ({
        label: product.title,
        value: product.id,
      })),
    ],
    [products],
  );

  const selectedProduct = products.find((product) => product.id === productId);

  const handleDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      setFiles((current) => [...current, ...acceptedFiles]);
    },
    [],
  );

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("productId", productId);

    for (const file of files) {
      formData.append("files", file);
    }

    fetcher.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
    });
  }, [fetcher, files, productId]);

  useEffect(() => {
    const results = fetcher.data?.results;
    if (!results?.length || isSubmitting) {
      return;
    }

    const successCount = results.filter(
      (result) => result.status === "success",
    ).length;
    const failedCount = results.length - successCount;

    if (failedCount === 0) {
      shopify.toast.show(
        `Published ${successCount} watermarked image${successCount === 1 ? "" : "s"}.`,
      );
      setFiles([]);
      return;
    }

    shopify.toast.show(
      `Finished with ${successCount} success and ${failedCount} failed.`,
      { isError: failedCount > 0 },
    );
  }, [fetcher.data?.results, isSubmitting, shopify]);

  const uploadedFileRows = files.map((file, index) => [
    file.name,
    `${Math.round(file.size / 1024)} KB`,
    <Button
      key={`${file.name}-${index}`}
      variant="plain"
      tone="critical"
      onClick={() => handleRemoveFile(index)}
    >
      Remove
    </Button>,
  ]);

  const resultRows =
    fetcher.data?.results?.map((result) => [
      result.name,
      result.status === "success" ? "Success" : "Failed",
      result.imageUrl ? (
        <a href={result.imageUrl} target="_blank" rel="noreferrer">
          View image
        </a>
      ) : (
        "—"
      ),
      result.error ?? "—",
    ]) ?? [];

  const canSubmit = Boolean(productId) && files.length > 0 && !isSubmitting;

  return (
    <Page>
      <TitleBar title="Watermark & Publish" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {fetcher.data?.error ? (
              <Banner tone="critical" title="Upload failed">
                <p>{fetcher.data.error}</p>
              </Banner>
            ) : null}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Target product
                </Text>
                <Select
                  label="Product"
                  options={productOptions}
                  value={productId}
                  onChange={setProductId}
                />
                {selectedProduct?.imageUrl ? (
                  <InlineStack gap="300" blockAlign="center">
                    <Thumbnail
                      source={selectedProduct.imageUrl}
                      alt={selectedProduct.title}
                      size="small"
                    />
                    <Text as="p" variant="bodyMd">
                      Watermarked images will be added to this product gallery.
                    </Text>
                  </InlineStack>
                ) : null}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Raw images
                </Text>
                <DropZone
                  accept="image/*"
                  type="image"
                  allowMultiple
                  onDrop={handleDrop}
                >
                  <DropZone.FileUpload actionHint="Accepts JPG, PNG, and WebP" />
                </DropZone>

                {files.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "numeric", "text"]}
                    headings={["File", "Size", ""]}
                    rows={uploadedFileRows}
                  />
                ) : (
                  <Text as="p" tone="subdued" variant="bodyMd">
                    Drop one or more product images to watermark and publish.
                  </Text>
                )}

                <InlineStack align="end">
                  <Button
                    variant="primary"
                    loading={isSubmitting}
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                  >
                    Watermark & Publish
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {fetcher.data?.results?.length ? (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Upload results
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["File", "Status", "Image", "Details"]}
                    rows={resultRows}
                  />
                </BlockStack>
              </Card>
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
