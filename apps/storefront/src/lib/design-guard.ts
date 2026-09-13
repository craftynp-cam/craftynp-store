import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  DESIGN_COOKIE_NAME,
  designSessionSecret,
  isDesignGateEnabled,
  verifyDesignSession,
  type DesignSession,
} from "./design-session";
import { designLoginHref } from "./routes";

export const getDesignSession = cache(
  async (): Promise<DesignSession | null> => {
    const store = await cookies();
    return verifyDesignSession(
      store.get(DESIGN_COOKIE_NAME)?.value,
      designSessionSecret(),
    );
  },
);

export async function requireDesignAccess(returnTo: string): Promise<void> {
  if (!isDesignGateEnabled()) return;

  const session = await getDesignSession();
  if (session) return;

  redirect(designLoginHref({ returnTo }));
}
