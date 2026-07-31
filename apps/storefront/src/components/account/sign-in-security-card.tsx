"use client";

import { useState } from "react";

import type { AuthProvider } from "@/lib/auth";

import { Button, Card } from "../ui";

export type SignInSecurityCardProps = {
  authProvider: AuthProvider;
};

export function SignInSecurityCard({ authProvider }: SignInSecurityCardProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSendReset() {
    setStatus("sending");
    try {
      const response = await fetch("/account/password-reset", {
        method: "POST",
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card title="Sign-in & security">
      {authProvider === "google" ? (
        <div>
          <p className="text-foreground">Signed in with Google</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Your password is managed by Google.
          </p>
        </div>
      ) : null}

      {authProvider === "email" ? (
        <div>
          <p className="text-foreground">Signed in with email and password</p>
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="secondary"
              onPress={handleSendReset}
              isLoading={status === "sending"}
              loadingLabel="Sending"
              isDisabled={status === "sent"}
            >
              Email me a reset link
            </Button>
            {status === "sent" ? (
              <p className="text-sm text-foreground-muted">
                Check your inbox for a reset link.
              </p>
            ) : null}
            {status === "error" ? (
              <p className="text-sm text-danger-foreground">
                We couldn&apos;t send that email. Please try again.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {authProvider === "unknown" ? (
        <p className="text-sm text-foreground-muted">
          Sign in again to see how you sign in and manage your password.
        </p>
      ) : null}
    </Card>
  );
}
