import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import { Button, Container, Heading, Hint, Text, toast } from "@medusajs/ui";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import type {
  ArtworkDownloadResponse,
  ArtworkOrderAsset,
  ArtworkOrderListResponse,
  CheckoutLineItemDetail,
  LineItemCustomization,
} from "@craftynp/types";

import { sdk } from "../lib/client";

type CustomizedLine = {
  id: string;
  title: string;
  details: CheckoutLineItemDetail[];
  customization: LineItemCustomization;
};

function readDetails(value: unknown): CheckoutLineItemDetail[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (entry == null || typeof entry !== "object") return [];
    const { label, value: text } = entry as Record<string, unknown>;
    if (typeof label !== "string" || typeof text !== "string") return [];
    return [{ label, value: text }];
  });
}

function readCustomization(value: unknown): LineItemCustomization | null {
  if (value == null || typeof value !== "object") return null;
  return value as LineItemCustomization;
}

function customizedLines(order: AdminOrder): CustomizedLine[] {
  return (order.items ?? []).flatMap((item) => {
    const customization = readCustomization(item.metadata?.customization);
    if (!customization) return [];

    return [
      {
        id: item.id,
        title: item.product_title ?? item.title ?? "Item",
        details: readDetails(item.metadata?.details),
        customization,
      },
    ];
  });
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const DownloadArtworkButton = ({ assetId }: { assetId: string }) => {
  const [isPending, setIsPending] = useState(false);

  async function download() {
    setIsPending(true);
    try {
      const { url } = await sdk.client.fetch<ArtworkDownloadResponse>(
        `/admin/artwork/${assetId}`,
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not produce a download link for this artwork.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      size="small"
      variant="secondary"
      disabled={isPending}
      onClick={download}
    >
      {isPending ? <Spinner className="animate-spin" /> : "Download artwork"}
    </Button>
  );
};

const ArtworkBlock = ({
  artwork,
  asset,
  isLoading,
}: {
  artwork: NonNullable<LineItemCustomization["artwork"]>;
  asset: ArtworkOrderAsset | undefined;
  isLoading: boolean;
}) => (
  <div className="flex flex-col gap-2">
    <Text size="small" weight="plus">
      Artwork
    </Text>
    <Text size="small">
      {artwork.fileName}
      {artwork.widthPx && artwork.heightPx
        ? ` · ${artwork.widthPx} × ${artwork.heightPx} px`
        : ""}
      {` · ${formatBytes(artwork.sizeBytes)}`}
    </Text>

    {isLoading ? (
      <Spinner className="animate-spin" />
    ) : asset?.purgedAt ? (
      <Hint variant="error">
        This file passed its retention window and was deleted. The order keeps
        every other detail.
      </Hint>
    ) : asset ? (
      <DownloadArtworkButton assetId={asset.id} />
    ) : (
      <Hint>
        Still being filed. The file is safe in staging and is retried every 15
        minutes — reload shortly.
      </Hint>
    )}
  </div>
);

const OrderCustomizationWidget = ({ data }: DetailWidgetProps<AdminOrder>) => {
  const lines = customizedLines(data);

  const { data: stored, isLoading } = useQuery({
    queryKey: ["order-artwork", data.id],
    queryFn: () =>
      sdk.client.fetch<ArtworkOrderListResponse>("/admin/artwork", {
        query: { order_id: data.id },
      }),
    enabled: lines.some((line) => line.customization.artwork != null),
  });

  if (lines.length === 0) return null;

  const assetByLine = new Map(
    (stored?.artwork ?? []).flatMap((asset) =>
      asset.lineItemId ? [[asset.lineItemId, asset] as const] : [],
    ),
  );

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Customization</Heading>
      </div>

      {lines.map((line) => (
        <div key={line.id} className="flex flex-col gap-3 px-6 py-4">
          <Text size="small" weight="plus">
            {line.title}
          </Text>

          {line.details
            .filter((detail) => detail.label !== "Artwork")
            .map((detail) => (
              <div key={detail.label} className="flex flex-col gap-1">
                <Text size="small" className="text-ui-fg-subtle">
                  {detail.label}
                </Text>
                <Text size="small" className="whitespace-pre-line">
                  {detail.value}
                </Text>
              </div>
            ))}

          {line.customization.artwork ? (
            <ArtworkBlock
              artwork={line.customization.artwork}
              asset={assetByLine.get(line.id)}
              isLoading={isLoading}
            />
          ) : null}
        </div>
      ))}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.after",
});

export default OrderCustomizationWidget;
