import { render } from "@testing-library/react";

import { Badge } from "@/components";

describe("Badge", () => {
  it.each([
    ["neutral", "chip--default"],
    ["accent", "chip--accent"],
    ["success", "chip--success"],
    ["danger", "chip--danger"],
  ] as const)("maps the %s tone onto %s", (tone, expected) => {
    const { container } = render(<Badge tone={tone}>Label</Badge>);

    expect(container.querySelector(".chip")).toHaveClass(expected);
  });

  it("defaults to the neutral tone", () => {
    const { container } = render(<Badge>Label</Badge>);

    expect(container.querySelector(".chip")).toHaveClass("chip--default");
  });
});
