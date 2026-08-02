import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { SHIPSTATION_MODULE } from "../../../../modules/shipstation";
import type ShipStationModuleService from "../../../../modules/shipstation/service";

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const shipstation =
    req.scope.resolve<ShipStationModuleService>(SHIPSTATION_MODULE);

  const balances = await shipstation.getCarrierBalances();

  return res.json({
    balances,
    fetchedAt: balances.length > 0 ? new Date().toISOString() : null,
    available: balances.length > 0,
  });
}
