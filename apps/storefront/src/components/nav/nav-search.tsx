"use client";

import { Label } from "@heroui/react/label";
import {
  SearchFieldGroup,
  SearchFieldInput,
  SearchFieldRoot,
  SearchFieldSearchIcon,
} from "@heroui/react/search-field";

import { MagnifyingGlass } from "../icons";

export function NavSearch() {
  return (
    <form
      role="search"
      className="w-full max-w-xl"
      onSubmit={(event) => event.preventDefault()}
    >
      <SearchFieldRoot fullWidth>
        <Label className="sr-only">Search products</Label>
        <SearchFieldGroup>
          <SearchFieldSearchIcon>
            <MagnifyingGlass aria-hidden="true" />
          </SearchFieldSearchIcon>
          <SearchFieldInput
            name="q"
            placeholder="Search stickers, shirts, keychains…"
          />
        </SearchFieldGroup>
      </SearchFieldRoot>
    </form>
  );
}
