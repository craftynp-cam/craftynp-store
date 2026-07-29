import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Newspaper, Spinner } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { SITE_CONTENT_FIELDS } from "@craftynp/types";
import type {
  SiteContent,
  SiteContentField,
  SiteContentKey,
} from "@craftynp/types";

import { sdk } from "../../lib/client";

const SITE_CONTENT_QUERY_KEY = ["site-content"];

type SiteContentResponse = { site_content: SiteContent };

type FormValues = Record<SiteContentKey, string>;

function groupedFields(): Array<[string, SiteContentField[]]> {
  const groups = new Map<string, SiteContentField[]>();
  for (const field of SITE_CONTENT_FIELDS as readonly SiteContentField[]) {
    const existing = groups.get(field.group) ?? [];
    existing.push(field);
    groups.set(field.group, existing);
  }
  return Array.from(groups.entries());
}

const FIELD_GROUPS = groupedFields();

function toFormValues(content: SiteContent): FormValues {
  return Object.fromEntries(
    SITE_CONTENT_FIELDS.map((field) => [field.key, String(content[field.key])]),
  ) as FormValues;
}

const SiteContentPage = () => {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues | null>(null);

  const { data, isLoading } = useQuery({
    queryFn: () => sdk.client.fetch<SiteContentResponse>("/admin/site-content"),
    queryKey: SITE_CONTENT_QUERY_KEY,
  });

  useEffect(() => {
    if (data) {
      setValues(toFormValues(data.site_content));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (entries: { key: SiteContentKey; value: string }[]) =>
      sdk.client.fetch<SiteContentResponse>("/admin/site-content", {
        method: "POST",
        body: { entries },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(SITE_CONTENT_QUERY_KEY, result);
      toast.success("Site content saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save site content");
    },
  });

  const handleChange = (key: SiteContentKey, value: string) => {
    setValues((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = () => {
    if (!values) return;
    save.mutate(
      SITE_CONTENT_FIELDS.map((field) => ({
        key: field.key,
        value: values[field.key],
      })),
    );
  };

  if (isLoading || !values) {
    return (
      <Container className="flex items-center justify-center py-16">
        <Spinner className="animate-spin" />
      </Container>
    );
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Site content</Heading>
        <Button
          size="small"
          onClick={handleSave}
          isLoading={save.isPending}
          disabled={save.isPending}
        >
          Save
        </Button>
      </div>

      {FIELD_GROUPS.map(([group, fields]) => (
        <div key={group} className="flex flex-col gap-y-4 px-6 py-4">
          <Text size="small" leading="compact" weight="plus">
            {group}
          </Text>

          {fields.map((field) => {
            const key = field.key as SiteContentKey;

            return (
              <div key={key} className="flex flex-col gap-y-2">
                {field.type === "boolean" ? (
                  <div className="flex items-center gap-x-2">
                    <Switch
                      id={key}
                      checked={values[key] === "true"}
                      onCheckedChange={(checked) =>
                        handleChange(key, String(checked))
                      }
                    />
                    <Label htmlFor={key}>{field.label}</Label>
                  </div>
                ) : (
                  <>
                    <Label htmlFor={key}>{field.label}</Label>
                    {field.type === "longText" ? (
                      <Textarea
                        id={key}
                        value={values[key]}
                        onChange={(event) =>
                          handleChange(key, event.target.value)
                        }
                      />
                    ) : (
                      <Input
                        id={key}
                        value={values[key]}
                        maxLength={field.maxLength}
                        onChange={(event) =>
                          handleChange(key, event.target.value)
                        }
                      />
                    )}
                  </>
                )}
                <Text size="small" className="text-ui-fg-subtle">
                  {field.description}
                </Text>
              </div>
            );
          })}
        </div>
      ))}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Site content",
  icon: Newspaper,
});

export default SiteContentPage;
