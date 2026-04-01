import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import * as XLSX from "xlsx";

import {
  ALL,
  buildFactConfigMap,
  getFactConfig,
  type FactCatalogRecord,
  type FactColumnRecord,
  type FactConfig,
} from "@/data/factRegistry";
import {
  getFallbackCompanyAliases,
  getFallbackCostCenterAliases,
} from "@/data/masterDataFallback";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type {
  UploadBatchFactInsert,
  UploadBatchInsert,
  UploadFileInsert,
} from "@/types/supabase";
import {
  detectFactFromMatrix,
  getCellString,
  isEmptyMatrixRow,
  normalizeRowsByHeaders,
  normalizeLookupValue,
  parseAmount,
  parseFileDate,
  selectBestHeaderCandidate,
} from "./file-utils";
import type {
  FilterScope,
  ImportTargetValue,
  RowData,
  ValidationStatus,
} from "./types";
import { validateDataAgainstFilters } from "./validation";

type WorkflowParams = {
  canCreate: boolean;
  loggedInUser: { user_id: string; full_name: string } | null;
  masterDataNotice: string | null;
  onSubmitted?: () => void | Promise<void>;
  resolvedCCId: string | null;
  resolvedCompanyId: string | null;
  scope: FilterScope;
  selectedCCId: string;
  selectedCompanyId: string;
  selectedPlanId: string;
};

type WorkflowFactTab = {
  factId: number;
  factName: string;
  sourceSheetName: string | null;
  sortOrder: number;
  supported: boolean;
  value: ImportTargetValue;
};

type BuildFactRowsParams = {
  companyId: string | null;
  costCenterId: string | null;
  factConfig: FactConfig;
  planId: number | null;
  resolveCompanyIdFromRow: (row: RowData) => string | null;
  resolveCostCenterIdFromRow: (row: RowData) => string | null;
  resolvePlanIdFromRow: (row: RowData) => number | null;
  rows: RowData[];
  uploadBatchId: number;
  userName: string;
};

const SKIPPED_COLUMNS = new Set([
  "fact_row_id",
  "row_hash",
  "created_at",
  "updated_at",
  "extra_data",
]);

const insertInChunks = async (
  tableName: string,
  rows: Record<string, unknown>[],
  chunkSize = 500,
) => {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(tableName).insert(chunk);
    if (error) {
      throw new Error(error.message);
    }
  }
};

const createUploadFileCode = (params: {
  factCode: string;
  companyId: string;
  planId: string;
  costCenterId: string;
}) =>
  [
    params.factCode,
    params.companyId,
    String(params.planId),
    params.costCenterId,
  ].join("__");

const parseBoolean = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "co", "có"].includes(text)) return true;
  if (["false", "0", "no", "n", "khong", "không"].includes(text)) return false;
  return null;
};

const coerceValueByDataType = (
  dataType: string,
  value: string | number | boolean | null | undefined,
) => {
  if (value === null || value === undefined || value === "") return null;

  const normalizedType = dataType.toLowerCase();

  if (
    normalizedType.includes("numeric") ||
    normalizedType.includes("decimal") ||
    normalizedType.includes("real") ||
    normalizedType.includes("double")
  ) {
    if (typeof value === "boolean") return value ? 1 : 0;
    return parseAmount(value);
  }

  if (normalizedType.includes("int") && !normalizedType.includes("interval")) {
    const parsed =
      typeof value === "boolean" ? (value ? 1 : 0) : parseAmount(value);
    return parsed === null ? null : Math.trunc(parsed);
  }

  if (normalizedType.includes("bool")) {
    return parseBoolean(value);
  }

  if (normalizedType === "date") {
    return typeof value === "boolean" ? null : parseFileDate(value);
  }

  if (normalizedType.includes("timestamp")) {
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
  }

  if (normalizedType.includes("json")) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  return String(value).trim() || null;
};

const resolveSystemColumnValue = (
  column: FactColumnRecord,
  rowIndex: number,
  params: Omit<BuildFactRowsParams, "rows">,
  row: RowData,
) => {
  switch (column.column_name) {
    case "upload_batch_id":
      return params.uploadBatchId;
    case "fact_id":
      return params.factConfig.factId;
    case "company_id":
      return params.companyId ?? params.resolveCompanyIdFromRow(row) ?? undefined;
    case "plan_id":
      return params.planId ?? params.resolvePlanIdFromRow(row) ?? undefined;
    case "cost_center_id":
      return (
        params.costCenterId ?? params.resolveCostCenterIdFromRow(row) ?? undefined
      );
    case "source_row_no":
      return rowIndex + 1;
    case "input_by":
    case "created_by":
      return params.userName;
    case "created_time":
      return new Date().toISOString();
    default:
      return undefined;
  }
};

const buildFactRows = ({
  companyId,
  costCenterId,
  factConfig,
  planId,
  resolveCompanyIdFromRow,
  resolveCostCenterIdFromRow,
  resolvePlanIdFromRow,
  rows,
  uploadBatchId,
  userName,
}: BuildFactRowsParams) =>
  rows.map((row, rowIndex) => {
    const payload: Record<string, unknown> = {};

    factConfig.columns.forEach((column) => {
      if (SKIPPED_COLUMNS.has(column.column_name)) return;

      const systemValue = resolveSystemColumnValue(
        column,
        rowIndex,
        {
          companyId,
          costCenterId,
          factConfig,
          planId,
          resolveCompanyIdFromRow,
          resolveCostCenterIdFromRow,
          resolvePlanIdFromRow,
          uploadBatchId,
          userName,
        },
        row,
      );

      if (systemValue !== undefined) {
        payload[column.column_name] = systemValue;
        return;
      }

      const header = column.source_excel_header?.trim();
      if (!header) return;

      payload[column.column_name] = coerceValueByDataType(
        column.data_type,
        row[header],
      );
    });

    return payload;
  });

export function useUploadWorkflow({
  canCreate,
  loggedInUser,
  masterDataNotice,
  onSubmitted,
  resolvedCCId,
  resolvedCompanyId,
  scope,
  selectedCCId,
  selectedCompanyId,
  selectedPlanId,
}: WorkflowParams) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImportTarget, setSelectedImportTarget] =
    useState<ImportTargetValue>("");
  const [factConfigs, setFactConfigs] = useState<Record<string, FactConfig>>({});
  const [factTabs, setFactTabs] = useState<WorkflowFactTab[]>([]);
  const [isLoadingFacts, setIsLoadingFacts] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [rows, setRows] = useState<RowData[]>([]);
  const [allParsedRows, setAllParsedRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("idle");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const activeTarget = useMemo(
    () => getFactConfig(factConfigs, selectedImportTarget),
    [factConfigs, selectedImportTarget],
  );

  useEffect(() => {
    const loadFacts = async () => {
      setIsLoadingFacts(true);

      const [
        { data: factData, error: factError },
        { data: columnData, error: columnError },
      ] = await Promise.all([
        supabase
          .from("vw_fact_catalog")
          .select(
            "fact_id, fact_code, fact_name, table_name, source_sheet_name, description, grain_description, is_active, sort_order, total_declared_columns",
          )
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("fact_column_registry")
          .select(
            "fact_column_id, fact_id, column_name, display_name, data_type, is_required, is_dimension, is_measure, is_system_column, source_excel_column, source_excel_header, display_order, description, created_at, updated_at",
          )
          .order("display_order"),
      ]);

      if (factError || !factData?.length) {
        setFactConfigs({});
        setFactTabs([]);
        setSelectedImportTarget("");
        setIsLoadingFacts(false);
        return;
      }

      const catalogs = factData as FactCatalogRecord[];
      const columns =
        (columnError ? [] : (columnData as FactColumnRecord[] | null)) ?? [];
      const nextFactConfigs = buildFactConfigMap(catalogs, columns);

      setFactConfigs(nextFactConfigs);
      setFactTabs(
        catalogs.map((fact) => ({
          factId: fact.fact_id,
          factName: fact.fact_name,
          sourceSheetName: fact.source_sheet_name ?? null,
          sortOrder: fact.sort_order,
          supported: nextFactConfigs[fact.table_name]?.supported ?? false,
          value: fact.table_name,
        })),
      );
      setSelectedImportTarget(
        (currentValue) => currentValue || catalogs[0].table_name,
      );
      setIsLoadingFacts(false);
    };

    void loadFacts();
  }, []);

  useEffect(() => {
    if (!factTabs.length) return;

    const activeExists = factTabs.some(
      (fact) => fact.value === selectedImportTarget,
    );
    if (!activeExists) {
      setSelectedImportTarget(factTabs[0].value);
    }
  }, [factTabs, selectedImportTarget]);

  const resolvedPlanId = useMemo(() => {
    if (resolvedCCId) {
      const matchedCostCenter = scope.userCostCenters.find(
        (costCenter) =>
          String(costCenter.cost_center_id ?? costCenter.cost_center_code ?? "") ===
          resolvedCCId,
      );

      if (matchedCostCenter) return matchedCostCenter.plan_id;
    }

    return selectedPlanId !== ALL ? Number(selectedPlanId) : null;
  }, [resolvedCCId, scope.userCostCenters, selectedPlanId]);

  const headersContainRequiredColumns = useCallback(() => {
    const requiredColumns = activeTarget?.requiredColumns ?? [];
    if (!requiredColumns.length) {
      return false;
    }

    return requiredColumns.every((header) => headers.includes(header));
  }, [activeTarget, headers]);

  const clearUploadSelection = useCallback(() => {
    setUploadFile(null);
    setFileName("");
    setFileSize(0);
  }, []);

  const clearParsedRows = useCallback(() => {
    setTotalRows(0);
    setRows([]);
    setAllParsedRows([]);
    setHeaders([]);
  }, []);

  const handleClearFile = useCallback(() => {
    clearUploadSelection();
    clearParsedRows();
    setValidationStatus("idle");
    setValidationErrors([]);
    setValidationWarnings([]);
  }, [clearParsedRows, clearUploadSelection]);

  const handleFactChange = useCallback(
    (value: string) => {
      if (value === selectedImportTarget) return;

      setSelectedImportTarget(value);
      handleClearFile();
    },
    [handleClearFile, selectedImportTarget],
  );

  const parseFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
        clearUploadSelection();
        clearParsedRows();
        setValidationStatus("invalid");
        setValidationWarnings([]);
        setValidationErrors(["Chi chap nhan file CSV hoac XLSX/XLS."]);
        return;
      }

      setUploadFile(file);
      setFileName(file.name);
      setFileSize(file.size);
      setValidationStatus("validating");
      setValidationErrors([]);
      setValidationWarnings([]);

      try {
        if (!activeTarget) {
          clearParsedRows();
          setValidationStatus("invalid");
          setValidationWarnings([]);
          setValidationErrors(["Khong tim thay metadata fact dang chon."]);
          return;
        }

        if (!activeTarget.supported || !activeTarget.requiredColumns.length) {
          clearParsedRows();
          setValidationStatus("invalid");
          setValidationWarnings([]);
          setValidationErrors([
            activeTarget.unsupportedReason ??
              "Fact dang chon chua du metadata de kiem tra tren frontend.",
          ]);
          return;
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, {
          type: "array",
          cellDates: true,
        });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const matrixData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          dateNF: "dd/mm/yyyy",
          blankrows: false,
          defval: "",
        }) as (string | number | boolean | Date | null | undefined)[][];

        if (!matrixData.length) {
          clearParsedRows();
          setValidationStatus("invalid");
          setValidationWarnings([]);
          setValidationErrors(["File khong co du lieu."]);
          return;
        }

        const headerCandidate = selectBestHeaderCandidate(
          matrixData,
          activeTarget.requiredColumns,
        );

        if (
          !headerCandidate ||
          headerCandidate.requiredMatches !== activeTarget.requiredColumns.length
        ) {
          const detectedFact = detectFactFromMatrix(
            matrixData,
            Object.values(factConfigs),
          );
          clearParsedRows();
          setValidationStatus("invalid");
          setValidationWarnings([]);
          setValidationErrors([
            detectedFact
              ? `File co ve thuoc fact "${detectedFact.factConfig.label}", khong phai fact "${activeTarget.label}".`
              : `Khong tim thay header hop le cho fact "${activeTarget.label}".`,
          ]);
          return;
        }

        const fileHeaders = headerCandidate.headers;
        const structuralErrors: string[] = [];

        const missingColumns = activeTarget.requiredColumns.filter(
          (column) => !fileHeaders.includes(column),
        );

        if (missingColumns.length) {
          structuralErrors.push(
            `Thieu ${missingColumns.length} cot: ${missingColumns.join(", ")}`,
          );
        }

        if (structuralErrors.length) {
          clearParsedRows();
          setValidationStatus("invalid");
          setValidationWarnings([]);
          setValidationErrors(structuralErrors);
          return;
        }

        const dataRows = matrixData
          .slice(headerCandidate.rowIndex + 1)
          .filter((row) => !isEmptyMatrixRow(row));
        const normalizedRows = normalizeRowsByHeaders(dataRows, fileHeaders);
        const dataErrors = validateDataAgainstFilters(
          normalizedRows,
          selectedCompanyId,
          selectedCCId,
          selectedPlanId,
          activeTarget,
          scope,
        );

        if (dataErrors.length && !masterDataNotice) {
          clearParsedRows();
          setValidationStatus("invalid");
          setValidationWarnings([]);
          setValidationErrors(dataErrors);
          return;
        }

        setTotalRows(normalizedRows.length);
        setHeaders(fileHeaders);
        setAllParsedRows(normalizedRows);
        setRows(normalizedRows.slice(0, 200));
        setValidationStatus("valid");
        setValidationErrors([]);
        setValidationWarnings(masterDataNotice ? dataErrors : []);
      } catch {
        clearParsedRows();
        setValidationStatus("invalid");
        setValidationWarnings([]);
        setValidationErrors([
          "Khong the doc file. Hay kiem tra lai dinh dang file.",
        ]);
      }
    },
    [
      activeTarget,
      clearParsedRows,
      clearUploadSelection,
      factConfigs,
      masterDataNotice,
      scope,
      selectedCCId,
      selectedCompanyId,
      selectedPlanId,
    ],
  );

  useEffect(() => {
    if (
      !fileName ||
      validationStatus === "idle" ||
      validationStatus === "validating" ||
      !allParsedRows.length ||
      !activeTarget
    ) {
      return;
    }

    const dataErrors = validateDataAgainstFilters(
      allParsedRows,
      selectedCompanyId,
      selectedCCId,
      selectedPlanId,
      activeTarget,
      scope,
    );

    if (dataErrors.length) {
      if (masterDataNotice) {
        setValidationWarnings(dataErrors);
        setValidationErrors([]);
        setValidationStatus("valid");
        return;
      }

      clearParsedRows();
      setValidationWarnings([]);
      setValidationErrors(dataErrors);
      setValidationStatus("invalid");
      return;
    }

    setValidationWarnings([]);
    setValidationErrors([]);
    setValidationStatus("valid");
  }, [
    activeTarget,
    allParsedRows,
    clearParsedRows,
    fileName,
    masterDataNotice,
    scope,
    selectedCCId,
    selectedCompanyId,
    selectedPlanId,
    validationStatus,
  ]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void parseFile(file);
      }
      event.target.value = "";
    },
    [parseFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        void parseFile(file);
      }
    },
    [parseFile],
  );

  const handleSubmit = useCallback(async () => {
    if (!activeTarget?.supported) return;
    if (!loggedInUser || !canCreate) return;
    if (validationStatus !== "valid" || !uploadFile || !allParsedRows.length) {
      return;
    }
    if (!headersContainRequiredColumns()) return;

    setIsSubmitting(true);
    let createdBatchId: number | null = null;
    let uploadFileId: number | null = null;

    try {
      const scopeCompanyValue =
        resolvedCompanyId ??
        (selectedCompanyId !== ALL
          ? selectedCompanyId
          : scope.userCompanies.length === 1
            ? String(scope.userCompanies[0]?.company_id ?? "")
            : null);
      const scopePlanValue =
        resolvedPlanId ??
        (selectedPlanId !== ALL ? Number(selectedPlanId) : null);
      const scopeCostCenterValue =
        resolvedCCId ??
        (selectedCCId !== ALL
          ? selectedCCId
          : scope.userCostCenters.length === 1
            ? String(
                scope.userCostCenters[0]?.cost_center_id ??
                  scope.userCostCenters[0]?.cost_center_code ??
                  "",
              )
            : null);

      const selectedCompanyValue =
        scopeCompanyValue && scopeCompanyValue !== "" ? scopeCompanyValue : null;
      const selectedCostCenterValue =
        scopeCostCenterValue && scopeCostCenterValue !== ""
          ? scopeCostCenterValue
          : null;
      const selectedPlanValue = scopePlanValue;

      const allowedCompanies =
        selectedCompanyValue === null
          ? scope.userCompanies
          : scope.userCompanies.filter(
              (company) => String(company.company_id) === selectedCompanyValue,
            );
      const allowedPlans =
        selectedPlanValue === null
          ? scope.userPlans
          : scope.userPlans.filter((plan) => plan.plan_id === selectedPlanValue);
      const allowedCostCenters =
        selectedCostCenterValue === null
          ? scope.userCostCenters
          : scope.userCostCenters.filter(
              (costCenter) =>
                String(
                  costCenter.cost_center_id ?? costCenter.cost_center_code ?? "",
                ) === selectedCostCenterValue,
            );

      const companyLookup = new Map<string, string>();
      allowedCompanies.forEach((company) => {
        const companyId = String(company.company_id);
        [
          company.company_name,
          companyId,
          ...getFallbackCompanyAliases(company.company_id),
        ].forEach((candidate) => {
          const normalized = normalizeLookupValue(String(candidate));
          if (normalized) companyLookup.set(normalized, companyId);
        });
      });

      const planLookup = new Map<string, number>();
      allowedPlans.forEach((plan) => {
        [plan.plan_name, String(plan.plan_id)].forEach((candidate) => {
          const normalized = normalizeLookupValue(String(candidate));
          if (normalized) planLookup.set(normalized, plan.plan_id);
        });
      });

      const costCenterLookup = new Map<string, string>();
      allowedCostCenters.forEach((costCenter) => {
        const costCenterId = String(
          costCenter.cost_center_id ?? costCenter.cost_center_code ?? "",
        );
        [
          costCenter.cost_center_name,
          costCenterId,
          ...getFallbackCostCenterAliases(costCenterId),
        ].forEach((candidate) => {
          const normalized = normalizeLookupValue(String(candidate));
          if (normalized) costCenterLookup.set(normalized, costCenterId);
        });
      });

      const resolveCompanyIdFromRow = (row: RowData) => {
        const value = getCellString(row, activeTarget.filterColumns.company);
        if (!value) return null;
        return companyLookup.get(normalizeLookupValue(value)) ?? null;
      };

      const resolvePlanIdFromRow = (row: RowData) => {
        const value = getCellString(row, activeTarget.filterColumns.plan);
        if (!value) return null;
        return planLookup.get(normalizeLookupValue(value)) ?? null;
      };

      const resolveCostCenterIdFromRow = (row: RowData) => {
        const value = getCellString(row, activeTarget.filterColumns.costCenter);
        if (!value) return null;
        return costCenterLookup.get(normalizeLookupValue(value)) ?? null;
      };

      const fileCode = createUploadFileCode({
        factCode: activeTarget.factCode,
        companyId: selectedCompanyValue ?? ALL,
        planId: selectedPlanValue === null ? ALL : String(selectedPlanValue),
        costCenterId: selectedCostCenterValue ?? ALL,
      });

      const { data: existingUploadFile, error: existingUploadFileError } =
        await supabase
          .from("upload_files")
          .select("upload_file_id")
          .eq("file_code", fileCode)
          .eq("fact_id", activeTarget.factId)
          .maybeSingle();

      if (existingUploadFileError) {
        throw new Error(existingUploadFileError.message);
      }

      if (existingUploadFile?.upload_file_id) {
        uploadFileId = existingUploadFile.upload_file_id;
      } else {
        const uploadFilePayload: UploadFileInsert = {
          fact_id: activeTarget.factId,
          file_code: fileCode,
          file_name: activeTarget.sourceSheetName ?? activeTarget.label,
          description: activeTarget.description,
          selected_company_id: selectedCompanyValue,
          selected_plan_id: selectedPlanValue,
          selected_cost_center_id: selectedCostCenterValue,
          is_submit_enabled: true,
          missing_source_header_count: 0,
          created_by_user_id: loggedInUser.user_id,
          is_locked: false,
        };

        const { data: insertedUploadFile, error: uploadFileError } =
          await supabase
            .from("upload_files")
            .insert(uploadFilePayload)
            .select("upload_file_id")
            .single();

        if (uploadFileError || !insertedUploadFile) {
          throw new Error(uploadFileError?.message ?? "Khong the tao upload_file.");
        }

        uploadFileId = insertedUploadFile.upload_file_id;
      }

      const batchPayload: UploadBatchInsert = {
        upload_file_id: uploadFileId,
        fact_id: activeTarget.factId,
        uploaded_by_user_id: loggedInUser.user_id,
        file_name: fileName,
        original_file_name: uploadFile.name,
        note: null,
        total_rows: allParsedRows.length,
        success_rows: 0,
        failed_rows: 0,
        status: "processing",
        submitted_at: new Date().toISOString(),
        approval_status: "processing",
        preview_rows: Math.min(allParsedRows.length, 200),
        validation_status: "pending",
        validation_message: null,
        missing_source_header_count: 0,
        preview_payload: rows.slice(0, 20),
        selected_company_id: selectedCompanyValue,
        selected_plan_id: selectedPlanValue,
        selected_cost_center_id: selectedCostCenterValue,
      };

      const { data: insertedBatch, error: batchError } = await supabase
        .from("upload_batches")
        .insert(batchPayload)
        .select("upload_batch_id")
        .single();

      if (batchError || !insertedBatch) {
        throw new Error(batchError?.message ?? "Khong the tao batch upload.");
      }

      const batchId = insertedBatch.upload_batch_id;
      createdBatchId = batchId;

      const factRows = buildFactRows({
        companyId: selectedCompanyValue,
        costCenterId: selectedCostCenterValue,
        factConfig: activeTarget,
        planId: selectedPlanValue,
        resolveCompanyIdFromRow,
        resolveCostCenterIdFromRow,
        resolvePlanIdFromRow,
        rows: allParsedRows,
        uploadBatchId: batchId,
        userName: loggedInUser.full_name,
      });

      await insertInChunks(activeTarget.tableName, factRows);

      const batchFactPayload: UploadBatchFactInsert = {
        upload_batch_id: batchId,
        fact_id: activeTarget.factId,
        imported_rows: factRows.length,
        success_rows: factRows.length,
        failed_rows: 0,
        status: "completed",
      };

      const { error: batchFactError } = await supabase
        .from("upload_batch_facts")
        .insert(batchFactPayload);

      if (batchFactError) {
        throw new Error(batchFactError.message);
      }

      const { error: finalizeBatchError } = await supabase
        .from("upload_batches")
        .update({
          success_rows: factRows.length,
          failed_rows: 0,
          status: "completed",
          validation_status: "pending",
        })
        .eq("upload_batch_id", batchId);

      if (finalizeBatchError) {
        throw new Error(finalizeBatchError.message);
      }

      if (uploadFileId !== null) {
        const { error: finalizeUploadFileError } = await supabase
          .from("upload_files")
          .update({
            current_upload_batch_id: batchId,
            is_submit_enabled: true,
            missing_source_header_count: 0,
          })
          .eq("upload_file_id", uploadFileId);

        if (finalizeUploadFileError) {
          throw new Error(finalizeUploadFileError.message);
        }
      }

      handleClearFile();
      if (onSubmitted) {
        await onSubmitted();
      }
      toast({ title: "Submit thanh cong" });
    } catch (error) {
      if (createdBatchId !== null) {
        await supabase
          .from("upload_batches")
          .update({
            failed_rows: allParsedRows.length,
            status: "failed",
          })
          .eq("upload_batch_id", createdBatchId);
      }

      toast({
        title: "Submit that bai",
        description:
          error instanceof Error ? error.message : "Loi khong xac dinh",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeTarget,
    allParsedRows,
    canCreate,
    fileName,
    handleClearFile,
    headersContainRequiredColumns,
    loggedInUser,
    onSubmitted,
    resolvedCCId,
    resolvedCompanyId,
    resolvedPlanId,
    rows,
    scope.userCompanies,
    scope.userCostCenters,
    scope.userPlans,
    selectedCCId,
    selectedCompanyId,
    selectedPlanId,
    toast,
    uploadFile,
    validationStatus,
  ]);

  const canSubmit =
    !!loggedInUser &&
    !!activeTarget &&
    activeTarget.supported &&
    validationStatus === "valid" &&
    !!uploadFile &&
    allParsedRows.length > 0 &&
    !isSubmitting;

  return {
    activeTarget,
    canSubmit,
    factTabs,
    fileInputRef,
    fileName,
    fileSize,
    handleFactChange,
    handleClearFile,
    handleDrop,
    handleFileChange,
    handleSubmit,
    headers,
    isDragging,
    isLoadingFacts,
    isSubmitting,
    rows,
    selectedImportTarget,
    setIsDragging,
    totalRows,
    validationErrors,
    validationStatus,
    validationWarnings,
  };
}
