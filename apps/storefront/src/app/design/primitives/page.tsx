import type { Metadata } from "next";

import { requireDesignAccess } from "@/lib/design-guard";

import { PrimitivesView } from "./primitives-view";

export const metadata: Metadata = {
  title: "Primitives",
  description:
    "Reference page for the UI primitives every storefront component is built from.",
};

export default async function PrimitivesPage() {
  await requireDesignAccess("/design/primitives");

  return <PrimitivesView />;
}
