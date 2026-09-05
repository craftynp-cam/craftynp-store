import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260905221112 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" drop constraint if exists "artwork_asset_upload_id_unique";`,
    );
    this.addSql(
      `create table if not exists "artwork_asset" ("id" text not null, "upload_id" text not null, "staging_key" text not null, "storage_key" text null, "order_id" text null, "line_item_id" text null, "file_name" text not null, "mime_type" text not null, "size_bytes" integer not null, "uploaded_at" timestamptz not null, "promoted_at" timestamptz null, "purged_at" timestamptz null, "purge_reason" text null, "width_px" integer null, "height_px" integer null, "dpi" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "artwork_asset_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_artwork_asset_upload_id_unique" ON "artwork_asset" ("upload_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_asset_deleted_at" ON "artwork_asset" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_asset_order_id" ON "artwork_asset" ("order_id") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "artwork_asset" cascade;`);
  }
}
