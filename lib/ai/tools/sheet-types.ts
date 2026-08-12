export interface SheetStyle {
  [cell: string]: {
    backgroundColor?: string;
    color?: string;
    bold?: boolean;
    textAlign?: "left" | "center" | "right";
  };
}

export type SheetTheme =
  | "editorial"
  | "ocean"
  | "forest"
  | "sunset"
  | "lavender"
  | "midnight";

export interface Sheet {
  csv: string;
  name: string;
  styles?: SheetStyle;
}

export interface SheetData {
  activeSheetIndex?: number;
  sheets: Sheet[];
  theme?: SheetTheme;
  title: string;
}

export function isSheetData(content: any): content is SheetData {
  return (
    content &&
    typeof content === "object" &&
    typeof content.title === "string" &&
    Array.isArray(content.sheets)
  );
}
