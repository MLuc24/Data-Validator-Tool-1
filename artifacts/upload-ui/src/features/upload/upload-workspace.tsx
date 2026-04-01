import type { ChangeEvent, DragEvent, RefObject } from "react";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardList,
  CloudUpload,
  FileSpreadsheet,
  Layers3,
  Loader2,
  MapPin,
  Upload,
} from "lucide-react";

import { ALL } from "@/data/factRegistry";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Company, CostCenter, Plan } from "@/types/supabase";
import type { ImportTargetValue, RowData, ValidationStatus } from "./types";

type Props = {
  activeTarget: {
    description: string;
    label: string;
    supported: boolean;
    unsupportedReason?: string;
  } | null;
  canSubmit: boolean;
  factTabs: Array<{
    factId: number;
    factName: string;
    sourceSheetName: string | null;
    sortOrder: number;
    value: ImportTargetValue;
  }>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  fileName: string;
  fileSize: number;
  headers: string[];
  isDragging: boolean;
  isLoggingIn: boolean;
  isLoadingFacts: boolean;
  isSubmitting: boolean;
  notLoggedIn: boolean;
  onCompanyChange: (value: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFactChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPickFile: () => void;
  onPlanChange: (value: string) => void;
  onSelectedCCChange: (value: string) => void;
  onSubmit: () => void;
  rows: RowData[];
  selectedCCId: string;
  selectedCompanyId: string;
  selectedImportTarget: ImportTargetValue;
  selectedPlanId: string;
  setIsDragging: (value: boolean) => void;
  totalRows: number;
  userCompanies: Company[];
  userCostCenters: CostCenter[];
  userPlans: Plan[];
  validationErrors: string[];
  validationStatus: ValidationStatus;
  validationWarnings: string[];
};

export function UploadWorkspace({
  activeTarget,
  canSubmit,
  factTabs,
  fileInputRef,
  fileName,
  fileSize,
  headers,
  isDragging,
  isLoggingIn,
  isLoadingFacts,
  isSubmitting,
  notLoggedIn,
  onCompanyChange,
  onDrop,
  onFactChange,
  onFileChange,
  onPickFile,
  onPlanChange,
  onSelectedCCChange,
  onSubmit,
  rows,
  selectedCCId,
  selectedCompanyId,
  selectedImportTarget,
  selectedPlanId,
  setIsDragging,
  totalRows,
  userCompanies,
  userCostCenters,
  userPlans,
  validationErrors,
  validationStatus,
  validationWarnings,
}: Props) {
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_340px] items-stretch">
        <div className="bg-white border border-border/60 rounded-[28px] shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border/40 flex flex-wrap items-center gap-2">
            <Layers3 className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold text-foreground">
              Phan loai don vi
            </h2>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {userCostCenters.length} CC kha dung
            </span>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-[11px] font-semibold text-foreground">
                  Fact upload
                </Label>
                {activeTarget && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                      activeTarget.supported
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700",
                    )}
                  >
                    {activeTarget.supported ? "San sang validate" : "Chua support submit"}
                  </span>
                )}
              </div>

              {isLoadingFacts ? (
                <div className="rounded-2xl border border-border/60 bg-[#f8f9fc] px-3 py-2 text-[11px] text-muted-foreground">
                  Dang tai danh sach fact...
                </div>
              ) : (
                <Select
                  value={selectedImportTarget}
                  onValueChange={onFactChange}
                  disabled={isLoadingFacts}
                >
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 text-sm bg-[#f8f9fc]">
                    <SelectValue placeholder="Chon fact upload" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {factTabs.map((fact) => (
                      <SelectItem key={fact.factId} value={fact.value}>
                        {fact.factName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {activeTarget && (
                <div
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-[11px]",
                    activeTarget.supported
                      ? "border-border/60 bg-[#f8f9fc] text-muted-foreground"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {activeTarget.supported
                    ? activeTarget.description
                    : activeTarget.unsupportedReason ??
                      "Fact dang chon chua co rule validate tren frontend."}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                  <Building2 className="w-3 h-3 text-primary" /> Cong ty
                </Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={onCompanyChange}
                  disabled={notLoggedIn || isLoggingIn}
                >
                  <SelectTrigger className="h-10 rounded-2xl border-border/70 text-xs bg-[#f8f9fc]">
                    <SelectValue placeholder="Dang nhap truoc..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>
                      Tat ca ({userCompanies.length})
                    </SelectItem>
                    {userCompanies.map((company) => (
                      <SelectItem
                        key={company.company_id}
                        value={String(company.company_id)}
                      >
                        [{company.company_id}] {company.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                  <MapPin className="w-3 h-3 text-primary" /> Cost Center
                </Label>
                <Select
                  value={selectedCCId}
                  onValueChange={onSelectedCCChange}
                  disabled={notLoggedIn || isLoggingIn}
                >
                  <SelectTrigger className="h-10 rounded-2xl border-border/70 text-xs bg-[#f8f9fc]">
                    <SelectValue placeholder="Dang nhap truoc..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>
                      Tat ca ({userCostCenters.length})
                    </SelectItem>
                    {userCostCenters.map((cc) => (
                      <SelectItem
                        key={cc.cost_center_id ?? cc.cost_center_code}
                        value={String(cc.cost_center_id ?? cc.cost_center_code)}
                      >
                        [{cc.cost_center_id ?? cc.cost_center_code}] {cc.cost_center_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                  <Layers3 className="w-3 h-3 text-primary" /> Khoi kinh doanh
                </Label>
                <Select
                  value={selectedPlanId}
                  onValueChange={onPlanChange}
                  disabled={notLoggedIn || isLoggingIn}
                >
                  <SelectTrigger className="h-10 rounded-2xl border-border/70 text-xs bg-[#f8f9fc]">
                    <SelectValue placeholder="Dang nhap truoc..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>
                      Tat ca ({userPlans.length})
                    </SelectItem>
                    {userPlans.map((plan) => (
                      <SelectItem key={plan.plan_id} value={String(plan.plan_id)}>
                        {plan.plan_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-border/60 rounded-[28px] shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-border/40 flex flex-wrap items-center gap-2">
            <CloudUpload className="w-3.5 h-3.5 text-primary" />
            <h2 className="text-xs font-semibold text-foreground">Upload file</h2>
            <span className="inline-flex items-center rounded-full border border-border/60 bg-[#f8f9fc] px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              {activeTarget ? `Dang check: ${activeTarget.label}` : "Chon fact de check"}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              CSV · XLSX
            </span>
          </div>
          <div className="p-4 flex flex-col gap-3 flex-1">
            <div className="rounded-xl border border-border/60 bg-[#f8f9fc] px-3 py-2 text-[11px] text-muted-foreground">
              Data preview va validation se chay theo fact dang chon o ben trai.
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
            />

            {!fileName ? (
              <div
                onClick={onPickFile}
                onDrop={onDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                className={cn(
                  "border-2 border-dashed rounded-[22px] flex flex-col items-center gap-2 py-8 cursor-pointer transition-all duration-200 bg-[#fbfcfe]",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-white",
                )}
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center",
                    isDragging ? "bg-primary/15" : "bg-muted",
                  )}
                >
                  <CloudUpload
                    className={cn(
                      "w-5 h-5",
                      isDragging ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">
                    Keo tha file vao day
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    hoac chon file
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-[22px] border p-3.5 flex items-start gap-3",
                  validationStatus === "valid"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : validationStatus === "invalid"
                      ? "border-red-200 bg-red-50/60"
                      : "border-border bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    validationStatus === "valid"
                      ? "bg-emerald-100"
                      : validationStatus === "invalid"
                        ? "bg-red-100"
                        : "bg-muted",
                  )}
                >
                  {validationStatus === "validating" ? (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  ) : validationStatus === "valid" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : validationStatus === "invalid" ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">
                    {fileName}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {(fileSize / 1024).toFixed(1)} KB
                  </p>
                  {validationStatus === "valid" && (
                    <p className="text-[10px] text-emerald-600 font-medium mt-1">
                      {totalRows.toLocaleString()} dong ·{" "}
                      {activeTarget ? activeTarget.label : "Hop le"}
                    </p>
                  )}
                  {validationStatus !== "valid" && activeTarget && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Fact dang chon: {activeTarget.label}
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onPickFile}
              className="gap-1.5 rounded-2xl h-9 border-border/70 text-xs w-full"
            >
              <Upload className="w-3 h-3" />
              {fileName ? "Thay file khac" : "Chon file"}
            </Button>

            <div className="flex-1" />

            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              size="sm"
              className="gap-1.5 rounded-2xl h-10 w-full shadow-sm font-semibold text-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ClipboardList className="w-3.5 h-3.5" />
              )}
              Gui du lieu
            </Button>
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-[28px] overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-red-200 flex flex-wrap items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs font-semibold text-red-700">
              Phat hien {validationErrors.length} loi trong file
            </span>
          </div>
          <ul className="px-5 py-3 space-y-2">
            {validationErrors.map((error, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-200 text-red-700 text-[9px] font-bold shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-[11px] text-red-700 leading-snug">
                  {error}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {validationWarnings.length > 0 && validationErrors.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[28px] overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-amber-200 flex flex-wrap items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              Co {validationWarnings.length} canh bao du lieu
            </span>
          </div>
          <ul className="px-5 py-3 space-y-2">
            {validationWarnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-200 text-amber-700 text-[9px] font-bold shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-[11px] text-amber-700 leading-snug">
                  {warning}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-border/60 rounded-[28px] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                Data Preview
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Preview hien thi toi da 200 dong va duoc check theo fact dang chon.
              </p>
            </div>
          </div>
          {rows.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full">
              {rows.length.toLocaleString()} / {totalRows.toLocaleString()} dong
            </span>
          )}
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-[#f4f6fb] hover:bg-[#f4f6fb] border-b border-border/50">
                  <TableHead className="text-[10px] font-bold text-muted-foreground w-10 px-3 py-2.5 text-center">
                    #
                  </TableHead>
                  {headers.map((column) => (
                    <TableHead
                      key={column}
                      className="text-[10px] font-bold text-foreground whitespace-nowrap px-3 py-2.5 border-l border-border/30 first:border-l-0"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow
                    key={rowIndex}
                    className={cn(
                      "border-b border-border/30 hover:bg-primary/3 transition-colors",
                      rowIndex % 2 === 0 ? "bg-white" : "bg-[#fafbfd]",
                    )}
                  >
                    <TableCell className="text-[10px] text-muted-foreground text-center px-3 py-1.5 font-mono">
                      {rowIndex + 1}
                    </TableCell>
                    {headers.map((column) => (
                      <TableCell
                        key={column}
                        className="text-xs px-3 py-1.5 whitespace-nowrap border-l border-border/20 first:border-l-0 font-mono text-[11px]"
                      >
                        {row[column] !== undefined && row[column] !== null ? (
                          String(row[column])
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Chua co du lieu preview
            </p>
          </div>
        )}
      </div>
    </>
  );
}
