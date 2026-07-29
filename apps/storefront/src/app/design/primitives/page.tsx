"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Checkbox,
  RadioGroup,
  Select,
  Textarea,
  TextInput,
  ThemeToggle,
} from "@/components";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-foreground-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-5 last:border-b-0">
      <p className="text-sm font-medium text-foreground-muted">{label}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-5 last:border-b-0">
      <p className="text-sm font-medium text-foreground-muted">{label}</p>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

const sizeOptions = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
  { id: "bespoke", label: "Bespoke (enquire)", isDisabled: true },
];

const deliveryOptions = [
  { value: "standard", label: "Standard (3–5 days)" },
  { value: "express", label: "Express (next day)" },
  { value: "collection", label: "Collect in person", isDisabled: true },
];

export default function PrimitivesPage() {
  const [giftWrap, setGiftWrap] = useState(false);
  const [delivery, setDelivery] = useState("standard");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-6 py-16"
    >
      <h1 className="font-display text-4xl">UI primitives</h1>
      <p className="mt-4 max-w-2xl text-lg text-foreground-muted">
        The shared form and layout components screens are assembled from. Built
        on HeroUI, coloured entirely by the tokens on the{" "}
        <Link href="/design/tokens" className="underline underline-offset-4">
          design tokens
        </Link>{" "}
        page — no component here declares a colour of its own.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ThemeToggle />
        <p className="text-sm text-foreground-muted">
          Tab through the page to check focus rings. Every state below is
          readable without relying on colour.
        </p>
      </div>

      <Section
        title="Button"
        description="Three variants and three sizes. Loading keeps the button focusable and announces itself; disabled does not."
      >
        <Row label="Variants">
          <Button variant="primary">Add to basket</Button>
          <Button variant="secondary">Save for later</Button>
          <Button variant="ghost">Cancel</Button>
        </Row>
        <Row label="Sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
        <Row label="Disabled">
          <Button variant="primary" isDisabled>
            Add to basket
          </Button>
          <Button variant="secondary" isDisabled>
            Save for later
          </Button>
          <Button variant="ghost" isDisabled>
            Cancel
          </Button>
        </Row>
        <Row label="Loading">
          <Button variant="primary" isLoading loadingLabel="Adding">
            Add to basket
          </Button>
          <Button variant="secondary" isLoading>
            Save for later
          </Button>
        </Row>
        <Row label="Full width">
          <div className="w-full">
            <Button fullWidth>Checkout</Button>
          </div>
        </Row>
      </Section>

      <Section
        title="Text input"
        description="Label, helper text and error text are wired to the control with aria-describedby; invalid sets aria-invalid."
      >
        <FieldRow label="States">
          <TextInput label="Recipient name" placeholder="Jane Doe" />
          <TextInput
            label="Recipient name"
            placeholder="Jane Doe"
            description="Appears on the gift tag."
          />
          <TextInput
            label="Recipient name"
            defaultValue="J"
            errorMessage="Enter the full name as it should appear."
            isInvalid
          />
          <TextInput
            label="Recipient name"
            defaultValue="Jane Doe"
            isDisabled
            description="Locked once the order is placed."
          />
        </FieldRow>
      </Section>

      <Section
        title="Textarea"
        description="The same field wiring, sized for longer copy."
      >
        <FieldRow label="States">
          <Textarea
            label="Personalisation"
            placeholder="Happy birthday, Jane!"
            description="Up to 120 characters."
          />
          <Textarea
            label="Personalisation"
            defaultValue="A very long message that will not fit on the tag"
            errorMessage="Shorten this to 120 characters or fewer."
            isInvalid
          />
        </FieldRow>
      </Section>

      <Section
        title="Select"
        description="A listbox rather than a native menu, so the options can be styled and disabled individually."
      >
        <FieldRow label="States">
          <Select
            label="Size"
            options={sizeOptions}
            description="Measured flat."
          />
          <Select
            label="Size"
            options={sizeOptions}
            defaultSelectedKey="medium"
          />
          <Select
            label="Size"
            options={sizeOptions}
            errorMessage="Choose a size."
            isInvalid
          />
          <Select label="Size" options={sizeOptions} isDisabled />
        </FieldRow>
      </Section>

      <Section
        title="Checkbox"
        description="Disabled and checked states are carried by the native control, not only by the tick's colour."
      >
        <Row label="States">
          <Checkbox isSelected={giftWrap} onChange={setGiftWrap}>
            Gift wrap this order
          </Checkbox>
          <Checkbox defaultSelected>Send me a dispatch email</Checkbox>
          <Checkbox isDisabled>Collect in person</Checkbox>
          <Checkbox isDisabled defaultSelected>
            Included with every order
          </Checkbox>
        </Row>
      </Section>

      <Section
        title="Radio group"
        description="The group owns the label, helper and error text, so a screen reader hears the description once rather than per option."
      >
        <FieldRow label="States">
          <RadioGroup
            label="Delivery"
            options={deliveryOptions}
            value={delivery}
            onChange={setDelivery}
            description="Posted within two working days."
          />
          <RadioGroup
            label="Delivery"
            options={deliveryOptions}
            errorMessage="Choose a delivery method."
            isInvalid
          />
        </FieldRow>
      </Section>

      <Section
        title="Badge"
        description="A standalone status pill. Tones map onto the semantic tokens, so each one follows the mode."
      >
        <Row label="Tones">
          <Badge>Made to order</Badge>
          <Badge tone="accent">Bestseller</Badge>
          <Badge tone="success">In stock</Badge>
          <Badge tone="danger">Sold out</Badge>
        </Row>
        <Row label="Sizes">
          <Badge size="sm">Small</Badge>
          <Badge size="md">Medium</Badge>
          <Badge size="lg">Large</Badge>
        </Row>
      </Section>

      <Section
        title="In context"
        description="The primitives assembled the way a real form uses them, at the width they will actually appear."
      >
        <form
          className="max-w-md rounded-lg border border-border bg-surface p-6"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl">Personalise your order</h3>
            <Badge tone="accent">Bestseller</Badge>
          </div>
          <div className="mt-5 grid gap-5">
            <TextInput label="Recipient name" placeholder="Jane Doe" />
            <Select
              label="Size"
              options={sizeOptions}
              defaultSelectedKey="medium"
            />
            <Textarea
              label="Personalisation"
              placeholder="Happy birthday, Jane!"
              description="Up to 120 characters."
            />
            <RadioGroup
              label="Delivery"
              options={deliveryOptions}
              value={delivery}
              onChange={setDelivery}
            />
            <Checkbox isSelected={giftWrap} onChange={setGiftWrap}>
              Gift wrap this order
            </Checkbox>
            <Button type="submit" fullWidth>
              Add to basket
            </Button>
          </div>
        </form>
      </Section>
    </main>
  );
}
