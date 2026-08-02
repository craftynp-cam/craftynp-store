import { useMutation } from "@tanstack/react-query";
import { Spinner } from "@medusajs/icons";
import { Button, Text, toast } from "@medusajs/ui";

import { describeFailure } from "../../lib/fulfilment-api";
import { printPdf } from "../../lib/print-pdf";

const UNAVAILABLE_HEADER = "x-labels-unavailable";

type Props = {
  orderIds: readonly string[];
  displayIdByOrderId: ReadonlyMap<string, number>;
  onClear: () => void;
};

export const BatchPrintBar = ({
  orderIds,
  displayIdByOrderId,
  onClear,
}: Props) => {
  const print = useMutation({
    mutationFn: () =>
      printPdf({
        path: "/admin/fulfilment/labels/print",
        method: "POST",
        body: { orderIds: [...orderIds] },
      }),
    onSuccess: (response) => {
      const missing = (response.headers.get(UNAVAILABLE_HEADER) ?? "")
        .split(",")
        .filter(Boolean);

      if (missing.length === 0) {
        toast.success(
          `Printing ${orderIds.length} ${orderIds.length === 1 ? "label" : "labels"} as one job.`,
        );
        return;
      }

      const names = missing
        .map((id) => `#${displayIdByOrderId.get(id) ?? id}`)
        .join(", ");

      toast.warning(
        `Printed ${orderIds.length - missing.length} of ${orderIds.length} labels. ${names} could not be loaded — open ${missing.length === 1 ? "that order" : "those orders"} and print separately.`,
      );
    },
    onError: (error: unknown) => toast.error(describeFailure(error)),
  });

  if (orderIds.length === 0) return null;

  return (
    <div className="bg-ui-bg-subtle border-ui-border-base flex items-center justify-between gap-4 rounded-md border px-4 py-3">
      <Text size="small">
        {`${orderIds.length} ${orderIds.length === 1 ? "order" : "orders"} selected`}
      </Text>
      <div className="flex items-center gap-2">
        <Button size="small" variant="transparent" onClick={onClear}>
          Clear
        </Button>
        <Button
          size="small"
          disabled={print.isPending}
          onClick={() => print.mutate()}
        >
          {print.isPending ? (
            <Spinner className="animate-spin" />
          ) : (
            `Print ${orderIds.length} ${orderIds.length === 1 ? "label" : "labels"} — one print job`
          )}
        </Button>
      </div>
    </div>
  );
};
