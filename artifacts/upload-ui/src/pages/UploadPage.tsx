import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, LogIn, LogOut, UserCircle2,
  Building2, Layers3, MapPin, CloudUpload, ChevronRight,
  Calendar, ClipboardList, Upload, ChevronDown, Users,
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
  const [loginPopoverOpen, setLoginPopoverOpen] = useState(false);
  // Pre-fetched mapping counts per user for display in picker
  const [allMappings, setAllMappings] = useState<UserMapping[]>([]);

  useEffect(() => {
    supabase.from("users_mapping").select("*").then(({ data }) => {
      if (data) setAllMappings(data as UserMapping[]);
    });
  }, []);

  const handleLoginAs = async (user: AppUser) => {
    setLoginPopoverOpen(false);
    setIsLoggingIn(true);
    const { data: mappingData } = await supabase
      .from("users_mapping")
      .select("id, user_id, company_id, plan_id, cost_center_id")
      .eq("user_id", user.id);
    setLoggedInUser(user);
    setUserMapping(mappingData as UserMapping[] ?? []);
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

  // Helper: initials avatar color per user index
  const avatarColors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  ];
  const getInitials = (name: string) =>
    name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();

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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ── Data-vs-filter validation ────────────────────────────────
  const validateDataAgainstFilters = useCallback((
    data: RowData[],
    companyId: string,
    ccId: string,
    planId: string,
  ): string[] => {
    if (!data.length || !loggedInUser) return [];
    const errs: string[] = [];

    // Build permitted sets scoped to current company filter
    const scopedMapping = companyId === ALL
      ? userMapping
      : userMapping.filter(m => m.company_id === companyId);

    // --- Công ty ---
    const permittedCompanyIds = companyId === ALL
      ? [...new Set(userMapping.map(m => m.company_id))]
      : [companyId];
    const permittedCompanies = allCompanies.filter(c => permittedCompanyIds.includes(c.company_id));
    const companyValidValues = new Set([
      ...permittedCompanies.map(c => c.company_name.toLowerCase().trim()),
      ...permittedCompanyIds.map(id => id.toLowerCase().trim()),
    ]);

    // --- Khối ---
    const permittedPlanIds = planId === ALL
      ? [...new Set(scopedMapping.map(m => m.plan_id))]
      : [Number(planId)];
    const permittedPlans = allPlans.filter(p => permittedPlanIds.includes(p.plan_id));
    const planValidValues = new Set(permittedPlans.map(p => p.plan_name.toLowerCase().trim()));

    // --- Cost Center (Bộ phận) ---
    const permittedCCIds = ccId === ALL
      ? [...new Set(scopedMapping.map(m => m.cost_center_id))]
      : [ccId];
    const permittedCCs = allCostCenters.filter(cc => permittedCCIds.includes(cc.cost_center_id));
    const ccValidValues = new Set([
      ...permittedCCs.map(cc => cc.cost_center_name.toLowerCase().trim()),
      ...permittedCCIds.map(id => id.toLowerCase().trim()),
    ]);

    const companyErrRows: number[] = [];
    const planErrRows: number[] = [];
    const ccErrRows: number[] = [];

    data.forEach((row, i) => {
      const rowNum = i + 2; // 1-based + header
      const cty = String(row["Công ty"] ?? "").toLowerCase().trim();
      if (cty && !companyValidValues.has(cty)) companyErrRows.push(rowNum);

      const khoi = String(row["Khối"] ?? "").toLowerCase().trim();
      if (khoi && !planValidValues.has(khoi)) planErrRows.push(rowNum);

      const bp = String(row["Bộ phận"] ?? "").toLowerCase().trim();
      if (bp && !ccValidValues.has(bp)) ccErrRows.push(rowNum);
    });

    if (companyErrRows.length) {
      const allowed = permittedCompanies.map(c => c.company_name).join(", ");
      errs.push(`Cột "Công ty": ${companyErrRows.length} dòng không hợp lệ. Cho phép: ${allowed}`);
    }
    if (planErrRows.length) {
      const allowed = permittedPlans.map(p => p.plan_name).join(", ");
      errs.push(`Cột "Khối": ${planErrRows.length} dòng không hợp lệ. Cho phép: ${allowed}`);
    }
    if (ccErrRows.length) {
      const allowed = permittedCCs.map(cc => cc.cost_center_name).join(", ");
      errs.push(`Cột "Bộ phận": ${ccErrRows.length} dòng không hợp lệ. Cho phép: ${allowed}`);
    }
    return errs;
  }, [loggedInUser, userMapping, allCompanies, allCostCenters, allPlans]);

  // Re-validate when filter selections change (if file already loaded)
  useEffect(() => {
    if (!fileName || validationStatus === "idle" || validationStatus === "validating") return;
    // Only re-run data validation if we currently have rows (i.e. previous parse was clean)
    if (!rows.length) return;
    const errs = validateDataAgainstFilters(rows, selectedCompanyId, selectedCCId, selectedPlanId);
    if (errs.length) {
      setValidationErrors(errs);
      setValidationStatus("invalid");
      setRows([]); setHeaders([]); setTotalRows(0);
    } else {
      setValidationErrors([]);
      setValidationStatus("valid");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, selectedCCId, selectedPlanId]);

  const parseFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setValidationStatus("invalid");
      setValidationErrors(["Chỉ chấp nhận file CSV hoặc XLSX/XLS."]);
      setRows([]); setHeaders([]); setFileName(""); setFileSize(0);
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setValidationStatus("validating");
    setValidationErrors([]);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<RowData>(ws, { raw: false, dateNF: "dd/mm/yyyy" });

      const structuralErrors: string[] = [];

      if (!jsonData.length) {
        setValidationStatus("invalid");
        setValidationErrors(["File không có dữ liệu."]);
        setRows([]); setHeaders([]); return;
      }

      const fileHeaders = Object.keys(jsonData[0]).map(h => h.trim());

      // 1. Check for missing columns
      const missing = REQUIRED_COLUMNS.filter(col => !fileHeaders.includes(col));
      if (missing.length) {
        structuralErrors.push(`Thiếu ${missing.length} cột: ${missing.join(", ")}`);
      }

      // 2. Check column ORDER for columns that do exist
      if (!missing.length) {
        const orderErrors: string[] = [];
        REQUIRED_COLUMNS.forEach((col, expectedIdx) => {
          const actualIdx = fileHeaders.indexOf(col);
          if (actualIdx !== expectedIdx) {
            orderErrors.push(`"${col}" (vị trí ${actualIdx + 1}, cần ${expectedIdx + 1})`);
          }
        });
        if (orderErrors.length) {
          structuralErrors.push(`Sai thứ tự ${orderErrors.length} cột: ${orderErrors.join("; ")}`);
        }
      }

      // 3. Extra unknown columns
      const extra = fileHeaders.filter(h => !REQUIRED_COLUMNS.includes(h));
      if (extra.length) {
        structuralErrors.push(`${extra.length} cột không nhận dạng: ${extra.join(", ")}`);
      }

      if (structuralErrors.length) {
        setValidationStatus("invalid");
        setValidationErrors(structuralErrors);
        setRows([]); setHeaders([]); return;
      }

      // 4. Data content validation against filters
      const dataErrors = validateDataAgainstFilters(jsonData, selectedCompanyId, selectedCCId, selectedPlanId);

      if (dataErrors.length) {
        // Errors found → do NOT populate preview
        setValidationStatus("invalid");
        setValidationErrors(dataErrors);
        setRows([]); setHeaders([]); setTotalRows(0);
        toast({ title: "File có lỗi dữ liệu", variant: "destructive" });
      } else {
        // All clear → populate preview
        setTotalRows(jsonData.length);
        setHeaders(REQUIRED_COLUMNS);
        setRows(jsonData.slice(0, 200));
        setValidationStatus("valid");
        setValidationErrors([]);
        toast({ title: "✓ File hợp lệ", description: `${jsonData.length.toLocaleString()} dòng dữ liệu.` });
      }
    } catch {
      setValidationStatus("invalid");
      setValidationErrors(["Không thể đọc file. Hãy kiểm tra lại định dạng file."]);
      setRows([]); setHeaders([]);
    }
  }, [toast, validateDataAgainstFilters, selectedCompanyId, selectedCCId, selectedPlanId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file); e.target.value = "";
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) parseFile(file);
  };
  const handleClearFile = () => {
    setFileName(""); setFileSize(0); setTotalRows(0);
    setRows([]); setHeaders([]); setValidationStatus("idle"); setValidationErrors([]);
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
      const resolvedPlanId = selectedPlanId !== ALL ? Number(selectedPlanId) : null;

      const batch: UploadBatchInsert = {
        uploaded_by: loggedInUser.id,
        file_name: fileName,
        original_file_name: fileName,
        note: null,
        total_rows: totalRows,
        success_rows: rows.length,
        failed_rows: 0,
        status: "completed",
      };

      const { data: batchData, error: batchError } = await supabase
        .from("upload_batches").insert(batch).select("id").single();
      if (batchError) throw new Error(batchError.message || batchError.details || JSON.stringify(batchError));

      const batchId = batchData.id as number;

      const uploadRows: UploadRowInsert[] = rows.map((row, idx) => {
        const maHt = row["Mã hệ thống"];
        const maHtNum = maHt !== undefined && maHt !== null && maHt !== ""
          ? parseInt(String(maHt).replace(/[^0-9]/g, ""), 10) || null
          : null;
        return {
          batch_id: batchId,
          row_no: idx + 1,
          ngay: parseDate(row["Ngày"] as string),
          ma_he_thong: maHtNum,
          nhom_chi_tieu: row["Nhóm chỉ tiêu"] ? String(row["Nhóm chỉ tiêu"]) : null,
          khoan_muc: row["Khoản mục"] ? String(row["Khoản mục"]) : null,
          tieu_muc: row["Tiểu mục"] ? String(row["Tiểu mục"]) : null,
          thuoc_tinh: row["Thuộc tính"] ? String(row["Thuộc tính"]) : null,
          noi_dung: row["Nội dung"] ? String(row["Nội dung"]) : null,
          cong_ty: row["Công ty"] ? String(row["Công ty"]) : null,
          loai_du_lieu: row["Loại dữ liệu"] ? String(row["Loại dữ liệu"]) : null,
          khoi: row["Khối"] ? String(row["Khối"]) : null,
          bo_phan: row["Bộ phận"] ? String(row["Bộ phận"]) : null,
          so_tien: parseAmount(row["Số tiền"]),
          company_id: resolvedCompanyId,
          plan_id: resolvedPlanId,
          cost_center_id: resolvedCCId,
          created_by: loggedInUser.id,
          is_valid: true,
          error_message: null,
        };
      });

      for (let i = 0; i < uploadRows.length; i += 500) {
        const { error } = await supabase.from("upload_rows").insert(uploadRows.slice(i, i + 500));
        if (error) throw new Error(error.message || error.details || JSON.stringify(error));
      }

      toast({ title: "Submit thành công!", description: `${totalRows.toLocaleString()} dòng đã được lưu.` });
      handleClearFile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast({ title: "Submit thất bại", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !isSubmitting;

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
                {/* Switch user */}
                <Popover open={loginPopoverOpen} onOpenChange={setLoginPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full pl-2 pr-3 py-1.5 hover:bg-primary/12 transition-colors" data-testid="user-pill">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                        avatarColors[allUsers.findIndex(u => u.id === loggedInUser.id) % avatarColors.length])}>
                        {getInitials(loggedInUser.full_name)}
                      </div>
                      <span className="text-xs font-semibold text-primary" data-testid="text-logged-user">
                        {loggedInUser.full_name}
                      </span>
                      <ChevronDown className="w-3 h-3 text-primary/60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-2 rounded-2xl shadow-lg">
                    <p className="text-[11px] font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">Chuyển tài khoản</p>
                    <div className="space-y-0.5">
                      {allUsers.filter(u => u.is_active).map((u, i) => {
                        const uMappings = allMappings.filter(m => m.user_id === u.id);
                        const uCompanies = [...new Set(uMappings.map(m => m.company_id))];
                        const isActive = loggedInUser.id === u.id;
                        return (
                          <button key={u.id} onClick={() => handleLoginAs(u)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                              isActive ? "bg-primary/10" : "hover:bg-muted"
                            )}>
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColors[i % avatarColors.length])}>
                              {getInitials(u.full_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-semibold truncate", isActive ? "text-primary" : "text-foreground")}>{u.full_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                              <div className="flex gap-2 mt-0.5">
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{uCompanies.length} cty</span>
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{uMappings.length} CC</span>
                              </div>
                            </div>
                            {isActive && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-border/50 mt-2 pt-2">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 transition-colors">
                        <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Popover open={loginPopoverOpen} onOpenChange={setLoginPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm"
                    disabled={isLoggingIn || isLoadingMaster}
                    className="h-8 gap-2 rounded-full px-4 shadow-sm" data-testid="button-login">
                    {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                    {isLoggingIn ? "Đang xử lý..." : "Đăng nhập"}
                    {!isLoggingIn && <ChevronDown className="w-3 h-3 opacity-70" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2 rounded-2xl shadow-lg">
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Chọn tài khoản</p>
                  </div>
                  <div className="space-y-0.5">
                    {allUsers.filter(u => u.is_active).map((u, i) => {
                      const uMappings = allMappings.filter(m => m.user_id === u.id);
                      const uCompanies = [...new Set(uMappings.map(m => m.company_id))];
                      return (
                        <button key={u.id} onClick={() => handleLoginAs(u)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors group">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColors[i % avatarColors.length])}>
                            {getInitials(u.full_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{u.full_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{uCompanies.length} cty</span>
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{uMappings.length} CC</span>
                            </div>
                          </div>
                          <LogIn className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">

        {/* ── Top row: info strip (compact, inline) ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-border/60 rounded-lg px-3 py-1.5 shadow-xs">
            <Calendar className="w-3 h-3 text-primary" />
            <span className="text-[11px] text-muted-foreground">Ngày</span>
            <span className="text-[11px] font-semibold text-foreground ml-0.5" data-testid="text-date">{today}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 shadow-xs border transition-all duration-200",
            loggedInUser ? "bg-emerald-50 border-emerald-200" : "bg-white border-border/60"
          )}>
            <UserCircle2 className={cn("w-3 h-3", loggedInUser ? "text-emerald-600" : "text-muted-foreground")} />
            <span className="text-[11px] text-muted-foreground">Kế toán</span>
            <span className={cn("text-[11px] font-semibold ml-0.5", loggedInUser ? "text-emerald-700" : "text-muted-foreground italic")}
              data-testid="text-accountant">
              {loggedInUser?.full_name ?? "Chưa đăng nhập"}
            </span>
          </div>
          {/* Summary breadcrumb when filters active */}
          {loggedInUser && (selectedCompanyId !== ALL || selectedCCId !== ALL) && (
            <div className="flex items-center gap-1 text-[11px] bg-primary/6 border border-primary/15 rounded-lg px-3 py-1.5">
              {selectedCompanyId !== ALL && <span className="font-medium text-primary">{selectedCompany?.company_id}</span>}
              {selectedCCId !== ALL && <><ChevronRight className="w-3 h-3 text-primary/40" /><span className="font-mono text-primary">{selectedCCId}</span></>}
              {selectedPlanId !== ALL && <><ChevronRight className="w-3 h-3 text-primary/40" /><span className="text-primary">{selectedPlan?.plan_name}</span></>}
            </div>
          )}
        </div>

        {/* ── Main 2-column row: [Dropdowns | Upload+Submit] ── */}
        <div className="flex gap-4 items-stretch">

          {/* LEFT: Phân loại đơn vị (wider) */}
          <div className="flex-1 bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-border/40 flex items-center gap-2">
              <Layers3 className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">Phân loại đơn vị</h2>
              {loggedInUser && (
                <span className="ml-auto text-[10px] text-muted-foreground">{userMapping.length} CC được phân quyền</span>
              )}
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {/* Công ty */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    <Building2 className="w-3 h-3 text-primary" /> Công ty
                  </Label>
                  <Select value={selectedCompanyId} onValueChange={handleCompanyChange} disabled={notLoggedIn || isLoggingIn}>
                    <SelectTrigger data-testid="select-cty"
                      className={cn("h-9 rounded-xl border-border/70 text-xs transition-colors",
                        notLoggedIn ? "bg-muted/40 opacity-60" : "bg-[#f8f9fc] hover:bg-white focus:bg-white")}>
                      <SelectValue placeholder="Đăng nhập trước..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value={ALL}><span className="text-muted-foreground font-medium">Tất cả ({userCompanies.length})</span></SelectItem>
                      {userCompanies.map((c) => (
                        <SelectItem key={c.company_id} value={c.company_id}>
                          <span className="font-mono text-primary text-[10px] mr-1">[{c.company_id}]</span>{c.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Cost Center */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    <MapPin className="w-3 h-3 text-primary" /> Cost Center
                  </Label>
                  <Select value={selectedCCId} onValueChange={setSelectedCCId} disabled={notLoggedIn || isLoggingIn}>
                    <SelectTrigger data-testid="select-cc"
                      className={cn("h-9 rounded-xl border-border/70 text-xs transition-colors",
                        notLoggedIn ? "bg-muted/40 opacity-60" : "bg-[#f8f9fc] hover:bg-white focus:bg-white")}>
                      <SelectValue placeholder="Đăng nhập trước..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value={ALL}><span className="text-muted-foreground font-medium">Tất cả ({userCostCenters.length})</span></SelectItem>
                      {userCostCenters.map((cc) => (
                        <SelectItem key={cc.cost_center_id} value={cc.cost_center_id}>
                          <span className="font-mono text-primary text-[10px] mr-1">[{cc.cost_center_id}]</span>{cc.cost_center_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Khối */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                    <Layers3 className="w-3 h-3 text-primary" /> Khối kinh doanh
                  </Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={notLoggedIn || isLoggingIn}>
                    <SelectTrigger data-testid="select-khoi"
                      className={cn("h-9 rounded-xl border-border/70 text-xs transition-colors",
                        notLoggedIn ? "bg-muted/40 opacity-60" : "bg-[#f8f9fc] hover:bg-white focus:bg-white")}>
                      <SelectValue placeholder="Đăng nhập trước..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value={ALL}><span className="text-muted-foreground font-medium">Tất cả ({userPlans.length})</span></SelectItem>
                      {userPlans.map((p) => (
                        <SelectItem key={p.plan_id} value={String(p.plan_id)}>{p.plan_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loggedInUser && (selectedCompanyId === ALL || selectedCCId === ALL) && (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Cần chọn cụ thể Công ty và Cost Center để submit.
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: Upload + Submit (compact) */}
          <div className="w-72 shrink-0 bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-border/40 flex items-center gap-2">
              <CloudUpload className="w-3.5 h-3.5 text-primary" />
              <h2 className="text-xs font-semibold text-foreground">Upload file</h2>
              <span className="ml-auto text-[10px] text-muted-foreground">CSV · XLSX</span>
            </div>
            <div className="p-4 flex flex-col gap-3 flex-1">
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
                className="hidden" onChange={handleFileChange} data-testid="input-file" />

              {/* Compact drop zone / file status */}
              {!fileName ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  data-testid="dropzone"
                  className={cn(
                    "border-2 border-dashed rounded-xl flex flex-col items-center gap-2 py-6 cursor-pointer transition-all duration-200",
                    isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isDragging ? "bg-primary/15" : "bg-muted")}>
                    <CloudUpload className={cn("w-5 h-5", isDragging ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">Kéo thả file</p>
                    <p className="text-[11px] text-muted-foreground">hoặc <span className="text-primary underline underline-offset-2">chọn file</span></p>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "rounded-xl border p-3 flex items-start gap-2.5 transition-all",
                  validationStatus === "valid" ? "border-emerald-200 bg-emerald-50/60" :
                  validationStatus === "invalid" ? "border-red-200 bg-red-50/60" : "border-border bg-muted/30"
                )}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    validationStatus === "valid" ? "bg-emerald-100" :
                    validationStatus === "invalid" ? "bg-red-100" : "bg-muted")}>
                    {validationStatus === "validating" ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                     : validationStatus === "valid" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                     : validationStatus === "invalid" ? <AlertCircle className="w-4 h-4 text-red-500" />
                     : <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{fileName}</p>
                    <p className="text-[10px] text-muted-foreground">{(fileSize / 1024).toFixed(1)} KB</p>
                    {validationStatus === "valid" && <p className="text-[10px] text-emerald-600 font-medium">{totalRows.toLocaleString()} dòng · Hợp lệ</p>}
                    {validationStatus === "invalid" && (
                      <p className="text-[10px] text-red-500 font-medium">
                        {validationErrors.length} lỗi phát hiện ↓
                      </p>
                    )}
                  </div>
                  <button onClick={handleClearFile} className="text-muted-foreground hover:text-foreground text-[10px] shrink-0 mt-0.5">✕</button>
                </div>
              )}

              {/* Chọn file button */}
              <Button variant="outline" size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 rounded-xl h-8 border-border/70 text-xs w-full" data-testid="button-upload">
                <Upload className="w-3 h-3" />
                {fileName ? "Thay file khác" : "Chọn file"}
              </Button>

              {/* Spacer to push submit to bottom */}
              <div className="flex-1" />

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                size="sm"
                className="gap-1.5 rounded-xl h-9 w-full shadow-sm font-semibold text-xs"
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

        {/* ── Validation error panel ── */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs font-semibold text-red-700">
                Phát hiện {validationErrors.length} lỗi trong file
              </span>
              <span className="ml-auto text-[10px] text-red-400">Cần sửa file hoặc điều chỉnh bộ lọc trước khi submit</span>
            </div>
            <ul className="px-5 py-3 space-y-2">
              {validationErrors.map((err, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-200 text-red-700 text-[9px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[11px] text-red-700 leading-snug">{err}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
