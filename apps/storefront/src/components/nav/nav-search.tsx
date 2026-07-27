"use client";

import { Label } from "@heroui/react/label";
import {
  SearchFieldGroup,
  SearchFieldInput,
  SearchFieldRoot,
  SearchFieldSearchIcon,
} from "@heroui/react/search-field";

import { MagnifyingGlass } from "../icons";

/**
 * The label is a real, programmatically associated `<Label>` in `sr-only` —
 * not the placeholder text alone, which CNP-24 AC 3 explicitly rejects.
 *
 * There is no submit target yet: `/search` ships with CNP-34, so the form
 * has no `action` and submitting is a no-op. The input, its name, and its
 * label are all real, so wiring the action later is a one-line change here
 * rather than a rebuild.
 */
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
