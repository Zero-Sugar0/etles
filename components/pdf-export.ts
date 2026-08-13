import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type PdfTheme =
  | "forest"
  | "ocean"
  | "plum"
  | "cobalt"
  | "terracotta"
  | "slate";

const themes: Record<PdfTheme, { ink: string; accent: string; wash: string }> =
  {
    forest: { ink: "173f3a", accent: "efb39f", wash: "e3efe8" },
    ocean: { ink: "174b63", accent: "63b4c7", wash: "e3f2f5" },
    plum: { ink: "4d315d", accent: "d69ac5", wash: "f3e6f2" },
    cobalt: { ink: "23457a", accent: "f0b35f", wash: "e8eef9" },
    terracotta: { ink: "703b32", accent: "e39a70", wash: "f8e9df" },
    slate: { ink: "293943", accent: "7aa4a8", wash: "e7eef0" },
  };

const hexRgb = (hex: string) => {
  const value = Number.parseInt(hex, 16);
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  );
};

function markdownLines(markdown: string) {
  return markdown.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) {
      return [{ text: "", kind: "space" }];
    }
    if (line.startsWith("### ")) {
      return [{ text: line.slice(4), kind: "h3" }];
    }
    if (line.startsWith("## ")) {
      return [{ text: line.slice(3), kind: "h2" }];
    }
    if (line.startsWith("# ")) {
      return [{ text: line.slice(2), kind: "h1" }];
    }
    if (/^[-*] /.test(line)) {
      return [{ text: `• ${line.slice(2)}`, kind: "bullet" }];
    }
    if (/^\d+\. /.test(line)) {
      return [{ text: line, kind: "bullet" }];
    }
    if (line.startsWith("> ")) {
      return [{ text: line.slice(2), kind: "quote" }];
    }
    return [{ text: line.replace(/[*_`~]/g, ""), kind: "body" }];
  });
}

export async function downloadPdfFromMarkdown(
  markdown: string,
  title: string,
  theme: PdfTheme = "forest"
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colors = themes[theme];
  const pageSize: [number, number] = [612, 792];
  const margin = 56;
  const contentWidth = pageSize[0] - margin * 2;
  const lines = markdownLines(markdown);
  let page = pdf.addPage(pageSize);
  let y = 735;
  let pageNumber = 1;

  const addPage = () => {
    page.drawLine({
      start: { x: margin, y: 42 },
      end: { x: pageSize[0] - margin, y: 42 },
      thickness: 0.6,
      color: hexRgb(colors.wash),
    });
    page.drawText(`${title}  ·  ${pageNumber}`, {
      x: pageSize[0] - margin - 120,
      y: 25,
      size: 8,
      font: regular,
      color: hexRgb("65746f"),
    });
    page = pdf.addPage(pageSize);
    pageNumber += 1;
    y = 735;
    page.drawRectangle({
      x: 0,
      y: 744,
      width: pageSize[0],
      height: 48,
      color: hexRgb(colors.ink),
    });
    page.drawText(title.slice(0, 72), {
      x: margin,
      y: 762,
      size: 10,
      font: bold,
      color: rgb(1, 1, 1),
    });
  };

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageSize[0],
    height: pageSize[1],
    color: rgb(1, 0.99, 0.97),
  });
  page.drawRectangle({
    x: 0,
    y: 744,
    width: pageSize[0],
    height: 48,
    color: hexRgb(colors.ink),
  });
  page.drawText(title.slice(0, 72), {
    x: margin,
    y: 762,
    size: 10,
    font: bold,
    color: rgb(1, 1, 1),
  });

  for (const line of lines) {
    const size =
      line.kind === "h1"
        ? 22
        : line.kind === "h2"
          ? 16
          : line.kind === "h3"
            ? 12
            : 10.5;
    const lineHeight =
      line.kind === "space"
        ? 9
        : line.kind === "h1"
          ? 30
          : line.kind === "h2"
            ? 23
            : 17;
    const font = line.kind.startsWith("h") ? bold : regular;
    const color =
      line.kind === "quote"
        ? hexRgb(colors.accent)
        : line.kind.startsWith("h")
          ? hexRgb(colors.ink)
          : hexRgb("344640");
    const words = line.text.split(/\s+/);
    let current = "";
    const wrapped: string[] = [];
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (
        font.widthOfTextAtSize(next, size) >
          contentWidth - (line.kind === "bullet" ? 14 : 0) &&
        current
      ) {
        wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      wrapped.push(current);
    }
    if (line.kind === "space") {
      y -= lineHeight;
      continue;
    }
    for (const chunk of wrapped) {
      if (y < 65) {
        addPage();
      }
      if (line.kind === "quote") {
        page.drawRectangle({
          x: margin - 12,
          y: y - 3,
          width: 3,
          height: lineHeight - 2,
          color: hexRgb(colors.accent),
        });
      }
      page.drawText(chunk, {
        x: margin + (line.kind === "bullet" ? 8 : 0),
        y,
        size,
        font,
        color,
      });
      y -= lineHeight;
    }
    y -= line.kind.startsWith("h") ? 7 : 2;
  }
  page.drawLine({
    start: { x: margin, y: 42 },
    end: { x: pageSize[0] - margin, y: 42 },
    thickness: 0.6,
    color: hexRgb(colors.wash),
  });
  page.drawText(`${title}  ·  ${pageNumber}`, {
    x: pageSize[0] - margin - 120,
    y: 25,
    size: 8,
    font: regular,
    color: hexRgb("65746f"),
  });
  const bytes = await pdf.save();
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "document"}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const pdfThemes = Object.keys(themes) as PdfTheme[];
export const pdfThemeLabels: Record<PdfTheme, string> = {
  forest: "Forest",
  ocean: "Ocean",
  plum: "Plum",
  cobalt: "Cobalt",
  terracotta: "Terracotta",
  slate: "Slate",
};
export const pdfThemeColors = themes;
