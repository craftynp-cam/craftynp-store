import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260801015735 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tracking_webhook_event" drop constraint if exists "tracking_webhook_event_event_key_unique";`);
    this.addSql(`alter table if exists "shipment_tracking" drop constraint if exists "shipment_tracking_tracking_number_unique";`);
    this.addSql(`alter table if exists "order_status" drop constraint if exists "order_status_order_id_unique";`);
    this.addSql(`create table if not exists "order_status" ("id" text not null, "order_id" text not null, "status" text not null, "changed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_status_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_status_order_id_unique" ON "order_status" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_deleted_at" ON "order_status" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "order_status_history" ("id" text not null, "from_status" text null, "to_status" text not null, "reason" text null, "actor_type" text not null, "actor_id" text null, "order_status_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_status_history_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_history_order_status_id" ON "order_status_history" ("order_status_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_status_history_deleted_at" ON "order_status_history" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipment_tracking" ("id" text not null, "tracking_number" text not null, "fulfillment_id" text null, "carrier_code" text null, "service_code" text null, "label_id" text null, "label_url" text null, "tracking_status" text not null, "tracking_status_description" text null, "shipped_at" timestamptz null, "delivered_at" timestamptz null, "voided_at" timestamptz null, "order_status_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_tracking_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_tracking_tracking_number_unique" ON "shipment_tracking" ("tracking_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_tracking_order_status_id" ON "shipment_tracking" ("order_status_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipment_tracking_deleted_at" ON "shipment_tracking" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tracking_webhook_event" ("id" text not null, "event_key" text not null, "tracking_number" text not null, "status_code" text not null, "occurred_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tracking_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracking_webhook_event_event_key_unique" ON "tracking_webhook_event" ("event_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tracking_webhook_event_deleted_at" ON "tracking_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "order_status_history" add constraint "order_status_history_order_status_id_foreign" foreign key ("order_status_id") references "order_status" ("id") on update cascade;`);

    this.addSql(`alter table if exists "shipment_tracking" add constraint "shipment_tracking_order_status_id_foreign" foreign key ("order_status_id") references "order_status" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "order_status_history" drop constraint if exists "order_status_history_order_status_id_foreign";`);

    this.addSql(`alter table if exists "shipment_tracking" drop constraint if exists "shipment_tracking_order_status_id_foreign";`);

    this.addSql(`drop table if exists "order_status" cascade;`);

    this.addSql(`drop table if exists "order_status_history" cascade;`);

    this.addSql(`drop table if exists "shipment_tracking" cascade;`);

    this.addSql(`drop table if exists "tracking_webhook_event" cascade;`);
  }

}
