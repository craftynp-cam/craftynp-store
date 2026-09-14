import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260913212738 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" add column if not exists "inspected_etag" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" drop column if exists "inspected_etag";`,
    );
  }
}
