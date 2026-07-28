import { SOCIAL_LINKS } from "@/lib/site";

describe("SOCIAL_LINKS", () => {
  it("every href is an absolute https URL", () => {
    for (const social of SOCIAL_LINKS) {
      expect(social.href).toMatch(/^https:\/\//);
    }
  });
});
