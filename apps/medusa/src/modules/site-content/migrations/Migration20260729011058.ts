import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260729011058 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "site_content_entry" drop constraint if exists "site_content_entry_key_unique";`);
    this.addSql(`create table if not exists "site_content_entry" ("id" text not null, "key" text not null, "value" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "site_content_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_content_entry_key_unique" ON "site_content_entry" ("key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_site_content_entry_deleted_at" ON "site_content_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "site_content_entry" cascade;`);
  }

}
