import type { SiteContent } from "@craftynp/types";

import type { FooterContact } from "@/components";

function telHref(digits: string, raw: string): string {
  if (raw.startsWith("+")) {
    return `tel:+${digits}`;
  }
  if (digits.length === 10) {
    return `tel:+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `tel:+${digits}`;
  }
  return `tel:${digits}`;
}

export function toFooterContact(content: SiteContent): FooterContact {
  const phone = content.contact_phone.trim();
  const email = content.contact_email.trim();
  const digits = phone.replace(/\D/g, "");

  return {
    phone:
      digits === "" ? null : { label: phone, href: telHref(digits, phone) },
    email: email === "" ? null : { label: email, href: `mailto:${email}` },
  };
}
