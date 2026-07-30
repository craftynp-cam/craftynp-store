import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import type { IAuthModuleService } from "@medusajs/framework/types";

type StepInput = { authIdentityId: string };

type StepOutput = {
  userId: string;
  alreadyLinked: boolean;
  firstName?: string;
  lastName?: string;
};

export const linkAdminAuthIdentityStep = createStep(
  "link-admin-auth-identity",
  async ({ authIdentityId }: StepInput, { container }) => {
    const authModuleService = container.resolve<IAuthModuleService>(
      Modules.AUTH,
    );
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const authIdentity = await authModuleService.retrieveAuthIdentity(
      authIdentityId,
      { relations: ["provider_identities"] },
    );

    if (authIdentity.app_metadata?.user_id) {
      return new StepResponse<StepOutput>({
        userId: authIdentity.app_metadata.user_id as string,
        alreadyLinked: true,
      });
    }

    const providerIdentity = authIdentity.provider_identities?.find(
      (identity) => identity.provider === "google-workspace",
    );

    if (!providerIdentity) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "No Google Workspace identity found for this account.",
      );
    }

    const { data: users } = await query.graph({
      entity: "user",
      fields: ["id", "email"],
      filters: { email: providerIdentity.entity_id },
    });

    const user = users[0];

    if (!user) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "No admin user exists for this Google Workspace account.",
      );
    }

    const { given_name: firstName, family_name: lastName } =
      providerIdentity.user_metadata ?? {};

    return new StepResponse<StepOutput>({
      userId: user.id,
      alreadyLinked: false,
      firstName: typeof firstName === "string" ? firstName : undefined,
      lastName: typeof lastName === "string" ? lastName : undefined,
    });
  },
);
