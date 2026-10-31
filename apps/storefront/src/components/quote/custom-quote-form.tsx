"use client";

import { useRef, useState } from "react";
import {
  CUSTOM_QUOTE_FIELD_LIMITS,
  customQuoteFieldErrors,
  type CustomQuoteField,
} from "@craftynp/types";

import {
  CUSTOM_QUOTE_FIELD_ORDER,
  EMPTY_CUSTOM_QUOTE,
  submitCustomQuote,
  type CustomQuoteFailure,
  type CustomQuoteValues,
} from "@/lib/custom-quote";

import { Button, TextInput, Textarea } from "../ui";

export type CustomQuoteFormProps = {
  contactEmail: string;
  submit?: typeof submitCustomQuote;
};

const FAILURE_COPY: Record<CustomQuoteFailure, string> = {
  rate_limited:
    "That's a lot of requests in a short time. Please wait a minute and try again.",
  unavailable: "We couldn't send your request just now. Please try again.",
};

export function CustomQuoteForm({
  contactEmail,
  submit = submitCustomQuote,
}: CustomQuoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<CustomQuoteValues>(EMPTY_CUSTOM_QUOTE);
  const [company, setCompany] = useState("");
  const [hasAttempted, setHasAttempted] = useState(false);
  const [isSending, setSending] = useState(false);
  const [failure, setFailure] = useState<CustomQuoteFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const errors = hasAttempted
    ? customQuoteFieldErrors({ ...values, company })
    : {};

  function update(field: CustomQuoteField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;
    setHasAttempted(true);
    setFailure(null);

    const nextErrors = customQuoteFieldErrors({ ...values, company });
    const firstInvalid = CUSTOM_QUOTE_FIELD_ORDER.find(
      (field) => nextErrors[field],
    );
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus();
      return;
    }

    setSending(true);
    const result = await submit({ ...values, company });
    setSending(false);

    if (!result.ok) {
      setFailure(result.reason);
      return;
    }

    setSentTo(values.email.trim());
    requestAnimationFrame(() => confirmationRef.current?.focus());
  }

  function startAnother() {
    setValues(EMPTY_CUSTOM_QUOTE);
    setHasAttempted(false);
    setSentTo(null);
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <h2
          ref={confirmationRef}
          tabIndex={-1}
          className="font-display text-2xl text-foreground focus:outline-none"
        >
          Thanks — your request is on its way
        </h2>
        <p className="text-foreground-muted">
          We&apos;ll look over the details and reply to{" "}
          <span className="font-semibold text-foreground">{sentTo}</span> with a
          quote. If anything changes in the meantime, just reply to that email.
        </p>
        <Button variant="secondary" onPress={startAnother}>
          Request another quote
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-describedby="custom-quote-required-note"
      className="space-y-5"
    >
      <p
        id="custom-quote-required-note"
        className="text-sm text-foreground-muted"
      >
        Every field is required except the date needed.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Your name"
          name="name"
          autoComplete="name"
          isRequired
          value={values.name}
          onChange={(value) => update("name", value)}
          isInvalid={Boolean(errors.name)}
          errorMessage={errors.name}
        />
        <TextInput
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          isRequired
          value={values.phone}
          onChange={(value) => update("phone", value)}
          isInvalid={Boolean(errors.phone)}
          errorMessage={errors.phone}
        />
        <TextInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          isRequired
          value={values.email}
          onChange={(value) => update("email", value)}
          isInvalid={Boolean(errors.email)}
          errorMessage={errors.email}
        />
        <TextInput
          label="Date needed"
          name="neededBy"
          type="date"
          description="Leave blank if there's no deadline."
          value={values.neededBy}
          onChange={(value) => update("neededBy", value)}
          isInvalid={Boolean(errors.neededBy)}
          errorMessage={errors.neededBy}
        />
      </div>

      <TextInput
        label="Product"
        name="product"
        placeholder="e.g. acrylic sign, banner, stickers"
        isRequired
        value={values.product}
        onChange={(value) => update("product", value)}
        isInvalid={Boolean(errors.product)}
        errorMessage={errors.product}
      />

      <Textarea
        label="Description"
        name="description"
        rows={6}
        description={`Sizes, quantities, colours, wording — anything that helps us price it. Up to ${CUSTOM_QUOTE_FIELD_LIMITS.description} characters.`}
        isRequired
        value={values.description}
        onChange={(value) => update("description", value)}
        isInvalid={Boolean(errors.description)}
        errorMessage={errors.description}
      />

      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Company
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </label>
      </div>

      {failure ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {FAILURE_COPY[failure]} You can also email us at{" "}
          <a href={`mailto:${contactEmail}`} className="underline">
            {contactEmail}
          </a>
          .
        </p>
      ) : null}

      <Button type="submit" isLoading={isSending} loadingLabel="Sending">
        Send request
      </Button>
    </form>
  );
}
