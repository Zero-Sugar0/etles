export interface SheetStyle {
  [cell: string]: {
    backgroundColor?: string;
    color?: string;
    bold?: boolean;
    textAlign?: "left" | "center" | "right";
  };
}

export interface Sheet {
  name: string;
  csv: string;
  styles?: SheetStyle;
}

export interface SheetData {
  title: string;
  sheets: Sheet[];
  activeSheetIndex?: number;
}

export function isSheetData(content: any): content is SheetData {
  return (
    content &&
    typeof content === "object" &&
    typeof content.title === "string" &&
    Array.isArray(content.sheets)
  );
}
