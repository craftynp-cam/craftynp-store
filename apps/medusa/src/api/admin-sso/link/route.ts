import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import linkAdminAuthIdentityWorkflow from "../../../workflows/link-admin-auth-identity";

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const { result } = await linkAdminAuthIdentityWorkflow(req.scope).run({
    input: { authIdentityId: req.auth_context.auth_identity_id },
  });

  return res.json({ user_id: result.userId });
}
