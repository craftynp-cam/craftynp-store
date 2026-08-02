import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Hint, OtpInput, Text } from "@medusajs/ui";
import type { AuthMfaRequiredResponse } from "@medusajs/js-sdk";

import { sdk } from "../lib/client";

type AuthMfaChallenge = AuthMfaRequiredResponse["mfa_challenge"];
type AuthMfaChallengeMethod = AuthMfaChallenge["methods"][number];

type Phase = "idle" | "redirecting" | "processing" | "mfa" | "error";

function getDefaultMfaMethod(
  methods: AuthMfaChallengeMethod[],
): AuthMfaChallengeMethod {
  if (methods.includes("totp")) {
    return "totp";
  }
  return methods[0] ?? "totp";
}

async function completeSignIn(navigate: (path: string) => void) {
  await sdk.client.fetch("/admin-sso/link", { method: "POST" });
  await sdk.auth.refresh();
  navigate("/orders");
}

const GoogleWorkspaceLoginWidget = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<AuthMfaChallenge | null>(null);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const state = params.get("state");

    if (!authCode || !state) {
      return;
    }

    setPhase("processing");

    sdk.auth
      .callback("user", "google-workspace", { code: authCode, state })
      .then((result) => {
        window.history.replaceState(null, "", window.location.pathname);

        if (typeof result === "object" && "mfa_challenge" in result) {
          setChallenge(result.mfa_challenge);
          setPhase("mfa");
          return;
        }

        return completeSignIn(navigate);
      })
      .catch((err) => {
        window.history.replaceState(null, "", window.location.pathname);
        setError(err instanceof Error ? err.message : "Sign-in failed.");
        setPhase("error");
      });
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setPhase("redirecting");
    setError(null);

    try {
      const result = await sdk.auth.login("user", "google-workspace", {});

      if (typeof result === "object" && "location" in result) {
        window.location.href = result.location;
        return;
      }

      navigate("/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setPhase("error");
    }
  };

  const handleVerifyChallenge = async () => {
    if (!challenge) return;

    setIsVerifying(true);
    setError(null);

    try {
      await sdk.auth.mfa.verifyChallenge(challenge.id, {
        method: getDefaultMfaMethod(challenge.methods),
        code: code.trim(),
      });
      await completeSignIn(navigate);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not verify that code.",
      );
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  if (phase === "mfa" && challenge) {
    return (
      <div className="flex w-full flex-col gap-y-4">
        <Text size="small" className="text-ui-fg-subtle text-center">
          Enter the code from your authenticator app.
        </Text>
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={handleVerifyChallenge}
          disabled={isVerifying}
          autoFocus
        />
        {error && (
          <div className="text-center">
            <Hint className="inline-flex" variant="error">
              {error}
            </Hint>
          </div>
        )}
        <Button
          className="w-full"
          isLoading={isVerifying}
          disabled={code.length !== 6}
          onClick={handleVerifyChallenge}
        >
          Verify
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-y-3">
      <Button
        className="w-full"
        variant="secondary"
        isLoading={phase === "redirecting" || phase === "processing"}
        onClick={handleGoogleSignIn}
      >
        Continue with Google Workspace
      </Button>
      {error && (
        <div className="text-center">
          <Hint className="inline-flex" variant="error">
            {error}
          </Hint>
        </div>
      )}
    </div>
  );
};

export const config = defineWidgetConfig({
  zone: "login.before",
});

export default GoogleWorkspaceLoginWidget;
