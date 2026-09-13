import { requireDesignAccess } from "@/lib/design-guard";
import { designHref } from "@/lib/routes";

export default async function DesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDesignAccess(designHref());

  return children;
}
