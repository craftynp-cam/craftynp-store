"use client";

import { useRouter } from "next/navigation";

import { SORT_OPTIONS, sortHref, type CatalogSort } from "@/lib/sort";

import { Select } from "../ui";

type SortSelectProps = { basePath: string; sort: CatalogSort };

const sortSelectOptions = SORT_OPTIONS.map((option) => ({
  id: option.id,
  label: option.label,
}));

export function SortSelect({ basePath, sort }: SortSelectProps) {
  const router = useRouter();

  return (
    <Select
      label="Sort"
      options={sortSelectOptions}
      selectedKey={sort}
      onSelectionChange={(key) => {
        router.push(sortHref(basePath, key as CatalogSort));
      }}
      className="flex-row items-center gap-3"
    />
  );
}
