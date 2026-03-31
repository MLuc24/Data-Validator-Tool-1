import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, LogIn, LogOut, UserCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type {
  CostCenterDetail, AppUser, KhoiOption, CompanyOption,
  UploadBatchInsert, UploadRowInsert,
} from "@/types/supabase";

const REQUIRED_COLUMNS = [
  "Ngày", "Mã hệ thống", "Nhóm chỉ tiêu", "Khoản mục", "Tiểu mục",
  "Thuộc tính", "Nội dung", "Công ty", "Loại dữ liệu", "Khối", "Bộ phận", "Số tiền",
];

interface RowData { [key: string]: string | number; }
type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

function parseDate(raw: string | number | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const parts = s.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isNaN(Date.parse(iso)) ? null : iso;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function parseAmount(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

export default function UploadPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  // ── Supabase data ──────────────────────────────────────────
  const [ccDetails, setCcDetails] = useState<CostCenterDetail[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);

  useEffect(() => {
    const loadMaster = async () => {
      setIsLoadingMaster(true);
      const [ccRes, usersRes] = await Promise.all([
        supabase.from("v_cost_center_details").select("*").eq("is_active", true),
        supabase.from("app_users").select("user_id, full_name, email, cost_center_code, is_active").eq("is_active", true),
      ]);
      if (ccRes.data) setCcDetails(ccRes.data as CostCenterDetail[]);
      if (usersRes.data) setAppUsers(usersRes.data as AppUser[]);
      setIsLoadingMaster(false);
    };
    loadMaster();
  }, []);

  // ── Login state ────────────────────────────────────────────
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    await new Promise((r) => setTimeout(r, 600));
    const active = appUsers.filter((u) => u.is_active);
    if (active.length === 0) {
      toast({ title: "Lỗi", description: "Không có kế toán nào trong hệ thống.", variant: "destructive" });
      setIsLoggingIn(false);
      return;
    }
    const user = active[Math.floor(Math.random() * active.length)];
    setLoggedInUser(user);
    setIsLoggingIn(false);
    toast({ title: "Đăng nhập thành công", description: `Xin chào, ${user.full_name}!` });
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    toast({ title: "Đã đăng xuất" });
  };

  // ── Cascade dropdowns (from Supabase data) ─────────────────
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedCC, setSelectedCC] = useState<string>("");

  const khoiOptions: KhoiOption[] = Array.from(
    new Map(ccDetails.map((r) => [r.plan_id, { plan_id: r.plan_id, plan_name: r.plan_name }])).values()
  ).sort((a, b) => a.plan_id - b.plan_id);

  const companiesForKhoi: CompanyOption[] = selectedPlanId
    ? Array.from(
        new Map(
          ccDetails
            .filter((r) => r.plan_id === Number(selectedPlanId))
            .map((r) => [r.company_id, { company_id: r.company_id, company_name: r.company_name }])
        ).values()
      ).sort((a, b) => a.company_id - b.company_id)
    : [];

  const ccForCompany: CostCenterDetail[] = selectedPlanId && selectedCompanyId
    ? ccDetails.filter(
        (r) => r.plan_id === Number(selectedPlanId) && r.company_id === Number(selectedCompanyId)
      )
    : [];

  const handleKhoiChange = (val: string) => {
    setSelectedPlanId(val);
    setSelectedCompanyId("");
    setSelectedCC("");
  };

  const handleCtyChange = (val: string) => {
    setSelectedCompanyId(val);
    setSelectedCC("");
  };

  const selectedKhoiLabel = khoiOptions.find((k) => String(k.plan_id) === selectedPlanId)?.plan_name ?? "";
  const selectedCtyLabel = companiesForKhoi.find((c) => String(c.company_id) === selectedCompanyId)?.company_name ?? "";
  const selectedCCLabel = ccForCompany.find((cc) => cc.cost_center_code === selectedCC)?.cost_center_name ?? "";

  // ── File upload ────────────────────────────────────────────
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("idle");
  const [validationError, setValidationError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const parseFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setValidationStatus("invalid");
      setValidationError("Chỉ chấp nhận file CSV hoặc XLSX/XLS.");
      setRows([]); setHeaders([]); setFileName("");
      return;
    }
    setFileName(file.name);
    setValidationStatus("validating");
    setValidationError("");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<RowData>(ws, { raw: false, dateNF: "dd/mm/yyyy" });
      if (jsonData.length === 0) {
        setValidationStatus("invalid");
        setValidationError("File không có dữ liệu.");
        setRows([]); setHeaders([]);
        return;
      }
      const fileHeaders = Object.keys(jsonData[0]);
      const missing = REQUIRED_COLUMNS.filter((col) => !fileHeaders.some((h) => h.trim() === col));
      if (missing.length > 0) {
        setValidationStatus("invalid");
        setValidationError(`File thiếu các cột: ${missing.join(", ")}`);
        setRows([]); setHeaders([]);
        return;
      }
      setHeaders(REQUIRED_COLUMNS);
      setRows(jsonData.slice(0, 100));
      setValidationStatus("valid");
      toast({ title: "File hợp lệ", description: `Đọc được ${jsonData.length} dòng.` });
    } catch {
      setValidationStatus("invalid");
      setValidationError("Không thể đọc file. Hãy kiểm tra lại định dạng.");
      setRows([]); setHeaders([]);
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!loggedInUser) { toast({ title: "Lỗi", description: "Vui lòng đăng nhập.", variant: "destructive" }); return; }
    if (!selectedPlanId) { toast({ title: "Lỗi", description: "Vui lòng chọn Khối.", variant: "destructive" }); return; }
    if (!selectedCompanyId) { toast({ title: "Lỗi", description: "Vui lòng chọn Công ty.", variant: "destructive" }); return; }
    if (!selectedCC) { toast({ title: "Lỗi", description: "Vui lòng chọn Cost Center.", variant: "destructive" }); return; }
    if (validationStatus !== "valid" || rows.length === 0) { toast({ title: "Lỗi", description: "Vui lòng upload file hợp lệ.", variant: "destructive" }); return; }

    setIsSubmitting(true);
    try {
      const batch: UploadBatchInsert = {
        upload_date: new Date().toISOString().split("T")[0],
        accountant_name: loggedInUser.full_name,
        company_id: Number(selectedCompanyId),
        cost_center_code: selectedCC,
        bp: null,
        file_name: fileName,
        file_type: fileName.split(".").pop()?.toLowerCase() ?? "unknown",
        total_rows: rows.length,
        preview_rows: Math.min(rows.length, 100),
        status: "submitted",
        uploaded_by: loggedInUser.user_id,
        note: null,
      };

      const { data: batchData, error: batchError } = await supabase
        .from("upload_batches")
        .insert(batch)
        .select("batch_id")
        .single();

      if (batchError) throw batchError;

      const batchId = batchData.batch_id as string;

      const uploadRows: UploadRowInsert[] = rows.map((row, idx) => ({
        batch_id: batchId,
        row_number: idx + 1,
        file_date: parseDate(row["Ngày"] as string),
        system_code: row["Mã hệ thống"] ? String(row["Mã hệ thống"]) : null,
        metric_group: row["Nhóm chỉ tiêu"] ? String(row["Nhóm chỉ tiêu"]) : null,
        category_name: row["Khoản mục"] ? String(row["Khoản mục"]) : null,
        subcategory_name: row["Tiểu mục"] ? String(row["Tiểu mục"]) : null,
        amount: parseAmount(row["Số tiền"]),
        attribute_name: row["Thuộc tính"] ? String(row["Thuộc tính"]) : null,
        content_text: row["Nội dung"] ? String(row["Nội dung"]) : null,
        company_name_in_file: row["Công ty"] ? String(row["Công ty"]) : null,
        data_type: row["Loại dữ liệu"] ? String(row["Loại dữ liệu"]) : null,
        block_name: row["Khối"] ? String(row["Khối"]) : null,
        department_name: row["Bộ phận"] ? String(row["Bộ phận"]) : null,
        raw_json: row as Record<string, unknown>,
      }));

      const CHUNK = 500;
      for (let i = 0; i < uploadRows.length; i += CHUNK) {
        const { error: rowsError } = await supabase
          .from("upload_rows")
          .insert(uploadRows.slice(i, i + CHUNK));
        if (rowsError) throw rowsError;
      }

      toast({
        title: "Submit thành công!",
        description: `Đã gửi ${rows.length} dòng — batch ID: ${batchId.slice(0, 8)}…`,
      });

      setRows([]); setHeaders([]); setFileName("");
      setValidationStatus("idle"); setValidationError("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast({ title: "Submit thất bại", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="text-primary w-5 h-5" />
            <h1 className="text-base font-semibold">Upload Dữ Liệu Kế Toán</h1>
          </div>
          <div className="flex items-center gap-3">
            {isLoadingMaster && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang tải dữ liệu...
              </span>
            )}
            {loggedInUser ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <UserCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-medium" data-testid="text-logged-user">{loggedInUser.full_name}</span>
                  <span className="text-muted-foreground text-xs">(Kế toán)</span>
                </div>
                <Button
                  data-testid="button-logout"
                  variant="ghost" size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                </Button>
              </>
            ) : (
              <Button
                data-testid="button-login"
                size="sm" className="gap-2"
                onClick={handleLogin}
                disabled={isLoggingIn || isLoadingMaster}
              >
                {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                {isLoggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">
        <div className="bg-card border rounded-lg p-5 shadow-sm space-y-5">

          {/* Row 1: Ngày + Kế toán */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ngày</Label>
              <div data-testid="text-date" className="h-9 px-3 flex items-center rounded-md border bg-muted/50 text-sm font-medium">
                {today}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kế toán</Label>
              <div
                data-testid="text-accountant"
                className={cn(
                  "h-9 px-3 flex items-center rounded-md border text-sm",
                  loggedInUser ? "bg-muted/50 font-medium" : "bg-muted/30 text-muted-foreground italic"
                )}
              >
                {loggedInUser?.full_name ?? "Chưa đăng nhập"}
              </div>
            </div>
          </div>

          {/* Row 2: 3-cấp dropdown từ Supabase */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Phân loại đơn vị</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Khối */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Khối kinh doanh</Label>
                <Select value={selectedPlanId} onValueChange={handleKhoiChange} disabled={isLoadingMaster}>
                  <SelectTrigger data-testid="select-khoi" className="h-9">
                    <SelectValue placeholder={isLoadingMaster ? "Đang tải..." : "Chọn khối..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {khoiOptions.map((k) => (
                      <SelectItem key={k.plan_id} value={String(k.plan_id)} data-testid={`option-khoi-${k.plan_id}`}>
                        {k.plan_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Công ty */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Công ty</Label>
                <Select value={selectedCompanyId} onValueChange={handleCtyChange} disabled={!selectedPlanId}>
                  <SelectTrigger data-testid="select-cty" className="h-9">
                    <SelectValue placeholder={selectedPlanId ? "Chọn công ty..." : "Chọn khối trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    {companiesForKhoi.map((c) => (
                      <SelectItem key={c.company_id} value={String(c.company_id)} data-testid={`option-cty-${c.company_id}`}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Center */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cost Center</Label>
                <Select value={selectedCC} onValueChange={setSelectedCC} disabled={!selectedCompanyId}>
                  <SelectTrigger data-testid="select-cc" className="h-9">
                    <SelectValue placeholder={selectedCompanyId ? "Chọn cost center..." : "Chọn công ty trước"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ccForCompany.map((cc) => (
                      <SelectItem key={cc.cost_center_code} value={cc.cost_center_code} data-testid={`option-cc-${cc.cost_center_code}`}>
                        [{cc.cost_center_code}] {cc.cost_center_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Breadcrumb đã chọn */}
            {(selectedPlanId || selectedCompanyId || selectedCC) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {selectedPlanId && <Badge variant="secondary" className="font-normal">{selectedKhoiLabel}</Badge>}
                {selectedCompanyId && (<><span>›</span><Badge variant="secondary" className="font-normal">{selectedCtyLabel}</Badge></>)}
                {selectedCC && (<><span>›</span><Badge variant="secondary" className="font-normal">[{selectedCC}] {selectedCCLabel}</Badge></>)}
              </div>
            )}
          </div>

          {/* Row 3: Upload + Submit */}
          <div className="pt-4 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Upload File</Label>
              <Button
                data-testid="button-upload"
                variant="outline" size="sm" className="gap-2 shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" /> Chọn file
              </Button>
              <input
                ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
                className="hidden" onChange={handleFileChange} data-testid="input-file"
              />

              <div
                className={cn(
                  "flex-1 h-9 min-w-0 rounded-md border-2 border-dashed px-3 flex items-center text-sm text-muted-foreground transition-colors cursor-pointer",
                  isDragging && "border-primary bg-primary/5 text-primary",
                  fileName && "border-solid border-border"
                )}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone"
              >
                {fileName
                  ? <span className="font-medium text-foreground truncate">{fileName}</span>
                  : <span className="truncate">Kéo thả file vào đây (CSV, XLSX)</span>
                }
              </div>

              {validationStatus === "validating" && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" /><span>Kiểm tra...</span>
                </div>
              )}
              {validationStatus === "valid" && (
                <Badge data-testid="badge-valid" variant="secondary" className="gap-1.5 bg-green-100 text-green-700 border-green-200 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                </Badge>
              )}
              {validationStatus === "invalid" && (
                <Badge data-testid="badge-invalid" variant="destructive" className="gap-1.5 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" /> Lỗi định dạng
                </Badge>
              )}

              <Button
                data-testid="button-submit"
                onClick={handleSubmit}
                disabled={isSubmitting || validationStatus !== "valid" || !loggedInUser}
                className="gap-2 shrink-0" size="sm"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit
              </Button>
            </div>

            {validationStatus === "invalid" && validationError && (
              <div data-testid="error-validation" className="mt-2.5 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Preview table */}
        {rows.length > 0 ? (
          <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Dữ liệu Preview</h2>
              <span className="text-xs text-muted-foreground">Hiển thị {rows.length} dòng</span>
            </div>
            <div className="overflow-x-auto">
              <Table data-testid="table-preview">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {headers.map((col) => (
                      <TableHead key={col} className="text-xs font-semibold text-foreground whitespace-nowrap px-3 py-2 border-r last:border-r-0">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx} data-testid={`row-data-${idx}`} className="hover:bg-muted/30">
                      {headers.map((col) => (
                        <TableCell key={col} className="text-xs px-3 py-1.5 whitespace-nowrap border-r last:border-r-0">
                          {row[col] !== undefined && row[col] !== null ? String(row[col]) : ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="bg-card border rounded-lg shadow-sm">
            <div className="px-5 py-3 border-b">
              <h2 className="font-semibold text-sm">Dữ liệu Preview</h2>
            </div>
            <div className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
              <FileSpreadsheet className="w-10 h-10 opacity-25" />
              <p className="text-sm">Upload file để xem preview dữ liệu</p>
              <p className="text-xs opacity-60 text-center max-w-lg">
                Yêu cầu đúng các cột: {REQUIRED_COLUMNS.join(" · ")}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
