export type UploadKind = "attendance" | "midsem" | "internal";

export type ParsedRow = Record<string, unknown>;

export type RowError = {
  row: number;
  field: string;
  message: string;
};
