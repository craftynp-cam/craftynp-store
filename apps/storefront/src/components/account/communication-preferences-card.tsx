"use client";

import { useState } from "react";

import type { MarketingPreferences } from "@/lib/account-preferences";

import { Card, Switch } from "../ui";

export type CommunicationPreferencesCardProps = {
  initialPreferences: MarketingPreferences;
};

export function CommunicationPreferencesCard({
  initialPreferences,
}: CommunicationPreferencesCardProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [error, setError] = useState(false);

  async function handleToggle(
    key: keyof MarketingPreferences,
    isSelected: boolean,
  ) {
    const previous = preferences;
    const next = { ...preferences, [key]: isSelected };
    setPreferences(next);
    setError(false);

    try {
      const response = await fetch("/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        setPreferences(previous);
        setError(true);
      }
    } catch {
      setPreferences(previous);
      setError(true);
    }
  }

  return (
    <Card title="Communication preferences">
      <div className="flex flex-col divide-y divide-border">
        <div className="pb-4">
          <Switch
            isSelected
            isDisabled
            label="Proof approvals & order updates"
            description="Receipts, proofs to approve, and shipping notices."
          />
        </div>
        <div className="py-4">
          <Switch
            isSelected={preferences.newDrops}
            onChange={(isSelected) => handleToggle("newDrops", isSelected)}
            label="New drops"
            description="A note when we add new designs — about once a month."
          />
        </div>
        <div className="pt-4">
          <Switch
            isSelected={preferences.salesAndBundles}
            onChange={(isSelected) =>
              handleToggle("salesAndBundles", isSelected)
            }
            label="Sales & bundle deals"
            description="Occasional discounts on stickers, shirts and cups."
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-foreground-muted">
        Order and proof emails are required — they&apos;re how you approve and
        track what you bought.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger-foreground">
          We couldn&apos;t save that. Please try again.
        </p>
      ) : null}
    </Card>
  );
}
