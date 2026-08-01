import { useQuery } from "@tanstack/react-query";
import { Badge, Text, Tooltip } from "@medusajs/ui";

import { balanceQueryKey, fetchBalance } from "../../lib/fulfilment-api";

const LOW_BALANCE = 25;

function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currencyCode.toUpperCase()}`;
  }
}

export const BalanceBadge = () => {
  const { data, isLoading } = useQuery({
    queryKey: balanceQueryKey,
    queryFn: fetchBalance,
    staleTime: 60_000,
  });

  if (isLoading) return null;

  if (!data?.available || data.balances.length === 0) {
    return (
      <Tooltip content="We could not reach ShipStation just now. Buying a label will still tell you if funds are short.">
        <Text size="small" className="text-ui-fg-subtle">
          Balance unavailable
        </Text>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {data.balances.map((balance) => (
        <Badge
          key={balance.carrierName}
          color={balance.balance < LOW_BALANCE ? "orange" : "grey"}
        >
          {`${balance.carrierName}: ${formatMoney(balance.balance, balance.currencyCode)}`}
        </Badge>
      ))}
    </div>
  );
};
