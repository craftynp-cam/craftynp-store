import { PDFDocument } from "pdf-lib";

import { LABEL_PAGE_PT, mergeLabelPdfs } from "./merge-label-pdfs.js";

async function makePdf(
  pages: Array<{ width: number; height: number }>,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (const size of pages) {
    const page = document.addPage([size.width, size.height]);
    page.drawRectangle({ x: 8, y: 8, width: 32, height: 16 });
  }
  return document.save();
}

const LABEL_PAGE = { width: LABEL_PAGE_PT.width, height: LABEL_PAGE_PT.height };
const US_LETTER = { width: 612, height: 792 };

async function pageSizes(bytes: Buffer) {
  const document = await PDFDocument.load(bytes);
  return document.getPages().map((page) => page.getSize());
}

describe("mergeLabelPdfs", () => {
  it("puts every source label into one document, in order", async () => {
    const merged = await mergeLabelPdfs([
      await makePdf([LABEL_PAGE]),
      await makePdf([LABEL_PAGE]),
      await makePdf([LABEL_PAGE]),
    ]);

    expect(await pageSizes(merged)).toHaveLength(3);
  });

  it("keeps a multi-page source's pages", async () => {
    const merged = await mergeLabelPdfs([
      await makePdf([LABEL_PAGE, LABEL_PAGE]),
    ]);

    expect(await pageSizes(merged)).toHaveLength(2);
  });

  it("leaves a page that is already 4x6 at exactly 4x6", async () => {
    const merged = await mergeLabelPdfs([await makePdf([LABEL_PAGE])]);
    const [size] = await pageSizes(merged);

    expect(size?.width).toBeCloseTo(288, 1);
    expect(size?.height).toBeCloseTo(432, 1);
  });

  it("rescales a letter-sized page onto 4x6 rather than passing it through", async () => {
    const merged = await mergeLabelPdfs([await makePdf([US_LETTER])]);
    const [size] = await pageSizes(merged);

    expect(size?.width).toBeCloseTo(288, 1);
    expect(size?.height).toBeCloseTo(432, 1);
  });

  it("never emits a page that is not 4x6, whatever the carrier sent", async () => {
    const merged = await mergeLabelPdfs([
      await makePdf([LABEL_PAGE]),
      await makePdf([US_LETTER]),
      await makePdf([{ width: 400, height: 400 }]),
    ]);

    for (const size of await pageSizes(merged)) {
      expect(size.width).toBeCloseTo(288, 1);
      expect(size.height).toBeCloseTo(432, 1);
    }
  });
});
