import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260913210631 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_claim" drop constraint if exists "artwork_claim_line_item_id_unique";`,
    );
    this.addSql(
      `create table if not exists "artwork_claim" ("id" text not null, "order_id" text not null, "line_item_id" text not null, "storage_key" text null, "promoted_at" timestamptz null, "purged_at" timestamptz null, "purge_reason" text null, "asset_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "artwork_claim_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_artwork_claim_line_item_id_unique" ON "artwork_claim" ("line_item_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_claim_asset_id" ON "artwork_claim" ("asset_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_claim_deleted_at" ON "artwork_claim" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_claim_order_id" ON "artwork_claim" ("order_id") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "artwork_claim" add constraint "artwork_claim_asset_id_foreign" foreign key ("asset_id") references "artwork_asset" ("id") on update cascade;`,
    );

    this.addSql(
      `insert into "artwork_claim" ("id", "asset_id", "order_id", "line_item_id", "storage_key", "promoted_at", "purged_at", "purge_reason", "created_at", "updated_at") select "id", "id", "order_id", "line_item_id", "storage_key", "promoted_at", "purged_at", "purge_reason", coalesce("promoted_at", "updated_at"), "updated_at" from "artwork_asset" where "order_id" is not null and "line_item_id" is not null and "deleted_at" is null;`,
    );
    this.addSql(
      `update "artwork_asset" set "purged_at" = null, "purge_reason" = null where "order_id" is not null and "line_item_id" is not null and "deleted_at" is null;`,
    );

    this.addSql(`drop index if exists "IDX_artwork_asset_order_id";`);
    this.addSql(
      `alter table if exists "artwork_asset" drop column if exists "storage_key", drop column if exists "order_id", drop column if exists "line_item_id", drop column if exists "promoted_at";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" add column if not exists "storage_key" text null, add column if not exists "order_id" text null, add column if not exists "line_item_id" text null, add column if not exists "promoted_at" timestamptz null;`,
    );

    this.addSql(
      `update "artwork_asset" as "asset" set "order_id" = "claim"."order_id", "line_item_id" = "claim"."line_item_id", "storage_key" = "claim"."storage_key", "promoted_at" = "claim"."promoted_at", "purged_at" = "claim"."purged_at", "purge_reason" = "claim"."purge_reason" from (select distinct on ("asset_id") * from "artwork_claim" where "deleted_at" is null order by "asset_id", "created_at", "id") as "claim" where "claim"."asset_id" = "asset"."id";`,
    );

    this.addSql(`drop table if exists "artwork_claim" cascade;`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_asset_order_id" ON "artwork_asset" ("order_id") WHERE deleted_at IS NULL;`,
    );
  }
}
