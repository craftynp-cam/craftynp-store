import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Hint,
  Input,
  Label,
  toast,
} from "@medusajs/ui";
import type {
  AdminProductCategory,
  DetailWidgetProps,
} from "@medusajs/framework/types";
import {
  ARTWORK_MIN_DPI_METADATA_KEY,
  DEFAULT_ARTWORK_MIN_DPI,
} from "@craftynp/types";

import { sdk } from "../lib/client";

function toText(value: unknown): string {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value : "";
}

function problemWith(value: string): string | null {
  if (value.trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Enter a positive number of dots per inch, like 300.";
  }

  return null;
}

const CategoryArtworkWidget = ({
  data,
}: DetailWidgetProps<AdminProductCategory>) => {
  const queryClient = useQueryClient();
  const queryKey = ["product_category_artwork", data.id];

  const [minDpi, setMinDpi] = useState("");

  const { data: category, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.admin.productCategory.retrieve(data.id, { fields: "id,metadata" }),
  });

  useEffect(() => {
    if (category) {
      setMinDpi(
        toText(
          category.product_category.metadata?.[ARTWORK_MIN_DPI_METADATA_KEY],
        ),
      );
    }
  }, [category]);

  const save = useMutation({
    mutationFn: () =>
      sdk.admin.productCategory.update(data.id, {
        // Medusa replaces the metadata column wholesale, so an unspread write
        // destroys this category's image and everything else on it.
        metadata: {
          ...(category?.product_category.metadata ?? {}),
          [ARTWORK_MIN_DPI_METADATA_KEY]: minDpi.trim(),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: ["product_category", data.id],
      });
      toast.success("Artwork requirements saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save the artwork requirements");
    },
  });

  const problem = problemWith(minDpi);

  if (isLoading || !category) {
    return (
      <Container className="flex items-center justify-center p-6">
        <Spinner className="animate-spin" />
      </Container>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Artwork</Heading>
        <Button
          size="small"
          onClick={() => save.mutate()}
          isLoading={save.isPending}
          disabled={save.isPending || problem !== null}
        >
          Save
        </Button>
      </div>

      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Label htmlFor="category_artwork_min_dpi">Minimum resolution</Label>
        <Input
          id="category_artwork_min_dpi"
          inputMode="decimal"
          placeholder={String(DEFAULT_ARTWORK_MIN_DPI)}
          value={minDpi}
          onChange={(event) => setMinDpi(event.target.value)}
        />
        {problem ? (
          <Hint variant="error">{problem}</Hint>
        ) : (
          <Hint>
            Uploads for products in this category are held to this many dots per
            inch at the size ordered, and a file below it cannot be added to the
            cart. 300 is the print standard; 150 is a common floor for
            large-format work seen at a distance. Leave it blank to use{" "}
            {DEFAULT_ARTWORK_MIN_DPI}. A product in more than one category is
            held to the strictest.
          </Hint>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product_category.details.side.after",
});

export default CategoryArtworkWidget;
