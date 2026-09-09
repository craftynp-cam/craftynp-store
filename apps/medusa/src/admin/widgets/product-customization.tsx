import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Spinner } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Hint,
  Label,
  Select,
  Switch,
  toast,
} from "@medusajs/ui";
import type {
  AdminProduct,
  DetailWidgetProps,
} from "@medusajs/framework/types";
import {
  CUSTOMIZATION_INPUTS,
  READY_MADE_PRODUCT,
  activeCustomizationInputs,
  customizationMetadataPatch,
  resolveProductCustomization,
  type CustomizationInputMode,
  type ProductCustomization,
} from "@craftynp/types";

import { sdk } from "../lib/client";

const MODE_LABELS: Record<CustomizationInputMode, string> = {
  off: "Not asked for",
  optional: "Asked for, optional",
  required: "Required",
};

const ProductCustomizationWidget = ({
  data,
}: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient();
  const queryKey = ["product_customization", data.id];

  const [customization, setCustomization] =
    useState<ProductCustomization>(READY_MADE_PRODUCT);

  const { data: product, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.admin.product.retrieve(data.id, { fields: "id,metadata" }),
  });

  useEffect(() => {
    if (product) {
      setCustomization(resolveProductCustomization(product.product.metadata));
    }
  }, [product]);

  const save = useMutation({
    mutationFn: () =>
      sdk.admin.product.update(data.id, {
        metadata: {
          ...(product?.product.metadata ?? {}),
          ...customizationMetadataPatch(customization),
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["product", data.id] });
      toast.success("Customization saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save the customization");
    },
  });

  if (isLoading || !product) {
    return (
      <Container className="flex items-center justify-center p-6">
        <Spinner className="animate-spin" />
      </Container>
    );
  }

  const asksForNothing =
    customization.isCustomizable &&
    activeCustomizationInputs(customization).length === 0;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Customization</Heading>
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
        <div className="flex items-start justify-between gap-x-4">
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="product_customizable">Made to order</Label>
            <Hint>
              Off, this is a ready-made product and the storefront asks the
              shopper for nothing.
            </Hint>
          </div>
          <Switch
            id="product_customizable"
            checked={customization.isCustomizable}
            onCheckedChange={(isCustomizable) =>
              setCustomization((current) =>
                isCustomizable
                  ? { ...current, isCustomizable: true }
                  : READY_MADE_PRODUCT,
              )
            }
          />
        </div>

        {customization.isCustomizable
          ? CUSTOMIZATION_INPUTS.map((input) => (
              <div key={input.key} className="flex flex-col gap-y-2">
                <Label htmlFor={input.metadataKey}>{input.label}</Label>
                <Select
                  value={customization.inputs[input.key]}
                  onValueChange={(mode) =>
                    setCustomization((current) => ({
                      ...current,
                      inputs: {
                        ...current.inputs,
                        [input.key]: mode as CustomizationInputMode,
                      },
                    }))
                  }
                >
                  <Select.Trigger id={input.metadataKey}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {(
                      Object.keys(
                        MODE_LABELS,
                      ) as readonly CustomizationInputMode[]
                    ).map((mode) => (
                      <Select.Item key={mode} value={mode}>
                        {MODE_LABELS[mode]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Hint>{input.description}</Hint>
              </div>
            ))
          : null}

        {asksForNothing ? (
          <Hint variant="error">
            A made-to-order product has to ask for at least one input.
            Publishing it like this is rejected.
          </Hint>
        ) : null}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
});

export default ProductCustomizationWidget;
