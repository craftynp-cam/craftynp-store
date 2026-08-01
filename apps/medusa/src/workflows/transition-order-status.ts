import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  transitionOrderStatusStep,
  type TransitionOrderStatusStepInput,
} from "./steps/transition-order-status";

const transitionOrderStatusWorkflow = createWorkflow(
  "transition-order-status",
  function (input: TransitionOrderStatusStepInput) {
    const result = transitionOrderStatusStep(input);

    return new WorkflowResponse(result);
  },
);

export default transitionOrderStatusWorkflow;
