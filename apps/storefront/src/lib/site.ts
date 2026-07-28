export const SITE_NAME = "The Crafty NP";

export const SITE_TAGLINE =
  "Elevated Creativity. Custom designs personalized with you in mind!";

export type SocialLink = { label: string; href: string };

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { label: "Instagram", href: "https://www.instagram.com/the_crafty_np_" },
  { label: "Facebook", href: "https://www.facebook.com/people/The-Crafty-NP" },
  { label: "TikTok", href: "https://www.tiktok.com/@thecraftynp89" },
];

export type ContactLink = { name: string; href: string };

export const CONTACT_LINKS: readonly ContactLink[] = [
  { name: "Contact the maker", href: "/contact" },
  { name: "Request a custom quote", href: "/custom-quote" },
  { name: "About", href: "/about" },
];
