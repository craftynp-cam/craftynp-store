import type { ExecArgs } from "@medusajs/framework/types";

import { purgeArtwork } from "../jobs/purge-artwork";

export default async function run({ container }: ExecArgs) {
  await purgeArtwork(container);
}
