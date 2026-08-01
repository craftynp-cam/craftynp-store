import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Prompt, toast } from "@medusajs/ui";

import {
  balanceQueryKey,
  describeFailure,
  orderStatusQueryKey,
  queueQueryKey,
  voidLabel,
} from "../../lib/fulfilment-api";

type Props = {
  orderId: string;
  disabled?: boolean;
};

export const VoidLabelButton = ({ orderId, disabled }: Props) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => voidLabel(orderId),
    onSuccess: (response) => {
      queryClient.setQueryData(orderStatusQueryKey(orderId), {
        orderStatus: response.orderStatus,
      });
      void queryClient.invalidateQueries({ queryKey: queueQueryKey });
      void queryClient.invalidateQueries({ queryKey: balanceQueryKey });

      if (response.voidApproved === false) {
        toast.warning(
          `The carrier would not accept the void: ${response.voidMessage ?? "no reason given"}. The order is back in packing, but do not expect a refund.`,
        );
        return;
      }

      toast.success(
        response.voidMessage
          ? `Label voided. The carrier said: ${response.voidMessage}`
          : "Label voided and the order returned to packing.",
      );
    },
    onError: (error: unknown) => toast.error(describeFailure(error)),
  });

  return (
    <Prompt variant="danger">
      <Prompt.Trigger asChild>
        <Button
          size="small"
          variant="danger"
          disabled={disabled || mutation.isPending}
        >
          Void label
        </Button>
      </Prompt.Trigger>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Void this label?</Prompt.Title>
          <Prompt.Description>
            This asks the carrier to cancel the label and puts the order back
            into packing. The carrier does not always accept a void, and a
            refund is not guaranteed — especially once the parcel has been
            scanned. The shipped email that has already gone to the customer
            cannot be recalled.
          </Prompt.Description>
        </Prompt.Header>
        <Prompt.Footer>
          <Prompt.Cancel>Keep the label</Prompt.Cancel>
          <Prompt.Action onClick={() => mutation.mutate()}>
            Void label
          </Prompt.Action>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
