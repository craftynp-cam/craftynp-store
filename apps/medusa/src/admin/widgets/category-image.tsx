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

import { sdk } from "../lib/client";
import { SiteContentImageField } from "../components/site-content-image-field";

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const CategoryImageWidget = ({
  data,
}: DetailWidgetProps<AdminProductCategory>) => {
  const queryClient = useQueryClient();
  const queryKey = ["product_category_image", data.id];

  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");

  const { data: category, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.admin.productCategory.retrieve(data.id, { fields: "id,metadata" }),
  });

  useEffect(() => {
    if (category) {
      setImageUrl(toText(category.product_category.metadata?.image_url));
      setImageAlt(toText(category.product_category.metadata?.image_alt));
    }
  }, [category]);

  const save = useMutation({
    mutationFn: () =>
      sdk.admin.productCategory.update(data.id, {
        metadata: {
          ...(category?.product_category.metadata ?? {}),
          image_url: imageUrl,
          image_alt: imageAlt,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: ["product_category", data.id],
      });
      toast.success("Category image saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save the category image");
    },
  });

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
        <Heading level="h2">Image</Heading>
        <Button
          size="small"
          onClick={() => save.mutate()}
          isLoading={save.isPending}
          disabled={save.isPending}
        >
          Save
        </Button>
      </div>

      <div className="flex flex-col gap-y-4 px-6 py-4">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="category_image_url">Image</Label>
          <SiteContentImageField
            id="category_image_url"
            value={imageUrl}
            onChange={setImageUrl}
          />
          <Hint>
            This is the photo behind this category&apos;s slide in the homepage
            carousel. Without one the slide falls back to a pattern.
          </Hint>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label htmlFor="category_image_alt">Alt text</Label>
          <Input
            id="category_image_alt"
            value={imageAlt}
            onChange={(event) => setImageAlt(event.target.value)}
          />
          <Hint>
            Describe the photo for shoppers using a screen reader, which reads
            this aloud in place of the image. Leave it blank if the photo is
            purely decorative and the slide&apos;s heading already says
            everything it shows.
          </Hint>
        </div>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product_category.details.side.after",
});

export default CategoryImageWidget;
