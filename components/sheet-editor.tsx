"use client";

import { useTheme } from "next-themes";
import { parse, unparse } from "papaparse";
import { type CSSProperties, memo, useEffect, useMemo, useState } from "react";
import DataGrid, { type Column, textEditor } from "react-data-grid";
import {
  isSheetData,
  type SheetData,
  type SheetStyle,
  type SheetTheme,
} from "@/lib/ai/tools/sheet-types";
import { cn } from "@/lib/utils";

import "react-data-grid/lib/styles.css";

type SheetEditorProps = {
  content: string;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  status: string;
};

const MIN_ROWS = 50;
const MIN_COLS = 26;

type SheetPalette = {
  canvas: string;
  panel: string;
  header: string;
  headerText: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
};

const SYSTEM_PALETTE: SheetPalette = {
  canvas: "hsl(var(--background))",
  panel: "hsl(var(--muted))",
  header: "hsl(var(--primary))",
  headerText: "hsl(var(--primary-foreground))",
  ink: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  line: "hsl(var(--border))",
  accent: "hsl(var(--accent))",
};

const SHEET_PALETTES: Record<Exclude<SheetTheme, "system">, SheetPalette> = {
  editorial: {
    canvas: "#fbfaf7",
    panel: "#f0ede5",
    header: "#123b3a",
    headerText: "#ffffff",
    ink: "#183231",
    muted: "#647572",
    line: "#c8d2ce",
    accent: "#e27d60",
  },
  ocean: {
    canvas: "#f5fbff",
    panel: "#e5f1f8",
    header: "#075985",
    headerText: "#ffffff",
    ink: "#12324a",
    muted: "#55758b",
    line: "#b8d4e4",
    accent: "#0e7490",
  },
  forest: {
    canvas: "#f7fbf7",
    panel: "#e4f0e5",
    header: "#166534",
    headerText: "#ffffff",
    ink: "#173b25",
    muted: "#5d7863",
    line: "#bfd5c2",
    accent: "#ca8a04",
  },
  sunset: {
    canvas: "#fffaf7",
    panel: "#fbe9df",
    header: "#9a3412",
    headerText: "#ffffff",
    ink: "#4a2419",
    muted: "#8a6255",
    line: "#ebc7b7",
    accent: "#c2410c",
  },
  lavender: {
    canvas: "#fbfaff",
    panel: "#eeeafd",
    header: "#5b21b6",
    headerText: "#ffffff",
    ink: "#302451",
    muted: "#72678e",
    line: "#d5c9ef",
    accent: "#be185d",
  },
  midnight: {
    canvas: "#17202b",
    panel: "#202c3a",
    header: "#0f172a",
    headerText: "#f8fafc",
    ink: "#e5edf5",
    muted: "#9fb0c0",
    line: "#405164",
    accent: "#38bdf8",
  },
};

function getSheetPalette(theme?: SheetTheme): SheetPalette {
  return theme && theme !== "system" ? SHEET_PALETTES[theme] : SYSTEM_PALETTE;
}

function getContrastColor(background: string, fallback: string): string {
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return fallback;
  }
  const [r, g, b] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  );
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#17202b" : "#ffffff";
}

function getReadableCellStyle(
  style: SheetStyle[string] | undefined,
  isHeader: boolean,
  palette: SheetPalette
) {
  const candidate = style;
  const backgroundColor =
    candidate?.backgroundColor || (isHeader ? palette.header : palette.canvas);
  return {
    backgroundColor,
    color: candidate?.color || getContrastColor(backgroundColor, palette.ink),
    bold: candidate?.bold ?? isHeader,
    textAlign: candidate?.textAlign || (isHeader ? "center" : "left"),
  };
}

type SheetRow = {
  id: number;
  rowNumber: number;
  [key: string]: string | number;
};

function colLettersToIndex(col: string): number {
  let result = 0;
  for (const ch of col.toUpperCase()) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result - 1;
}

function evaluateFormula(
  formula: string,
  getValue: (rowIdx: number, colIdx: number) => number
): number | string {
  const expression = formula.trim().replace(/^=/, "");
  const sumMatch = expression.match(
    /^SUM\(\s*([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)\s*\)$/i
  );
  if (sumMatch) {
    const startCol = colLettersToIndex(sumMatch[1]);
    const startRow = Number(sumMatch[2]) - 1;
    const endCol = colLettersToIndex(sumMatch[3]);
    const endRow = Number(sumMatch[4]) - 1;
    let total = 0;
    for (
      let r = Math.min(startRow, endRow);
      r <= Math.max(startRow, endRow);
      r++
    ) {
      for (
        let c = Math.min(startCol, endCol);
        c <= Math.max(startCol, endCol);
        c++
      ) {
        total += getValue(r, c);
      }
    }
    return total;
  }

  const replaced = expression.replace(/([A-Z]+)(\d+)/gi, (_, col, row) => {
    const colIdx = colLettersToIndex(col);
    const rowIdx = Number(row) - 1;
    return String(getValue(rowIdx, colIdx));
  });
  if (!/^[0-9+\-*/().\s]+$/.test(replaced)) {
    return "#ERR";
  }
  try {
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${replaced});`)();
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return "#ERR";
  } catch {
    return "#ERR";
  }
}

function indexToCoordinate(rowIdx: number, colIdx: number): string {
  const col = String.fromCharCode(65 + colIdx);
  const row = rowIdx + 1;
  return `${col}${row}`;
}

const PureSpreadsheetEditor = ({
  content,
  saveContent,
  status,
}: SheetEditorProps) => {
  // 1. Parse JSON or CSV
  const sheetData = useMemo<SheetData>(() => {
    try {
      const parsed = JSON.parse(content);
      if (isSheetData(parsed)) {
        return parsed;
      }
    } catch {
      // Streamed JSON may be incomplete while the artifact is still updating.
    }

    // Fallback for plain CSV or streaming JSON that hasn't closed yet
    if (content.trim().startsWith("{")) {
      try {
        // Simple heuristic for partial JSON
        const matchTitle = content.match(/"title":\s*"([^"]+)"/);
        const matchSheets = content.match(/"sheets":\s*\[/);
        if (matchTitle || matchSheets) {
          return {
            title: matchTitle ? matchTitle[1] : "New Spreadsheet",
            sheets: [{ name: "Sheet1", csv: "" }],
          };
        }
      } catch {
        // Fall back to the empty sheet while streamed JSON is incomplete.
      }
    }

    return {
      title: "New Spreadsheet",
      sheets: [{ name: "Sheet1", csv: content }],
    };
  }, [content]);

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const { resolvedTheme } = useTheme();

  // Reset active sheet if it's out of bounds
  useEffect(() => {
    if (activeSheetIndex >= sheetData.sheets.length) {
      setActiveSheetIndex(0);
    }
  }, [activeSheetIndex, sheetData.sheets.length]);

  const activeSheet = sheetData.sheets[activeSheetIndex];
  const activeCsv = activeSheet?.csv ?? "";
  const activeStyles = activeSheet?.styles ?? {};
  const palette = getSheetPalette(sheetData.theme);
  const isDarkTheme =
    sheetData.theme === "midnight" ||
    (sheetData.theme === "system" && resolvedTheme === "dark");

  const parseData = useMemo(() => {
    if (!activeCsv) {
      return new Array(MIN_ROWS).fill(new Array(MIN_COLS).fill(""));
    }
    const result = parse<string[]>(activeCsv, { skipEmptyLines: true });

    const paddedData = result.data.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < MIN_COLS) {
        paddedRow.push("");
      }
      return paddedRow;
    });

    while (paddedData.length < MIN_ROWS) {
      paddedData.push(new Array(MIN_COLS).fill(""));
    }

    return paddedData;
  }, [activeCsv]);

  const initialRows = useMemo<SheetRow[]>(() => {
    return parseData.map((row, rowIndex) => {
      const rowData: SheetRow = {
        id: rowIndex,
        rowNumber: rowIndex + 1,
      };

      for (let colIndex = 0; colIndex < MIN_COLS; colIndex++) {
        rowData[colIndex.toString()] = row[colIndex] || "";
      }

      return rowData;
    });
  }, [parseData]);

  const [localRows, setLocalRows] = useState<SheetRow[]>(initialRows);

  useEffect(() => {
    setLocalRows(initialRows);
  }, [initialRows]);

  const columns = useMemo<Column<SheetRow>[]>(() => {
    const getNumericCellValue = (rowIdx: number, colIdx: number): number => {
      const row = localRows[rowIdx];
      if (!row) {
        return 0;
      }
      const raw = row[colIdx.toString()];
      if (typeof raw === "number") {
        return raw;
      }
      if (typeof raw !== "string") {
        return 0;
      }
      if (raw.trim().startsWith("=")) {
        const computed = evaluateFormula(raw, getNumericCellValue);
        return typeof computed === "number" ? computed : 0;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const rowNumberColumn = {
      key: "rowNumber",
      name: "",
      frozen: true,
      width: 50,
      renderCell: ({ rowIdx }: { rowIdx: number }) => rowIdx + 1,
      cellClass:
        "border-t border-r text-muted-foreground text-xs flex items-center justify-center",
      headerCellClass: "border-t border-r",
    };

    const dataColumns = Array.from({ length: MIN_COLS }, (_, i) => ({
      key: i.toString(),
      name: String.fromCharCode(65 + i),
      renderEditCell: textEditor,
      renderCell: ({ row, rowIdx }: { row: SheetRow; rowIdx: number }) => {
        const value = row[i.toString()];
        const isHeader = row.rowNumber === 1;
        const coord = indexToCoordinate(rowIdx, i);
        const style = getReadableCellStyle(
          activeStyles[coord],
          isHeader,
          palette
        );

        const cellContent =
          typeof value === "string" && value.trim().startsWith("=")
            ? String(evaluateFormula(value, getNumericCellValue))
            : value;

        return (
          <div
            className={cn(
              "flex h-full w-full items-center overflow-hidden px-2 whitespace-nowrap text-ellipsis",
              {
                "font-bold": style.bold,
              }
            )}
            style={{
              backgroundColor: style.backgroundColor,
              color: style.color,
              textAlign: style.textAlign,
              justifyContent:
                style.textAlign === "center"
                  ? "center"
                  : style?.textAlign === "right"
                    ? "flex-end"
                    : "flex-start",
            }}
          >
            {cellContent}
          </div>
        );
      },
      width: Math.min(
        280,
        Math.max(
          120,
          ...localRows
            .slice(0, 40)
            .map((row) =>
              String(row[i.toString()] ?? "").length > 24 ? 220 : 120
            )
        )
      ),
      cellClass: "border-t border-l bg-transparent p-0",
      headerCellClass: "border-t border-l bg-transparent font-medium text-xs",
    }));

    return [rowNumberColumn, ...dataColumns];
  }, [activeStyles, localRows, palette]);

  const handleRowsChange = (newRows: SheetRow[]) => {
    setLocalRows(newRows);

    const updatedCsv = unparse(
      newRows.map((row) => {
        return columns
          .slice(1)
          .map((col) => String(row[col.key.toString()] ?? ""));
      })
    );

    const updatedSheetData = { ...sheetData };
    updatedSheetData.sheets[activeSheetIndex].csv = updatedCsv;

    saveContent(JSON.stringify(updatedSheetData, null, 2), true);
  };

  return (
    <div
      className="flex min-h-0 h-full flex-col"
      style={{
        backgroundColor: palette.canvas,
        color: palette.ink,
      }}
    >
      {/* Excel-style Title Bar */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4"
        style={{
          backgroundColor: palette.header,
          borderColor: palette.line,
          color: palette.headerText,
        }}
      >
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight sm:text-xl">
            {sheetData.title}
          </h2>
          {status === "streaming" && (
            <p className="mt-1 animate-pulse text-xs opacity-80">
              Building comprehensive workbook...
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs opacity-90">
          <span
            className="rounded-full border px-2.5 py-1 font-medium"
            style={{ borderColor: palette.line }}
          >
            Workbook view
          </span>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 min-h-0">
        <DataGrid
          className={cn(
            isDarkTheme ? "rdg-dark" : "rdg-light",
            "h-full border-none text-sm"
          )}
          columns={columns}
          defaultColumnOptions={{
            resizable: true,
            sortable: true,
          }}
          enableVirtualization
          headerRowHeight={36}
          onCellClick={(args) => {
            if (args.column.key !== "rowNumber") {
              args.selectCell(true);
            }
          }}
          onRowsChange={handleRowsChange}
          rowHeight={38}
          rows={localRows}
          style={
            {
              "--rdg-background-color": palette.canvas,
              "--rdg-header-background-color": palette.panel,
              "--rdg-color": palette.ink,
              "--rdg-border-color": palette.line,
              "--rdg-row-hover-background-color": palette.panel,
              height: "100%",
            } as CSSProperties
          }
        />
      </div>

      {/* Excel-style Tabs */}
      <div
        className="flex h-11 items-center gap-1 overflow-x-auto border-t px-3"
        style={{
          backgroundColor: palette.panel,
          borderColor: palette.line,
        }}
      >
        <div
          className="mr-4 flex h-full items-center border-r pr-4"
          style={{ borderColor: palette.line }}
        >
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            type="button"
          >
            <svg
              fill="none"
              height="12"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="12"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            type="button"
          >
            <svg
              fill="none"
              height="12"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="12"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        {sheetData.sheets.map((sheet, idx) => (
          <button
            className={cn(
              "flex h-full items-center border-t-2 px-4 text-xs font-medium transition-colors",
              activeSheetIndex === idx ? "font-semibold" : "opacity-70"
            )}
            key={sheet.name}
            onClick={() => setActiveSheetIndex(idx)}
            style={
              activeSheetIndex === idx
                ? {
                    backgroundColor: palette.canvas,
                    borderColor: palette.accent,
                    color: palette.ink,
                  }
                : { borderColor: "transparent", color: palette.muted }
            }
            type="button"
          >
            {sheet.name}
          </button>
        ))}
        <button
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          type="button"
        >
          <svg
            fill="none"
            height="14"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
};

function areEqual(prevProps: SheetEditorProps, nextProps: SheetEditorProps) {
  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.saveContent === nextProps.saveContent
  );
}

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
