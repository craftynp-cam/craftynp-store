import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import type { SiteContentEntry } from "@craftynp/types";

import { upsertSiteContentStep } from "./steps/upsert-site-content";

type UpsertSiteContentWorkflowInput = { entries: SiteContentEntry[] };

const upsertSiteContentWorkflow = createWorkflow(
  "upsert-site-content",
  function (input: UpsertSiteContentWorkflowInput) {
    const entries = upsertSiteContentStep(input);

    return new WorkflowResponse({ entries });
  },
);

export default upsertSiteContentWorkflow;
