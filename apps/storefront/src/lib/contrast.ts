export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const value = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Expected a six-digit hex colour, received "${hex}"`);
  }

  const int = Number.parseInt(value, 16);

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((channel) =>
      Math.round(channel).toString(16).padStart(2, "0").toLowerCase(),
    )
    .join("")}`;
}

export function mixOver(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
  ];
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  ) as [number, number];

  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastGrade = "AA" | "AA Large" | "Fail";

export function gradeContrast(ratio: number): ContrastGrade {
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}
