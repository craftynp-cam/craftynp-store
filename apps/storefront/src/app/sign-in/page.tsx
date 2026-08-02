import type { Metadata } from "next";

import { Container, SignInPanel } from "@/components";

export const metadata: Metadata = {
  title: "Sign in",
};

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, return_to: returnTo } = await searchParams;

  return (
    <main id="main-content" tabIndex={-1} className="py-16">
      <Container>
        <SignInPanel
          error={typeof error === "string" ? error : undefined}
          returnTo={typeof returnTo === "string" ? returnTo : undefined}
        />
      </Container>
    </main>
  );
}
