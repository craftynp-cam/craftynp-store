import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows";

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
      },
    );

    return new WorkflowResponse({ userId: linkResult.userId });
  },
);

export default linkAdminAuthIdentityWorkflow;
