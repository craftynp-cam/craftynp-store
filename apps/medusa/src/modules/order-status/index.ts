import { Module } from "@medusajs/framework/utils";

import OrderStatusModuleService from "./service";

export const ORDER_STATUS_MODULE = "orderStatus";

export default Module(ORDER_STATUS_MODULE, {
  service: OrderStatusModuleService,
});
