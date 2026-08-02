import { Container } from "./ui";

export function StoreUnavailable() {
  return (
    <main id="main-content" tabIndex={-1} className="py-24">
      <meta name="robots" content="noindex" />
      <Container>
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-3xl text-foreground">
            The shop is having a moment
          </h1>
          <p className="mt-4 text-foreground-muted">
            We could not reach the shop just now, so there is nothing to show
            you. It is usually brief — please try again shortly.
          </p>
        </div>
      </Container>
    </main>
  );
}
