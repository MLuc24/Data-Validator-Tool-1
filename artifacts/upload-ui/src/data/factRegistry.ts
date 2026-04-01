export const ALL = "__all__";

export type FactKey = string;

export interface FactCatalogRecord {
  fact_id: number;
  fact_code: string;
  fact_name: string;
  table_name: string;
  source_sheet_name?: string | null;
  description?: string | null;
  grain_description?: string | null;
  is_active: boolean;
  sort_order: number;
  total_declared_columns?: number;
}

export interface FactColumnRecord {
  fact_column_id: number;
  fact_id: number;
  column_name: string;
  display_name: string;
  data_type: string;
  is_required: boolean;
  is_dimension: boolean;
  is_measure: boolean;
  is_system_column: boolean;
  source_excel_column?: string | null;
  source_excel_header?: string | null;
  display_order: number;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FactConfig {
  value: FactKey;
  factId: number;
  factCode: string;
  tableName: string;
  label: string;
  description: string;
  grainDescription?: string | null;
  sourceSheetName?: string | null;
  requiredColumns: string[];
  supported: boolean;
  unsupportedReason?: string;
  filterColumns: {
    company: string[];
    plan: string[];
    costCenter: string[];
  };
  columns: FactColumnRecord[];
}

const NON_FILE_COLUMNS = new Set([
  "fact_row_id",
  "row_hash",
  "created_at",
  "updated_at",
  "extra_data",
]);

const normalizeHeader = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const getUniqueHeaders = (
  columns: FactColumnRecord[],
  predicate?: (column: FactColumnRecord) => boolean,
) => {
  const seen = new Set<string>();

  return columns
    .filter((column) => !predicate || predicate(column))
    .sort((a, b) => a.display_order - b.display_order)
    .flatMap((column) => {
      const header = normalizeHeader(column.source_excel_header);
      if (!header || seen.has(header)) return [];
      seen.add(header);
      return [header];
    });
};

const getRequiredColumns = (columns: FactColumnRecord[]) =>
  getUniqueHeaders(
    columns,
    (column) =>
      !NON_FILE_COLUMNS.has(column.column_name) &&
      Boolean(normalizeHeader(column.source_excel_header)),
  );

const getFilterColumns = (
  columns: FactColumnRecord[],
  targetColumn: "company_id" | "plan_id" | "cost_center_id",
) =>
  getUniqueHeaders(columns, (column) => column.column_name === targetColumn);

export const buildFactConfig = (
  catalog: FactCatalogRecord,
  factColumns: FactColumnRecord[],
): FactConfig => {
  const requiredColumns = getRequiredColumns(factColumns);
  const companyHeaders = getFilterColumns(factColumns, "company_id");
  const planHeaders = getFilterColumns(factColumns, "plan_id");
  const costCenterHeaders = getFilterColumns(factColumns, "cost_center_id");

  const missingMetadataColumns = factColumns.filter(
    (column) =>
      column.is_required &&
      !column.is_system_column &&
      !normalizeHeader(column.source_excel_header),
  );

  let unsupportedReason: string | undefined;
  if (!factColumns.length) {
    unsupportedReason = "Fact nay chua co metadata cot trong fact_column_registry.";
  } else if (!requiredColumns.length) {
    unsupportedReason =
      "Fact nay chua khai bao source_excel_header trong fact_column_registry.";
  } else if (missingMetadataColumns.length) {
    unsupportedReason = `Fact nay con ${missingMetadataColumns.length} cot chua map source_excel_header.`;
  }

  return {
    value: catalog.table_name,
    factId: catalog.fact_id,
    factCode: catalog.fact_code,
    tableName: catalog.table_name,
    label: catalog.fact_name,
    description: catalog.description ?? `Upload va kiem tra theo mau ${catalog.fact_name}.`,
    grainDescription: catalog.grain_description ?? null,
    sourceSheetName: catalog.source_sheet_name ?? null,
    requiredColumns,
    supported: !unsupportedReason,
    unsupportedReason,
    filterColumns: {
      company: companyHeaders,
      plan: planHeaders,
      costCenter: costCenterHeaders,
    },
    columns: factColumns.sort((a, b) => a.display_order - b.display_order),
  };
};

export const buildFactConfigMap = (
  catalogs: FactCatalogRecord[],
  columns: FactColumnRecord[],
) => {
  const columnsByFactId = new Map<number, FactColumnRecord[]>();

  columns.forEach((column) => {
    const bucket = columnsByFactId.get(column.fact_id) ?? [];
    bucket.push(column);
    columnsByFactId.set(column.fact_id, bucket);
  });

  return catalogs.reduce<Record<string, FactConfig>>((acc, catalog) => {
    acc[catalog.table_name] = buildFactConfig(
      catalog,
      columnsByFactId.get(catalog.fact_id) ?? [],
    );
    return acc;
  }, {});
};

export const getFactConfig = (
  factConfigs: Record<string, FactConfig>,
  fact: FactKey | null | undefined,
) => {
  if (!fact) return null;
  return factConfigs[fact] ?? null;
};
