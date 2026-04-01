import type { FactConfig } from "@/data/factRegistry";
import { repairMojibakeText } from "@/lib/text-repair";
import type { FactDetectionResult, HeaderCandidate, RowData, SheetCell } from "./types";

export const getLocalISODate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const parseFileDate = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const dmY = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return text;
  const asDate = new Date(text);
  if (!Number.isNaN(asDate.getTime())) {
    const yyyy = asDate.getFullYear();
    const mm = String(asDate.getMonth() + 1).padStart(2, "0");
    const dd = String(asDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

export const parseAmount = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/\s/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export const normalizeHeaderLabel = (header: string) =>
  repairMojibakeText(header).normalize("NFKC").replace(/\s+/g, " ").trim();

export const normalizeLookupValue = (value: string) =>
  repairMojibakeText(value)
    .normalize("NFKC")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const isExplicitPlaceholderToken = (normalizedValue: string) => {
  return /^`+$/.test(normalizedValue);
};

export const normalizeHeadersWithDuplicates = (sourceHeaders: string[]) => {
  const counts = new Map<string, number>();
  const renameNotes: string[] = [];
  const normalized = sourceHeaders.map((header, index) => {
    const base = normalizeHeaderLabel(header);
    const seen = counts.get(base) ?? 0;
    const next = seen + 1;
    counts.set(base, next);

    if (next === 1) return base;

    const renamed = `${base} (${next})`;
    renameNotes.push(
      `Cot trung ten vi tri ${index + 1}: "${base}" duoc chuan hoa thanh "${renamed}".`,
    );
    return renamed;
  });

  return { normalized, renameNotes };
};

export const normalizeRowsByHeaders = (
  data: SheetCell[][],
  normalizedHeaders: string[],
) => {
  return data.map((row) => {
    return normalizedHeaders.reduce<RowData>((acc, header, idx) => {
      const value = row[idx];
      if (value === null || value === undefined || value === "") {
        acc[header] = null;
      } else if (typeof value === "number") {
        acc[header] = value;
      } else {
        acc[header] = repairMojibakeText(String(value));
      }
      return acc;
    }, {});
  });
};

export const getCellString = (row: RowData, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return "";
};

export const trimTrailingEmptyCells = (row: SheetCell[]) => {
  const cells = row.map((cell) => String(cell ?? "").trim());
  let lastNonEmptyIdx = -1;
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    if (cells[i] !== "") {
      lastNonEmptyIdx = i;
      break;
    }
  }
  return lastNonEmptyIdx >= 0 ? cells.slice(0, lastNonEmptyIdx + 1) : [];
};

export const isEmptyMatrixRow = (row: SheetCell[]) =>
  row.every((cell) => String(cell ?? "").trim() === "");

export const selectBestHeaderCandidate = (
  rows: SheetCell[][],
  requiredColumns: string[],
): HeaderCandidate | null => {
  let bestCandidate: HeaderCandidate | null = null;

  rows.forEach((row, rowIndex) => {
    const sourceHeaders = trimTrailingEmptyCells(row);
    if (!sourceHeaders.length) return;

    const { normalized: headers, renameNotes } =
      normalizeHeadersWithDuplicates(sourceHeaders);

    const exactOrderMatches = requiredColumns.reduce(
      (count, column, idx) => (headers[idx] === column ? count + 1 : count),
      0,
    );
    const requiredMatches = requiredColumns.filter((column) =>
      headers.includes(column),
    ).length;
    const lengthDelta = Math.abs(headers.length - requiredColumns.length);

    const candidate: HeaderCandidate = {
      rowIndex,
      headers,
      renameNotes,
      exactOrderMatches,
      requiredMatches,
      lengthDelta,
    };

    if (!bestCandidate) {
      bestCandidate = candidate;
      return;
    }

    if (candidate.exactOrderMatches > bestCandidate.exactOrderMatches) {
      bestCandidate = candidate;
      return;
    }
    if (candidate.exactOrderMatches < bestCandidate.exactOrderMatches) return;

    if (candidate.requiredMatches > bestCandidate.requiredMatches) {
      bestCandidate = candidate;
      return;
    }
    if (candidate.requiredMatches < bestCandidate.requiredMatches) return;

    if (candidate.lengthDelta < bestCandidate.lengthDelta) {
      bestCandidate = candidate;
      return;
    }
    if (candidate.lengthDelta > bestCandidate.lengthDelta) return;

    if (candidate.rowIndex < bestCandidate.rowIndex) {
      bestCandidate = candidate;
    }
  });

  return bestCandidate;
};

export const detectFactFromMatrix = (
  rows: SheetCell[][],
  factConfigs: FactConfig[],
): FactDetectionResult | null => {
  let bestMatch: FactDetectionResult | null = null;

  factConfigs
    .filter((fact) => fact.requiredColumns.length > 0)
    .forEach((factConfig) => {
      const headerCandidate = selectBestHeaderCandidate(
        rows,
        factConfig.requiredColumns,
      );
      if (!headerCandidate) return;
      if (
        headerCandidate.requiredMatches !== factConfig.requiredColumns.length
      ) {
        return;
      }

      if (!bestMatch) {
        bestMatch = { factConfig, headerCandidate };
        return;
      }

      const currentOrderRatio =
        headerCandidate.exactOrderMatches / factConfig.requiredColumns.length;
      const bestOrderRatio =
        bestMatch.headerCandidate.exactOrderMatches /
        bestMatch.factConfig.requiredColumns.length;

      if (currentOrderRatio > bestOrderRatio) {
        bestMatch = { factConfig, headerCandidate };
        return;
      }
      if (currentOrderRatio < bestOrderRatio) return;

      if (headerCandidate.lengthDelta < bestMatch.headerCandidate.lengthDelta) {
        bestMatch = { factConfig, headerCandidate };
        return;
      }
      if (headerCandidate.lengthDelta > bestMatch.headerCandidate.lengthDelta) {
        return;
      }

      if (
        factConfig.requiredColumns.length >
        bestMatch.factConfig.requiredColumns.length
      ) {
        bestMatch = { factConfig, headerCandidate };
        return;
      }
      if (
        factConfig.requiredColumns.length <
        bestMatch.factConfig.requiredColumns.length
      ) {
        return;
      }

      if (headerCandidate.rowIndex < bestMatch.headerCandidate.rowIndex) {
        bestMatch = { factConfig, headerCandidate };
      }
    });

  return bestMatch;
};
