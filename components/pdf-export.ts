import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type PdfTheme =
  | "forest"
  | "ocean"
  | "plum"
  | "cobalt"
  | "terracotta"
  | "slate";

export type PdfColors = { ink: string; accent: string; wash: string; paper: string; body: string; muted: string };

const themes: Record<PdfTheme, PdfColors> =
  {
    forest: { ink: "173f3a", accent: "efb39f", wash: "e3efe8", paper: "fffdf8", body: "29423c", muted: "66756e" },
    ocean: { ink: "174b63", accent: "63b4c7", wash: "e3f2f5", paper: "fafdff", body: "244455", muted: "617b88" },
    plum: { ink: "4d315d", accent: "d69ac5", wash: "f3e6f2", paper: "fffbff", body: "493950", muted: "786a7c" },
    cobalt: { ink: "23457a", accent: "f0b35f", wash: "e8eef9", paper: "fbfdff", body: "2f4260", muted: "687991" },
    terracotta: { ink: "703b32", accent: "e39a70", wash: "f8e9df", paper: "fffaf7", body: "543b34", muted: "826c63" },
    slate: { ink: "293943", accent: "7aa4a8", wash: "e7eef0", paper: "fbfcfc", body: "34464e", muted: "6e7d82" },
  };

const hexRgb = (hex: string) => {
  const value = Number.parseInt(hex, 16);
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  );
};

type PdfLine = {
  text: string;
  kind: "space" | "h1" | "h2" | "h3" | "bullet" | "quote" | "image" | "table" | "chart" | "body";
  url?: string;
  cells?: string[];
  header?: boolean;
  chart?: { title?: string; labels: string[]; values: number[] };
};

function parseChartBlock(source: string) {
  try {
    const parsed = JSON.parse(source) as { title?: string; labels?: unknown[]; series?: { name?: string; data?: unknown[] }[] };
    const values = parsed.series?.[0]?.data?.map(Number).filter(Number.isFinite) ?? [];
    if (values.length && parsed.labels?.length) return { title: parsed.title, labels: parsed.labels.map(String), values };
  } catch {
    const list = (key: string) => source.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*\\[([^\\]]*)\\]`, "i"))?.[1].split(",").map((value) => value.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean) ?? [];
    const title = source.match(/(?:^|\n)\s*title\s*:\s*(.+)/i)?.[1]?.trim();
    const labels = list("labels").length ? list("labels") : list("x_axis");
    const values = list("data").map(Number).filter(Number.isFinite);
    if (labels.length && values.length) return { title, labels, values };
  }
  return null;
}

export function resolvePdfColors(markdown: string, theme: PdfTheme = "forest"): PdfColors {
  const base = themes[theme] ?? themes.forest;
  const match = markdown.match(/<!--\s*pdf-theme:\s*(\{[\s\S]*?\})\s*-->/i);
  if (!match) return base;
  try {
    const candidate = JSON.parse(match[1]) as Partial<PdfColors>;
    const valid = (value: unknown, fallback: string) => typeof value === "string" && /^[0-9a-f]{6}$/i.test(value) ? value : fallback;
    return {
      ink: valid(candidate.ink, base.ink),
      accent: valid(candidate.accent, base.accent),
      wash: valid(candidate.wash, base.wash),
      paper: valid(candidate.paper, base.paper),
      body: valid(candidate.body, base.body),
      muted: valid(candidate.muted, base.muted),
    };
  } catch {
    return base;
  }
}

function markdownLines(markdown: string): PdfLine[] {
  const source = markdown.split(/\r?\n/);
  const output: PdfLine[] = [];
  const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  for (let index = 0; index < source.length; index += 1) {
    const line = source[index];
    if (/^\s*```(?:[a-z0-9_-]+)?\s*$/i.test(line)) {
      const chartLines: string[] = [];
      index += 1;
      while (index < source.length && !/^\s*```\s*$/.test(source[index])) chartLines.push(source[index++]);
      const chart = parseChartBlock(chartLines.join("\n"));
      if (chart) {
        output.push({ text: "", kind: "chart", chart });
      } else {
        output.push(...chartLines.map((text) => ({ text, kind: "body" as const })));
      }
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line) && /^\s*\|?\s*:?-{3,}/.test(source[index + 1] ?? "")) {
      output.push({ text: "", kind: "table", cells: tableCells(line), header: true });
      index += 2;
      while (index < source.length && /^\s*\|.+\|\s*$/.test(source[index])) {
        output.push({ text: "", kind: "table", cells: tableCells(source[index]) });
        index += 1;
      }
      index -= 1;
      continue;
    }
    const parsed: PdfLine[] = (() => {
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
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      return [{ text: imageMatch[1] || "Document image", kind: "image", url: imageMatch[2] }];
    }
    return [{ text: line.replace(/[*_`~]/g, ""), kind: "body" }];
    })();
    output.push(...parsed);
  }
  return output;
}

export async function downloadPdfFromMarkdown(
  markdown: string,
  title: string,
  theme: PdfTheme = "forest"
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colors = resolvePdfColors(markdown, theme);
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
      color: hexRgb(colors.muted),
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
    color: hexRgb(colors.paper),
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
  page.drawText(title.slice(0, 64), {
    x: margin,
    y: 690,
    size: 26,
    font: bold,
    color: hexRgb(colors.ink),
    maxWidth: contentWidth,
  });
  page.drawLine({
    start: { x: margin, y: 672 },
    end: { x: margin + 110, y: 672 },
    thickness: 3,
    color: hexRgb(colors.accent),
  });
  page.drawText("Prepared by Etles · Print-ready document", {
    x: margin,
    y: 650,
    size: 9,
    font: regular,
    color: hexRgb(colors.muted),
  });
  y = 615;

  for (const line of lines) {
    if (line.kind === "chart" && line.chart) {
      const chart = line.chart;
      const chartHeight = 170;
      const chartTop = y;
      if (y - chartHeight < 65) addPage();
      const chartWidth = contentWidth;
      const max = Math.max(...chart.values, 1);
      page.drawText(chart.title ?? "Chart", { x: margin, y: y - 14, size: 11, font: bold, color: hexRgb(colors.ink) });
      const plotTop = y - 30;
      const plotBottom = plotTop - 105;
      page.drawLine({ start: { x: margin, y: plotBottom }, end: { x: margin + chartWidth, y: plotBottom }, thickness: 0.7, color: hexRgb(colors.wash) });
      const step = chart.values.length > 1 ? chartWidth / (chart.values.length - 1) : chartWidth;
      const points = chart.values.map((value, index) => ({ x: margin + index * step, y: plotBottom + (value / max) * 90 }));
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        page.drawLine({ start: points[pointIndex - 1], end: points[pointIndex], thickness: 2, color: hexRgb(colors.accent) });
      }
      points.forEach((point, pointIndex) => {
        page.drawCircle({ x: point.x, y: point.y, size: 3, color: hexRgb(colors.accent) });
        page.drawText(chart.labels[pointIndex]?.slice(0, 16) ?? "", { x: point.x - 18, y: plotBottom - 16, size: 7, font: regular, color: hexRgb(colors.muted), maxWidth: 40 });
      });
      y = chartTop - chartHeight;
      continue;
    }
    if (line.kind === "table" && line.cells?.length) {
      const rowHeight = 24;
      if (y - rowHeight < 65) addPage();
      const columnWidth = contentWidth / line.cells.length;
      line.cells.forEach((cell, cellIndex) => {
        const x = margin + cellIndex * columnWidth;
        page.drawRectangle({
          x,
          y: y - rowHeight,
          width: columnWidth,
          height: rowHeight,
          color: line.header ? hexRgb(colors.wash) : hexRgb(colors.paper),
          borderColor: hexRgb(colors.wash),
          borderWidth: 0.6,
        });
        const font = line.header ? bold : regular;
        const value = cell.length > 42 ? `${cell.slice(0, 39)}...` : cell;
        page.drawText(value, {
          x: x + 5,
          y: y - 16,
          size: 8.5,
          font,
          color: hexRgb(line.header ? colors.ink : colors.body),
          maxWidth: Math.max(10, columnWidth - 10),
        });
      });
      y -= rowHeight;
      continue;
    }
    if (line.kind === "image" && line.url) {
      try {
        const response = await fetch(line.url);
        if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
        const imageBytes = new Uint8Array(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") ?? "image/png";
        const image = contentType.includes("jpeg") || contentType.includes("jpg")
          ? await pdf.embedJpg(imageBytes)
          : await pdf.embedPng(imageBytes);
        const dimensions = image.scale(1);
        const maxWidth = contentWidth;
        const maxHeight = 240;
        const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1);
        const width = dimensions.width * scale;
        const height = dimensions.height * scale;
        if (y - height < 65) addPage();
        page.drawImage(image, { x: margin, y: y - height, width, height });
        y -= height + 14;
        continue;
      } catch {
        line.text = `${line.text} (image unavailable)`;
      }
    }
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
          : hexRgb(colors.body);
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
    color: hexRgb(colors.muted),
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
