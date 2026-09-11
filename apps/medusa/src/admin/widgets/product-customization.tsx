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
  CUSTOMIZATION_INPUT_MODES,
  CUSTOM_TEXT_FALLBACK_MAX_LENGTH,
  CUSTOM_TEXT_LENGTH_CEILING,
  DEFAULT_MIN_ORDER_QUANTITY,
  MIN_ORDER_QUANTITY_METADATA_KEY,
  READY_MADE_PRODUCT,
  activeCustomizationInputs,
  customizationMetadataPatch,
  resolveMinOrderQuantity,
  resolveProductCustomization,
  unmeasuredOptionValues,
  type CustomizationInputMode,
  type ProductCustomization,
} from "@craftynp/types";

import { sdk } from "../lib/client";

const MODE_LABELS: Record<CustomizationInputMode, string> = {
  off: "Not asked for",
  optional: "Asked for, optional",
  required: "Required",
};

type SizeDraft = {
  minInches: string;
  maxInches: string;
  optionTitle: string;
  optionValue: string;
};

const SIZE_FIELDS = [
  {
    key: "minInches",
    label: "Smallest side (inches)",
    hint: "Anything below this is refused with an error naming the range.",
  },
  {
    key: "maxInches",
    label: "Largest side (inches)",
    hint: "The biggest width or height the workshop will make.",
  },
  {
    key: "optionTitle",
    label: "Preset size option",
    hint: "The option group the custom size replaces, exactly as it is titled — leave blank and the presets are untouched.",
  },
  {
    key: "optionValue",
    label: "Custom option value",
    hint: "The value on that group the storefront selects while the shopper is entering their own size.",
  },
] as const satisfies readonly {
  key: keyof SizeDraft;
  label: string;
  hint: string;
}[];

const TEXT_LIMIT_HINT = `How many characters the shopper may enter, up to ${CUSTOM_TEXT_LENGTH_CEILING}. Blank falls back to ${CUSTOM_TEXT_FALLBACK_MAX_LENGTH}. The storefront counts against this and the backend refuses anything longer.`;

function readTextLimitDraft(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed)) return null;
  return parsed >= 1 && parsed <= CUSTOM_TEXT_LENGTH_CEILING ? parsed : null;
}

function readOrderMinimumDraft(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed)) return null;
  return parsed >= 1 ? parsed : null;
}

const ProductCustomizationWidget = ({
  data,
}: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useQueryClient();
  const queryKey = ["product_customization", data.id];

  const [customization, setCustomization] =
    useState<ProductCustomization>(READY_MADE_PRODUCT);
  const [size, setSize] = useState<SizeDraft>({
    minInches: "",
    maxInches: "",
    optionTitle: "",
    optionValue: "",
  });
  const [textMaxLength, setTextMaxLength] = useState("");
  const [orderMinimum, setOrderMinimum] = useState("");

  const { data: product, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.admin.product.retrieve(data.id, {
        fields:
          "id,metadata,options.title,options.values.value,*options.values",
      }),
  });

  useEffect(() => {
    if (!product) return;

    const resolved = resolveProductCustomization(product.product.metadata);
    setCustomization(resolved);
    setSize({
      minInches:
        resolved.inputs.dimensions === "off"
          ? ""
          : String(resolved.size.minInches),
      maxInches:
        resolved.inputs.dimensions === "off"
          ? ""
          : String(resolved.size.maxInches),
      optionTitle: resolved.size.optionTitle ?? "",
      optionValue: resolved.size.optionValue ?? "",
    });
    setTextMaxLength(
      resolved.inputs.customText === "off"
        ? ""
        : String(resolved.text.maxLength),
    );

    const minimum = resolveMinOrderQuantity(product.product.metadata);
    setOrderMinimum(
      minimum === DEFAULT_MIN_ORDER_QUANTITY ? "" : String(minimum),
    );
  }, [product]);

  const save = useMutation({
    // Re-read immediately before writing rather than spreading this widget's
    // own cached copy. Medusa replaces the metadata column wholesale, and the
    // dashboard's built-in Metadata and JSON editors write the same column on
    // this very page — so a copy fetched at mount is stale the moment the
    // owner uses one of them, and spreading it destroys what they just wrote.
    mutationFn: async () => {
      const fresh = await sdk.admin.product.retrieve(data.id, {
        fields: "id,metadata",
      });

      return sdk.admin.product.update(data.id, {
        metadata: {
          ...(fresh.product.metadata ?? {}),
          ...customizationMetadataPatch({
            ...customization,
            size: {
              minInches: Number(size.minInches),
              maxInches: Number(size.maxInches),
              optionTitle: size.optionTitle.trim() || null,
              optionValue: size.optionValue.trim() || null,
            },
            text: {
              maxLength:
                readTextLimitDraft(textMaxLength) ??
                CUSTOM_TEXT_FALLBACK_MAX_LENGTH,
            },
          }),
          [MIN_ORDER_QUANTITY_METADATA_KEY]: orderMinimum.trim(),
        },
      });
    },
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

  const asksForSize =
    customization.isCustomizable && customization.inputs.dimensions !== "off";

  const boundsAreSet = [size.minInches, size.maxInches].every(
    (bound) => Number(bound) > 0,
  );

  const asksForText =
    customization.isCustomizable && customization.inputs.customText !== "off";

  const textLimitIsBroken =
    asksForText &&
    textMaxLength.trim() !== "" &&
    readTextLimitDraft(textMaxLength) === null;

  const asksForArtwork =
    customization.isCustomizable && customization.inputs.artwork !== "off";

  const orderMinimumIsBroken =
    orderMinimum.trim() !== "" && readOrderMinimumDraft(orderMinimum) === null;

  const sizing = unmeasuredOptionValues(
    (product?.product as { options?: unknown } | undefined)?.options as
      Parameters<typeof unmeasuredOptionValues>[0] | undefined,
    {
      sizeOptionTitle: size.optionTitle.trim() || null,
      customValue: size.optionValue.trim() || null,
    },
  );

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Ordering and customization</Heading>
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
          <Label htmlFor={MIN_ORDER_QUANTITY_METADATA_KEY}>
            Minimum order quantity
          </Label>
          <Input
            id={MIN_ORDER_QUANTITY_METADATA_KEY}
            value={orderMinimum}
            placeholder={String(DEFAULT_MIN_ORDER_QUANTITY)}
            onChange={(event) => setOrderMinimum(event.target.value)}
          />
          <Hint>
            The fewest units a shopper may order. Blank means one. Applies
            whether or not this product is made to order.
          </Hint>
        </div>

        {orderMinimumIsBroken ? (
          <Hint variant="error">
            The minimum must be a whole number of units, 1 or more. Saving it
            like this is rejected.
          </Hint>
        ) : null}

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
                    {CUSTOMIZATION_INPUT_MODES.map((mode) => (
                      <Select.Item key={mode} value={mode}>
                        {MODE_LABELS[mode]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Hint>{input.description}</Hint>

                {input.key === "customText" && asksForText ? (
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor="customization_text_max_length">
                      Character limit
                    </Label>
                    <Input
                      id="customization_text_max_length"
                      value={textMaxLength}
                      onChange={(event) => setTextMaxLength(event.target.value)}
                    />
                    <Hint>{TEXT_LIMIT_HINT}</Hint>
                  </div>
                ) : null}

                {input.key === "dimensions" && asksForSize
                  ? SIZE_FIELDS.map((field) => (
                      <div key={field.key} className="flex flex-col gap-y-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          value={size[field.key]}
                          onChange={(event) =>
                            setSize((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                        <Hint>{field.hint}</Hint>
                      </div>
                    ))
                  : null}
              </div>
            ))
          : null}

        {asksForSize && !boundsAreSet ? (
          <Hint variant="error">
            A custom size needs both bounds. Publishing it like this is
            rejected.
          </Hint>
        ) : null}

        {textLimitIsBroken ? (
          <Hint variant="error">
            The character limit must be a whole number between 1 and{" "}
            {CUSTOM_TEXT_LENGTH_CEILING}. Saving it like this falls back to{" "}
            {CUSTOM_TEXT_FALLBACK_MAX_LENGTH}.
          </Hint>
        ) : null}

        {asksForNothing ? (
          <Hint variant="error">
            A made-to-order product has to ask for at least one input.
            Publishing it like this is rejected.
          </Hint>
        ) : null}

        {asksForArtwork && !sizing.anyMeasured ? (
          <Hint variant="error">
            No option value on this product records a physical size, so uploads
            here cannot be checked against a minimum resolution — every file
            will be accepted. Put a width_inches (and height_inches) on your
            size option values in the Options section.
          </Hint>
        ) : null}

        {asksForArtwork && sizing.anyMeasured && sizing.missing.length > 0 ? (
          <Hint variant="error">
            These option values record no physical size, so a shopper choosing
            one gets no resolution check: {sizing.missing.join(", ")}.
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
