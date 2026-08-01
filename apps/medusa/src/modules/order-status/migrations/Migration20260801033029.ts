import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801033029 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "shipment_tracking" add column if not exists "carrier_id" text null, add column if not exists "label_file_id" text null, add column if not exists "shipment_cost" numeric null, add column if not exists "shipment_cost_currency" text null, add column if not exists "void_approved" boolean null, add column if not exists "void_message" text null, add column if not exists "raw_shipment_cost" jsonb null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "shipment_tracking" drop column if exists "carrier_id", drop column if exists "label_file_id", drop column if exists "shipment_cost", drop column if exists "shipment_cost_currency", drop column if exists "void_approved", drop column if exists "void_message", drop column if exists "raw_shipment_cost";`,
    );
  }
}
