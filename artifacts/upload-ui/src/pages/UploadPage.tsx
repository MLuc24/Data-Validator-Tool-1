import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, LogIn, LogOut, UserCircle2,
  Building2, Layers3, MapPin, CloudUpload, ChevronRight,
  Calendar, ClipboardList, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type {
  AppUser, UserMapping, CostCenter, Company, Plan,
  UploadBatchInsert, UploadRowInsert,
} from "@/types/supabase";

const REQUIRED_COLUMNS = [
  "Ngày", "Mã hệ thống", "Nhóm chỉ tiêu", "Khoản mục", "Tiểu mục",
  "Thuộc tính", "Nội dung", "Công ty", "Loại dữ liệu", "Khối", "Bộ phận", "Số tiền",
];

const ALL = "__all__";

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

  // ── Master data (static, loaded once) ─────────────────────
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allCostCenters, setAllCostCenters] = useState<CostCenter[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoadingMaster(true);
      const [uRes, coRes, ccRes, pRes] = await Promise.all([
        supabase.from("users").select("id, full_name, email, is_active").eq("is_active", true),
        supabase.from("companies").select("company_id, company_name"),
        supabase.from("cost_centers").select("cost_center_id, cost_center_name, company_id, plan_id"),
        supabase.from("plans").select("plan_id, plan_name"),
      ]);
      if (uRes.data) setAllUsers(uRes.data as AppUser[]);
      if (coRes.data) setAllCompanies(coRes.data as Company[]);
      if (ccRes.data) setAllCostCenters(ccRes.data as CostCenter[]);
      if (pRes.data) setAllPlans(pRes.data as Plan[]);
      setIsLoadingMaster(false);
    };
    load();
  }, []);

  // ── Login ──────────────────────────────────────────────────
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userMapping, setUserMapping] = useState<UserMapping[]>([]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    await new Promise((r) => setTimeout(r, 600));
    const active = allUsers.filter((u) => u.is_active);
    if (!active.length) {
      toast({ title: "Lỗi", description: "Không có kế toán nào trong hệ thống.", variant: "destructive" });
      setIsLoggingIn(false);
      return;
    }
    const user = active[Math.floor(Math.random() * active.length)];

    // Load user's mapping
    const { data: mappingData } = await supabase
      .from("users_mapping")
      .select("id, user_id, company_id, plan_id, cost_center_id")
      .eq("user_id", user.id);

    setLoggedInUser(user);
    setUserMapping(mappingData as UserMapping[] ?? []);
    // Reset dropdowns to "all"
    setSelectedCompanyId(ALL);
    setSelectedCCId(ALL);
    setSelectedPlanId(ALL);
    setIsLoggingIn(false);
    toast({ title: `Xin chào, ${user.full_name}!`, description: "Đã tải dữ liệu phân quyền." });
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setUserMapping([]);
    setSelectedCompanyId(ALL);
    setSelectedCCId(ALL);
    setSelectedPlanId(ALL);
  };

  // ── Derived dropdown options (scoped to user mapping) ─────
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(ALL);
  const [selectedCCId, setSelectedCCId] = useState<string>(ALL);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(ALL);

  // Companies the user can see
  const userCompanyIds = [...new Set(userMapping.map((m) => m.company_id))];
  const userCompanies = allCompanies
    .filter((c) => userCompanyIds.includes(c.company_id))
    .sort((a, b) => a.company_id.localeCompare(b.company_id));

  // Cost centers: filter mapping by selected company
  const mappingForCompany = selectedCompanyId === ALL
    ? userMapping
    : userMapping.filter((m) => m.company_id === selectedCompanyId);

  const userCCIds = [...new Set(mappingForCompany.map((m) => m.cost_center_id))];
  const userCostCenters = allCostCenters
    .filter((cc) => userCCIds.includes(cc.cost_center_id))
    .sort((a, b) => a.cost_center_id.localeCompare(b.cost_center_id));

  // Plans: filter mapping by selected company
  const userPlanIds = [...new Set(mappingForCompany.map((m) => m.plan_id))];
  const userPlans = allPlans
    .filter((p) => userPlanIds.includes(p.plan_id))
    .sort((a, b) => a.plan_id - b.plan_id);

  const handleCompanyChange = (val: string) => {
    setSelectedCompanyId(val);
    setSelectedCCId(ALL);
    setSelectedPlanId(ALL);
  };

  // Resolved labels for display
  const selectedCompany = userCompanies.find((c) => c.company_id === selectedCompanyId);
  const selectedCC = userCostCenters.find((cc) => cc.cost_center_id === selectedCCId);
  const selectedPlan = userPlans.find((p) => String(p.plan_id) === selectedPlanId);

  // For submit: resolve actual values (if "all" but only 1 option, auto-use it)
  const resolvedCompanyId = selectedCompanyId !== ALL ? selectedCompanyId
    : userCompanies.length === 1 ? userCompanies[0].company_id : null;
  const resolvedCCId = selectedCCId !== ALL ? selectedCCId
    : userCostCenters.length === 1 ? userCostCenters[0].cost_center_id : null;

  // ── File upload ────────────────────────────────────────────
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [totalRows, setTotalRows] = useState<number>(0);
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
      setRows([]); setHeaders([]); setFileName(""); setFileSize(0);
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setValidationStatus("validating");
    setValidationError("");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<RowData>(ws, { raw: false, dateNF: "dd/mm/yyyy" });
      if (!jsonData.length) {
        setValidationStatus("invalid"); setValidationError("File không có dữ liệu."); setRows([]); setHeaders([]); return;
      }
      const fileHeaders = Object.keys(jsonData[0]);
      const missing = REQUIRED_COLUMNS.filter((col) => !fileHeaders.some((h) => h.trim() === col));
      if (missing.length) {
        setValidationStatus("invalid");
        setValidationError(`Thiếu ${missing.length} cột: ${missing.join(", ")}`);
        setRows([]); setHeaders([]); return;
      }
      setTotalRows(jsonData.length);
      setHeaders(REQUIRED_COLUMNS);
      setRows(jsonData.slice(0, 200));
      setValidationStatus("valid");
      toast({ title: "✓ File hợp lệ", description: `${jsonData.length.toLocaleString()} dòng dữ liệu.` });
    } catch {
      setValidationStatus("invalid");
      setValidationError("Không thể đọc file. Hãy kiểm tra lại định dạng.");
      setRows([]); setHeaders([]);
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file); e.target.value = "";
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) parseFile(file);
  };
  const handleClearFile = () => {
    setFileName(""); setFileSize(0); setTotalRows(0);
    setRows([]); setHeaders([]); setValidationStatus("idle"); setValidationError("");
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!loggedInUser) {
      toast({ title: "Vui lòng đăng nhập trước.", variant: "destructive" }); return;
    }
    if (!resolvedCompanyId) {
      toast({ title: "Vui lòng chọn Công ty cụ thể trước khi submit.", variant: "destructive" }); return;
    }
    if (!resolvedCCId) {
      toast({ title: "Vui lòng chọn Cost Center cụ thể trước khi submit.", variant: "destructive" }); return;
    }
    if (validationStatus !== "valid" || !rows.length) {
      toast({ title: "Vui lòng upload file hợp lệ.", variant: "destructive" }); return;
    }

    setIsSubmitting(true);
    try {
      const batch: UploadBatchInsert = {
        upload_date: new Date().toISOString().split("T")[0],
        accountant_name: loggedInUser.full_name,
        company_id: resolvedCompanyId,
        cost_center_code: resolvedCCId,
        bp: selectedPlanId !== ALL ? selectedPlanId : null,
        file_name: fileName,
        file_type: fileName.split(".").pop()?.toLowerCase() ?? "unknown",
        total_rows: totalRows, preview_rows: Math.min(rows.length, 200),
        status: "submitted", uploaded_by: loggedInUser.id, note: null,
      };
      const { data: batchData, error: batchError } = await supabase
        .from("upload_batches").insert(batch).select("batch_id").single();
      if (batchError) throw batchError;

      const batchId = batchData.batch_id as string;
      const uploadRows: UploadRowInsert[] = rows.map((row, idx) => ({
        batch_id: batchId, row_number: idx + 1,
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

      for (let i = 0; i < uploadRows.length; i += 500) {
        const { error } = await supabase.from("upload_rows").insert(uploadRows.slice(i, i + 500));
        if (error) throw error;
      }

      toast({ title: "Submit thành công!", description: `${totalRows.toLocaleString()} dòng đã được lưu.` });
      handleClearFile();
    } catch (err) {
      toast({
        title: "Submit thất bại",
        description: err instanceof Error ? err.message : "Lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !!loggedInUser && !!resolvedCompanyId && !!resolvedCCId
    && validationStatus === "valid" && !isSubmitting;

  const notLoggedIn = !loggedInUser;

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      {/* ── Header ── */}
      <header className="bg-white border-b border-border/60 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm text-foreground">Kế Toán Upload</span>
              <span className="hidden sm:inline text-muted-foreground text-xs ml-2">/ Nhập liệu dữ liệu tài chính</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLoadingMaster && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="hidden sm:inline">Đang tải...</span>
              </span>
            )}
            {loggedInUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full pl-2 pr-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <UserCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-primary" data-testid="text-logged-user">
                    {loggedInUser.full_name}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5" data-testid="button-logout">
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleLogin}
                disabled={isLoggingIn || isLoadingMaster}
                className="h-8 gap-2 rounded-full px-4 shadow-sm" data-testid="button-login">
                {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                {isLoggingIn ? "Đang xử lý..." : "Đăng nhập"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Info strip ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-border/60 rounded-xl px-4 py-2.5 shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Ngày</span>
            <span className="text-xs font-semibold text-foreground ml-1" data-testid="text-date">{today}</span>
          </div>
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-xs border transition-all duration-200",
            loggedInUser ? "bg-emerald-50 border-emerald-200" : "bg-white border-border/60"
          )}>
            <UserCircle2 className={cn("w-3.5 h-3.5", loggedInUser ? "text-emerald-600" : "text-muted-foreground")} />
            <span className="text-xs text-muted-foreground">Kế toán</span>
            <span className={cn("text-xs font-semibold ml-1", loggedInUser ? "text-emerald-700" : "text-muted-foreground italic")}
              data-testid="text-accountant">
              {loggedInUser?.full_name ?? "Chưa đăng nhập"}
            </span>
          </div>
        </div>

        {/* ── Phân loại đơn vị ── */}
        <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers3 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Phân loại đơn vị</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {notLoggedIn
                  ? "Đăng nhập để xem danh sách đơn vị được phân quyền"
                  : `${userMapping.length} cost center được phân quyền`}
              </p>
            </div>
            {/* Summary breadcrumb */}
            {loggedInUser && (selectedCompanyId !== ALL || selectedCCId !== ALL || selectedPlanId !== ALL) && (
              <div className="hidden sm:flex items-center gap-1 text-xs bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5">
                {selectedCompanyId !== ALL && (
                  <><Building2 className="w-3 h-3 text-primary" />
                  <span className="font-medium text-primary">{selectedCompany?.company_name ?? selectedCompanyId}</span></>
                )}
                {selectedCCId !== ALL && (
                  <><ChevronRight className="w-3 h-3 text-primary/50" />
                  <span className="font-mono text-primary text-[11px]">[{selectedCCId}]</span></>
                )}
                {selectedPlanId !== ALL && (
                  <><ChevronRight className="w-3 h-3 text-primary/50" />
                  <span className="text-primary">{selectedPlan?.plan_name}</span></>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Công ty */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> Công ty
                </Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={handleCompanyChange}
                  disabled={notLoggedIn || isLoggingIn}
                >
                  <SelectTrigger data-testid="select-cty"
                    className={cn("h-10 rounded-xl border-border/70 transition-colors",
                      notLoggedIn ? "bg-muted/40 opacity-60" : "bg-[#f8f9fc] hover:bg-white focus:bg-white")}>
                    <SelectValue placeholder="Đăng nhập trước..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>
                      <span className="text-muted-foreground font-medium">Tất cả ({userCompanies.length})</span>
                    </SelectItem>
                    {userCompanies.map((c) => (
                      <SelectItem key={c.company_id} value={c.company_id}>
                        <span className="font-mono text-primary text-[11px] mr-1.5">[{c.company_id}]</span>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Center */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> Cost Center
                </Label>
                <Select
                  value={selectedCCId}
                  onValueChange={setSelectedCCId}
                  disabled={notLoggedIn || isLoggingIn}
                >
                  <SelectTrigger data-testid="select-cc"
                    className={cn("h-10 rounded-xl border-border/70 transition-colors",
                      notLoggedIn ? "bg-muted/40 opacity-60" : "bg-[#f8f9fc] hover:bg-white focus:bg-white")}>
                    <SelectValue placeholder="Đăng nhập trước..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>
                      <span className="text-muted-foreground font-medium">Tất cả ({userCostCenters.length})</span>
                    </SelectItem>
                    {userCostCenters.map((cc) => (
                      <SelectItem key={cc.cost_center_id} value={cc.cost_center_id}>
                        <span className="font-mono text-primary text-[11px] mr-1.5">[{cc.cost_center_id}]</span>
                        {cc.cost_center_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Khối */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Layers3 className="w-3.5 h-3.5 text-primary" /> Khối kinh doanh
                </Label>
                <Select
                  value={selectedPlanId}
                  onValueChange={setSelectedPlanId}
                  disabled={notLoggedIn || isLoggingIn}
                >
                  <SelectTrigger data-testid="select-khoi"
                    className={cn("h-10 rounded-xl border-border/70 transition-colors",
                      notLoggedIn ? "bg-muted/40 opacity-60" : "bg-[#f8f9fc] hover:bg-white focus:bg-white")}>
                    <SelectValue placeholder="Đăng nhập trước..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value={ALL}>
                      <span className="text-muted-foreground font-medium">Tất cả ({userPlans.length})</span>
                    </SelectItem>
                    {userPlans.map((p) => (
                      <SelectItem key={p.plan_id} value={String(p.plan_id)}>
                        {p.plan_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Submit requires specific company + CC notice */}
            {loggedInUser && (selectedCompanyId === ALL || selectedCCId === ALL) && (
              <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Để submit dữ liệu, bạn cần chọn cụ thể Công ty và Cost Center.
              </p>
            )}
          </div>
        </div>

        {/* ── Upload card ── */}
        <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Upload File dữ liệu</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Hỗ trợ CSV, XLSX · Tối đa 200 dòng preview</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Drop zone */}
            {!fileName ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                data-testid="dropzone"
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/50 hover:bg-primary/3"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                  isDragging ? "bg-primary/15" : "bg-muted"
                )}>
                  <CloudUpload className={cn("w-7 h-7", isDragging ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Kéo thả file vào đây</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    hoặc <span className="text-primary font-medium underline underline-offset-2">chọn file</span> từ máy tính
                  </p>
                </div>
                <div className="flex gap-2">
                  {["CSV", "XLSX", "XLS"].map((f) => (
                    <span key={f} className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded-md text-muted-foreground">.{f}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className={cn(
                "rounded-2xl border p-4 flex items-center gap-4 transition-all duration-200",
                validationStatus === "valid" ? "border-emerald-200 bg-emerald-50/60" :
                validationStatus === "invalid" ? "border-red-200 bg-red-50/60" :
                "border-border bg-muted/30"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  validationStatus === "valid" ? "bg-emerald-100" :
                  validationStatus === "invalid" ? "bg-red-100" : "bg-muted"
                )}>
                  {validationStatus === "validating" ? (
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  ) : validationStatus === "valid" ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : validationStatus === "invalid" ? (
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  ) : (
                    <FileSpreadsheet className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{(fileSize / 1024).toFixed(1)} KB</span>
                    {validationStatus === "valid" && (
                      <span className="text-xs text-emerald-600 font-medium">{totalRows.toLocaleString()} dòng · Hợp lệ</span>
                    )}
                    {validationStatus === "invalid" && (
                      <span className="text-xs text-red-500 font-medium">Lỗi định dạng</span>
                    )}
                    {validationStatus === "validating" && (
                      <span className="text-xs text-muted-foreground">Đang kiểm tra...</span>
                    )}
                  </div>
                  {validationStatus === "invalid" && validationError && (
                    <p className="text-xs text-red-500 mt-1">{validationError}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={handleClearFile}
                  className="text-muted-foreground hover:text-foreground shrink-0 h-8 px-2 rounded-lg text-xs">
                  Xóa
                </Button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
              className="hidden" onChange={handleFileChange} data-testid="input-file" />

            {/* Actions row */}
            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 rounded-xl h-9 border-border/70" data-testid="button-upload">
                <Upload className="w-3.5 h-3.5" />
                {fileName ? "Thay file khác" : "Chọn file"}
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                size="sm"
                className="gap-2 rounded-xl h-9 px-6 shadow-sm font-semibold"
                data-testid="button-submit"
              >
                {isSubmitting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang gửi...</>
                  : <><ClipboardList className="w-3.5 h-3.5" />Submit</>
                }
              </Button>
            </div>
          </div>
        </div>

        {/* ── Preview table ── */}
        <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Dữ liệu Preview</h2>
            </div>
            {rows.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full">
                {rows.length.toLocaleString()} / {totalRows.toLocaleString()} dòng
              </span>
            )}
          </div>

          {rows.length > 0 ? (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <Table data-testid="table-preview">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-[#f4f6fb] hover:bg-[#f4f6fb] border-b border-border/50">
                    <TableHead className="text-[10px] font-bold text-muted-foreground w-10 px-3 py-2.5 text-center">#</TableHead>
                    {headers.map((col) => (
                      <TableHead key={col}
                        className="text-[10px] font-bold text-foreground whitespace-nowrap px-3 py-2.5 border-l border-border/30 first:border-l-0">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx} data-testid={`row-data-${idx}`}
                      className={cn("border-b border-border/30 hover:bg-primary/3 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-[#fafbfd]")}>
                      <TableCell className="text-[10px] text-muted-foreground text-center px-3 py-1.5 font-mono">{idx + 1}</TableCell>
                      {headers.map((col) => (
                        <TableCell key={col}
                          className="text-xs px-3 py-1.5 whitespace-nowrap border-l border-border/20 first:border-l-0 font-mono text-[11px]">
                          {row[col] !== undefined && row[col] !== null ? String(row[col]) : (
                            <span className="text-muted-foreground/40">—</span>
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
              <p className="text-sm font-medium text-muted-foreground">Chưa có dữ liệu</p>
              <p className="text-xs text-muted-foreground/70 text-center max-w-sm">
                Upload file để xem preview. Yêu cầu đúng {REQUIRED_COLUMNS.length} cột theo định dạng.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
