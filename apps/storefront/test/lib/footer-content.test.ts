import { resolveSiteContent } from "@craftynp/types";

import { toFooterContact } from "@/lib/footer-content";

function contentWith(contact_phone: string, contact_email: string) {
  return resolveSiteContent([
    { key: "contact_phone", value: contact_phone },
    { key: "contact_email", value: contact_email },
  ]);
}

describe("toFooterContact", () => {
  it("dials a ten-digit number as US and keeps the owner's formatting as the label", () => {
    expect(toFooterContact(contentWith("317.843.1640", "")).phone).toEqual({
      label: "317.843.1640",
      href: "tel:+13178431640",
    });
  });

  it("keeps an international number's own country code", () => {
    expect(toFooterContact(contentWith("+44 20 7946 0958", "")).phone).toEqual({
      label: "+44 20 7946 0958",
      href: "tel:+442079460958",
    });
  });

  it("treats a leading 1 on eleven digits as the US country code", () => {
    expect(toFooterContact(contentWith("1 (317) 843-1640", "")).phone).toEqual({
      label: "1 (317) 843-1640",
      href: "tel:+13178431640",
    });
  });

  it("dials an unrecognised length with the digits it was given", () => {
    expect(toFooterContact(contentWith("843-1640", "")).phone).toEqual({
      label: "843-1640",
      href: "tel:8431640",
    });
  });

  it("trims surrounding whitespace from both values", () => {
    const contact = toFooterContact(
      contentWith("  317.843.1640  ", "  hello@thecraftynp.com  "),
    );

    expect(contact.phone?.label).toBe("317.843.1640");
    expect(contact.email).toEqual({
      label: "hello@thecraftynp.com",
      href: "mailto:hello@thecraftynp.com",
    });
  });

  it("omits a phone with no digits in it rather than linking a bare tel:", () => {
    expect(toFooterContact(contentWith("call me", "")).phone).toBeNull();
  });

  it("omits either value when it is left empty", () => {
    expect(toFooterContact(contentWith("", ""))).toEqual({
      phone: null,
      email: null,
    });
  });
});
