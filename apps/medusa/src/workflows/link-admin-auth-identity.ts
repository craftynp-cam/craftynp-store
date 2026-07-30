import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  setAuthAppMetadataStep,
  updateUsersStep,
} from "@medusajs/medusa/core-flows";

import { linkAdminAuthIdentityStep } from "./steps/link-admin-auth-identity";

type LinkAdminAuthIdentityWorkflowInput = { authIdentityId: string };

const linkAdminAuthIdentityWorkflow = createWorkflow(
  "link-admin-auth-identity",
  function (input: LinkAdminAuthIdentityWorkflowInput) {
    const linkResult = linkAdminAuthIdentityStep(input);

    when(linkResult, (linkResult) => !linkResult.alreadyLinked).then(
      function () {
        const metadataInput = transform(
          { input, linkResult },
          ({ input, linkResult }) => ({
            authIdentityId: input.authIdentityId,
            actorType: "user",
            value: linkResult.userId,
          }),
        );

        setAuthAppMetadataStep(metadataInput);

        const userUpdateInput = transform({ linkResult }, ({ linkResult }) => {
          if (!linkResult.firstName && !linkResult.lastName) {
            return [];
          }

          return [
            {
              id: linkResult.userId,
              first_name: linkResult.firstName,
              last_name: linkResult.lastName,
            },
          ];
        });

        updateUsersStep(userUpdateInput);
      },
    );

    return new WorkflowResponse({ userId: linkResult.userId });
  },
);

export default linkAdminAuthIdentityWorkflow;
