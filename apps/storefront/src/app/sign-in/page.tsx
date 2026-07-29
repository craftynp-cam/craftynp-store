import type { Metadata } from "next";

import { SignInPanel } from "@/components";

export const metadata: Metadata = {
  title: "Sign in",
};

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, return_to: returnTo } = await searchParams;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-6xl px-4 py-16"
    >
      <SignInPanel
        error={typeof error === "string" ? error : undefined}
        returnTo={typeof returnTo === "string" ? returnTo : undefined}
      />
    </main>
  );
}
