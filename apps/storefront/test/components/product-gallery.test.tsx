import { fireEvent, render, screen } from "@testing-library/react";

import { ProductGallery } from "@/components";

const images = [
  { url: "https://example.com/1.png", alt: "Keychain, front" },
  { url: "https://example.com/2.png", alt: "Keychain, back" },
];

describe("ProductGallery", () => {
  it("shows the first image as the main image by default", () => {
    render(<ProductGallery images={images} productTitle="Keychain" />);

    expect(screen.getByAltText("Keychain, front")).toBeInTheDocument();
  });

  it("switches the main image when a thumbnail is activated", () => {
    render(<ProductGallery images={images} productTitle="Keychain" />);

    fireEvent.click(
      screen.getByRole("button", { name: /show image 2 of 2/i }),
    );

    expect(screen.getByAltText("Keychain, back")).toBeInTheDocument();
  });

  it("marks the selected thumbnail with aria-pressed, not colour alone (AC 7)", () => {
    render(<ProductGallery images={images} productTitle="Keychain" />);

    const first = screen.getByRole("button", { name: /show image 1 of 2/i });
    const second = screen.getByRole("button", { name: /show image 2 of 2/i });
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(second);

    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("renders no thumbnail row for a single image", () => {
    render(
      <ProductGallery images={[images[0]!]} productTitle="Keychain" />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders a placeholder rather than a broken image when there are none", () => {
    const { container } = render(
      <ProductGallery images={[]} productTitle="Keychain" />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});
