import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260913045624 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" add column if not exists "inspected_at" timestamptz null;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_artwork_asset_staging_key" ON "artwork_asset" ("staging_key") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_artwork_asset_staging_key";`);
    this.addSql(
      `alter table if exists "artwork_asset" drop column if exists "inspected_at";`,
    );
  }
}
