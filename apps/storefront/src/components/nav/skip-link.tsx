/**
 * The first focusable element on every page (CNP-24 AC 5). Off-screen until
 * focused, then pinned to the top-left so a keyboard or screen-reader user
 * can jump straight past the navbar into the page's own `<main
 * id="main-content">`.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to content
    </a>
  );
}
