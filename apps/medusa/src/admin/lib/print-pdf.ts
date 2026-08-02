import { sdk } from "./client";

export type PdfRequest = {
  path: string;
  method?: string;
  body?: Record<string, unknown>;
};

export async function fetchPdf(request: PdfRequest): Promise<Response> {
  return sdk.client.fetch<Response>(request.path, {
    method: request.method ?? "GET",
    headers: { accept: "application/pdf" },
    ...(request.body ? { body: request.body } : {}),
  });
}

function printBlobUrl(url: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;

  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  document.body.appendChild(frame);
}

export async function printPdf(request: PdfRequest): Promise<Response> {
  const response = await fetchPdf(request);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  printBlobUrl(url);

  return response;
}
