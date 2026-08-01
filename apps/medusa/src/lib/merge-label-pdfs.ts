import { PDFDocument } from "pdf-lib";

export const LABEL_PAGE_PT = { width: 288, height: 432 } as const;

const SIZE_TOLERANCE_PT = 1;

function matchesLabelPage(width: number, height: number): boolean {
  return (
    Math.abs(width - LABEL_PAGE_PT.width) <= SIZE_TOLERANCE_PT &&
    Math.abs(height - LABEL_PAGE_PT.height) <= SIZE_TOLERANCE_PT
  );
}

export async function mergeLabelPdfs(
  sources: readonly Uint8Array[],
): Promise<Buffer> {
  const merged = await PDFDocument.create();

  for (const source of sources) {
    const document = await PDFDocument.load(source);
    const indices = document.getPageIndices();

    for (const index of indices) {
      const sourcePage = document.getPage(index);
      const { width, height } = sourcePage.getSize();

      if (matchesLabelPage(width, height)) {
        const [copied] = await merged.copyPages(document, [index]);
        if (copied) merged.addPage(copied);
        continue;
      }

      const embedded = await merged.embedPage(sourcePage);
      const scale = Math.min(
        LABEL_PAGE_PT.width / width,
        LABEL_PAGE_PT.height / height,
      );

      const page = merged.addPage([LABEL_PAGE_PT.width, LABEL_PAGE_PT.height]);
      page.drawPage(embedded, {
        xScale: scale,
        yScale: scale,
        x: (LABEL_PAGE_PT.width - width * scale) / 2,
        y: (LABEL_PAGE_PT.height - height * scale) / 2,
      });
    }
  }

  return Buffer.from(await merged.save());
}
