import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260913204706 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" drop column if exists "dpi";`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "artwork_asset" add column if not exists "dpi" integer null;`,
    );
  }
}
