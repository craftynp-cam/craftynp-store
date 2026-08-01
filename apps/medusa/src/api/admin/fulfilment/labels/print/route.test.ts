import { PDFDocument } from "pdf-lib";
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { PrintLabelsRequest } from "@craftynp/types";

import { LABEL_PAGE_PT } from "../../../../../lib/merge-label-pdfs";
import { LABELS_UNAVAILABLE_HEADER, POST } from "./route";

const activeShipment = jest.fn();
const getAsBuffer = jest.fn();

jest.mock("../../../../../modules/order-status", () => ({
  ORDER_STATUS_MODULE: "orderStatus",
}));

async function labelPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const page = document.addPage([LABEL_PAGE_PT.width, LABEL_PAGE_PT.height]);
  page.drawRectangle({ x: 8, y: 8, width: 32, height: 16 });
  return Buffer.from(await document.save());
}

function makeRequest(orderIds: string[]) {
  const logger = { warn: jest.fn(), error: jest.fn() };

  const req = {
    validatedBody: { orderIds } satisfies PrintLabelsRequest,
    scope: {
      resolve: (key: string) => {
        if (key === "orderStatus") return { activeShipment };
        if (key === "file") return { getAsBuffer };
        return logger;
      },
    },
  } as unknown as AuthenticatedMedusaRequest<PrintLabelsRequest>;

  const send = jest.fn();
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res = { send, json, status, setHeader } as unknown as MedusaResponse;

  return { req, res, send, json, status, setHeader, logger };
}

async function pageCount(buffer: Buffer): Promise<number> {
  return (await PDFDocument.load(buffer)).getPageCount();
}

describe("POST /admin/fulfilment/labels/print", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("merges the selected orders into one print job", async () => {
    const pdf = await labelPdf();
    activeShipment.mockResolvedValue({ label_file_id: "file_1" });
    getAsBuffer.mockResolvedValue(pdf);

    const { req, res, send } = makeRequest(["order_1", "order_2"]);
    await POST(req, res);

    expect(send).toHaveBeenCalledTimes(1);
    expect(await pageCount(send.mock.calls[0]?.[0] as Buffer)).toBe(2);
  });

  it("still prints what it can and names the orders it could not", async () => {
    const pdf = await labelPdf();
    activeShipment.mockImplementation(async (orderId: string) =>
      orderId === "order_2" ? null : { label_file_id: "file_1" },
    );
    getAsBuffer.mockResolvedValue(pdf);

    const { req, res, send, setHeader } = makeRequest([
      "order_1",
      "order_2",
      "order_3",
    ]);
    await POST(req, res);

    expect(await pageCount(send.mock.calls[0]?.[0] as Buffer)).toBe(2);
    expect(setHeader).toHaveBeenCalledWith(
      LABELS_UNAVAILABLE_HEADER,
      "order_2",
    );
  });

  it("refuses with a plain message when nothing has a label yet", async () => {
    activeShipment.mockResolvedValue(null);

    const { req, res, status, json } = makeRequest(["order_1"]);
    await POST(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "no_labels" }),
    );
  });
});
