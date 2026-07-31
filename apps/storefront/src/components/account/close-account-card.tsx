"use client";

import { useState } from "react";

import { Button, Card, ConfirmDialog } from "../ui";

export function CloseAccountCard() {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isClosing, setClosing] = useState(false);
  const [error, setError] = useState(false);

  async function handleConfirm() {
    setClosing(true);
    setError(false);

    try {
      const response = await fetch("/account/close", { method: "DELETE" });
      if (!response.ok) {
        setError(true);
        setClosing(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError(true);
      setClosing(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-foreground">
            Close account
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Deletes your profile and saved addresses, and signs you out. Past
            orders are kept as records of purchase. This can&apos;t be undone.
          </p>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger-foreground">
              We couldn&apos;t close your account. Please try again.
            </p>
          ) : null}
        </div>
        <Button variant="danger" onPress={() => setConfirmOpen(true)}>
          Close account
        </Button>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onOpenChange={setConfirmOpen}
        title="Close your account?"
        description="This deletes your profile and saved addresses, and signs you out. Past orders are kept as records of purchase. This can't be undone."
        confirmLabel="Close account"
        onConfirm={handleConfirm}
        isConfirming={isClosing}
      />
    </Card>
  );
}
