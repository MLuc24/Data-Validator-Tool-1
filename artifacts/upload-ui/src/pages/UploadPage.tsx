import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, LogIn, LogOut, UserCircle2,
  Building2, Layers3, MapPin, CloudUpload, ChevronRight,
  Calendar, ClipboardList, Upload, ChevronDown, Users,
  History, ShieldCheck, ThumbsUp, ThumbsDown, Eye,
  FileCheck2, FileClock, FileX2, RefreshCw,
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

interface BatchRecord {
  id: number;
  uploaded_by: number;
  file_name: string;
  original_file_name: string | null;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  status: "draft" | "completed" | "failed";
  submitted_at: string;
  note: string | null;
}

interface UserFilePermissions {
  user_id: number;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_approve: boolean;
}

type BatchRow = Record<string, string | number | null>;

const ROW_COLUMN_MAP: { db: string; label: string }[] = [
  { db: "ngay", label: "Ngày" },
  { db: "ma_he_thong", label: "Mã HT" },
  { db: "nhom_chi_tieu", label: "Nhóm CT" },
  { db: "khoan_muc", label: "Khoản mục" },
  { db: "tieu_muc", label: "Tiểu mục" },
  { db: "thuoc_tinh", label: "Thuộc tính" },
  { db: "noi_dung", label: "Nội dung" },
  { db: "cong_ty", label: "Công ty" },
  { db: "loai_du_lieu", label: "Loại DL" },
  { db: "khoi", label: "Khối" },
  { db: "bo_phan", label: "Bộ phận" },
  { db: "so_tien", label: "Số tiền" },
];

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

  // ── Permissions (from users_file table) ───────────────────
  const [userPerms, setUserPerms] = useState<UserFilePermissions | null>(null);
  const canCreate = userPerms?.can_create ?? false;
  const canRead   = userPerms?.can_read   ?? false;
  const canApprove = userPerms?.can_approve ?? false;

  // ── History / Approval panel ───────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<BatchRecord[]>([]);
  const [pendingBatches, setPendingBatches] = useState<BatchRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [historyTab, setHistoryTab] = useState<"mine" | "pending">("mine");

  // ── Batch row preview ──────────────────────────────────────
  const [previewBatch, setPreviewBatch] = useState<BatchRecord | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchRowsLoading, setBatchRowsLoading] = useState(false);

  // Load permissions from users_file when user logs in
  useEffect(() => {
    if (!loggedInUser) { setUserPerms(null); return; }
    supabase.from("users_file")
      .select("user_id, can_create, can_read, can_update, can_approve")
      .eq("user_id", loggedInUser.id)
      .single()
      .then(({ data, error }) => {
        setUserPerms(error || !data ? null : (data as UserFilePermissions));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUser?.id]);

  const handleViewBatch = async (batch: BatchRecord) => {
    setPreviewBatch(batch);
    setBatchRows([]);
    setBatchRowsLoading(true);
    const { data } = await supabase
      .from("upload_rows")
      .select("ngay, ma_he_thong, nhom_chi_tieu, khoan_muc, tieu_muc, thuoc_tinh, noi_dung, cong_ty, loai_du_lieu, khoi, bo_phan, so_tien")
      .eq("batch_id", batch.id)
      .order("row_no")
      .limit(300);
    setBatchRows((data ?? []) as BatchRow[]);
    setBatchRowsLoading(false);
  };

  const loadHistory = async (approver?: boolean) => {
    if (!loggedInUser) return;
    setHistoryLoading(true);
    const isAppr = approver ?? canApprove;
    try {
      const [myRes, pendingRes] = await Promise.all([
        supabase.from("upload_batches")
          .select("*")
          .eq("uploaded_by", loggedInUser.id)
          .order("submitted_at", { ascending: false })
          .limit(50),
        isAppr
          ? supabase.from("upload_batches")
              .select("*")
              .eq("status", "draft")
              .order("submitted_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] as BatchRecord[], error: null }),
      ]);
      if (myRes.data) setHistoryBatches(myRes.data as BatchRecord[]);
      if (pendingRes.data) setPendingBatches(pendingRes.data as BatchRecord[]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (historyOpen) loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen]);

  const handleApprove = async (batchId: number) => {
    setApprovingId(batchId);
    try {
      const { error } = await supabase.from("upload_batches")
        .update({ status: "completed" }).eq("id", batchId);
      if (error) throw new Error(error.message);
      toast({ title: "Đã phê duyệt!", description: `Batch #${batchId} đã được chấp thuận.` });
      await loadHistory();
    } catch (err) {
      toast({ title: "Lỗi phê duyệt", description: String(err), variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (batchId: number) => {
    setApprovingId(batchId);
    try {
      const { error } = await supabase.from("upload_batches")
        .update({ status: "failed" }).eq("id", batchId);
      if (error) throw new Error(error.message);
      toast({ title: "Đã từ chối", description: `Batch #${batchId} đã bị từ chối.` });
      await loadHistory();
    } catch (err) {
      toast({ title: "Lỗi từ chối", description: String(err), variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

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
        status: canApprove ? "completed" : "draft",
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

      toast({
        title: canApprove ? "Submit thành công!" : "Gửi thành công! Chờ phê duyệt.",
        description: canApprove
          ? `${totalRows.toLocaleString()} dòng đã được lưu và phê duyệt.`
          : `${totalRows.toLocaleString()} dòng đã gửi. Người phê duyệt sẽ xem xét.`,
      });
      handleClearFile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast({ title: "Submit thất bại", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !!loggedInUser && canCreate && !!resolvedCompanyId && !!resolvedCCId
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

          <div className="flex items-center gap-2">
            {isLoadingMaster && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="hidden sm:inline">Đang tải...</span>
              </span>
            )}
            {/* History button - visible if user can read OR can approve */}
            {loggedInUser && (canRead || canApprove) && (
              <button
                onClick={() => { setHistoryOpen(true); setHistoryTab(canApprove && pendingBatches.length > 0 ? "pending" : "mine"); }}
                className="relative flex items-center gap-1.5 border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                title="Lịch sử file"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lịch sử</span>
                {canApprove && pendingBatches.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {pendingBatches.length}
                  </span>
                )}
              </button>
            )}
            {/* Approver badge */}
            {canApprove && (
              <div className="hidden sm:flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] font-semibold text-amber-700">Phê duyệt</span>
              </div>
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
                  : canApprove
                    ? <><ShieldCheck className="w-3.5 h-3.5" />Submit & Duyệt</>
                    : <><ClipboardList className="w-3.5 h-3.5" />Gửi chờ duyệt</>
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

      {/* ── Batch Row Preview Dialog ── */}
      <Dialog open={!!previewBatch} onOpenChange={(open) => { if (!open) setPreviewBatch(null); }}>
        <DialogContent className="max-w-5xl w-full max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/40 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              {previewBatch?.original_file_name ?? previewBatch?.file_name}
              <span className="text-muted-foreground font-normal text-xs">
                #{previewBatch?.id} · {previewBatch?.total_rows.toLocaleString()} dòng
              </span>
            </DialogTitle>
          </DialogHeader>
          {batchRowsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Đang tải dữ liệu...</span>
            </div>
          ) : batchRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-[#f4f6fb] hover:bg-[#f4f6fb] border-b border-border/50">
                    <TableHead className="text-[10px] font-bold w-10 px-3 py-2.5 text-center text-muted-foreground">#</TableHead>
                    {ROW_COLUMN_MAP.map(({ label }) => (
                      <TableHead key={label} className="text-[10px] font-bold whitespace-nowrap px-3 py-2.5 text-foreground border-l border-border/30">{label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchRows.map((row, idx) => (
                    <TableRow key={idx} className={cn("border-b border-border/30 hover:bg-primary/3", idx % 2 === 0 ? "bg-white" : "bg-[#fafbfd]")}>
                      <TableCell className="text-[10px] text-muted-foreground text-center px-3 py-1.5 font-mono">{idx + 1}</TableCell>
                      {ROW_COLUMN_MAP.map(({ db, label }) => (
                        <TableCell key={db} className="text-[11px] px-3 py-1.5 whitespace-nowrap border-l border-border/20 font-mono">
                          {row[db] !== null && row[db] !== undefined ? String(row[db]) : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── History & Approval Sheet ── */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] p-0 flex flex-col" side="right">
          <SheetHeader className="px-6 py-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-primary" />
                Lịch sử File Upload
              </SheetTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadHistory}
                  disabled={historyLoading}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                  title="Làm mới"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", historyLoading && "animate-spin")} />
                </button>
              </div>
            </div>
            {loggedInUser && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {loggedInUser.full_name}
                {canApprove && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                    <ShieldCheck className="w-3 h-3" /> Người phê duyệt
                  </span>
                )}
              </p>
            )}
          </SheetHeader>

          <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as "mine" | "pending")} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mt-3 mb-0 grid w-auto self-start gap-1 h-auto bg-muted/50 p-1 rounded-xl" style={{ gridTemplateColumns: canApprove ? "1fr 1fr" : "1fr" }}>
              <TabsTrigger value="mine" className="text-xs rounded-lg px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <FileSpreadsheet className="w-3 h-3 mr-1.5" />
                File của tôi
                <Badge variant="secondary" className="ml-1.5 text-[9px] px-1.5 h-4">{historyBatches.length}</Badge>
              </TabsTrigger>
              {canApprove && (
                <TabsTrigger value="pending" className="text-xs rounded-lg px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <FileClock className="w-3 h-3 mr-1.5" />
                  Chờ duyệt
                  {pendingBatches.length > 0 && (
                    <Badge className="ml-1.5 text-[9px] px-1.5 h-4 bg-amber-500 hover:bg-amber-500">{pendingBatches.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* My Files tab */}
            <TabsContent value="mine" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              <ScrollArea className="flex-1 px-4 pt-3">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : historyBatches.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">Chưa có file nào được upload</p>
                  </div>
                ) : (
                  <div className="space-y-2 pb-6">
                    {historyBatches.map((batch) => (
                      <BatchCard
                        key={batch.id}
                        batch={batch}
                        uploaderName={allUsers.find(u => u.id === batch.uploaded_by)?.full_name}
                        canApprove={canApprove}
                        canRead={canRead}
                        approvingId={approvingId}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onViewBatch={handleViewBatch}
                        showActions={false}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Pending approval tab */}
            {canApprove && (
              <TabsContent value="pending" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ScrollArea className="flex-1 px-4 pt-3">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : pendingBatches.length === 0 ? (
                    <div className="flex flex-col items-center py-16 gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                        <FileCheck2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <p className="text-sm text-muted-foreground">Không có file chờ phê duyệt</p>
                      <p className="text-xs text-muted-foreground/70">Tất cả đã được xử lý</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pb-6">
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {pendingBatches.length} file đang chờ phê duyệt của bạn
                      </p>
                      {pendingBatches.map((batch) => (
                        <BatchCard
                          key={batch.id}
                          batch={batch}
                          uploaderName={allUsers.find(u => u.id === batch.uploaded_by)?.full_name}
                          canApprove={canApprove}
                          canRead={canRead}
                          approvingId={approvingId}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onViewBatch={handleViewBatch}
                          showActions={true}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── BatchCard sub-component ────────────────────────────────
function BatchCard({
  batch,
  uploaderName,
  canApprove,
  canRead,
  approvingId,
  onApprove,
  onReject,
  onViewBatch,
  showActions,
}: {
  batch: BatchRecord;
  uploaderName?: string;
  canApprove: boolean;
  canRead: boolean;
  approvingId: number | null;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onViewBatch: (batch: BatchRecord) => void;
  showActions: boolean;
}) {
  const statusConfig = {
    draft: { label: "Chờ duyệt", icon: FileClock, className: "bg-amber-50 text-amber-700 border-amber-200" },
    completed: { label: "Đã duyệt", icon: FileCheck2, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    failed: { label: "Từ chối", icon: FileX2, className: "bg-red-50 text-red-700 border-red-200" },
  };
  const cfg = statusConfig[batch.status] ?? statusConfig.draft;
  const StatusIcon = cfg.icon;
  const isBusy = approvingId === batch.id;
  const date = new Date(batch.submitted_at).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="border border-border/60 rounded-xl p-3.5 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <StatusIcon className={cn("w-4 h-4", batch.status === "completed" ? "text-emerald-500" : batch.status === "failed" ? "text-red-500" : "text-amber-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-foreground truncate max-w-[200px]" title={batch.original_file_name ?? batch.file_name}>
              {batch.original_file_name ?? batch.file_name}
            </p>
            <span className={cn("text-[10px] font-medium border px-1.5 py-0.5 rounded-md", cfg.className)}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">#{batch.id}</span>
            <span className="text-[10px] text-muted-foreground">{date}</span>
            <span className="text-[10px] font-mono text-muted-foreground">{batch.total_rows.toLocaleString()} dòng</span>
          </div>
          {uploaderName && canApprove && (
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Eye className="w-3 h-3" /> {uploaderName}
            </p>
          )}
        </div>

        {/* View data button */}
        {canRead && (
          <button
            onClick={() => onViewBatch(batch)}
            className="shrink-0 flex items-center gap-1 text-[10px] text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md px-2 py-1 transition-colors"
          >
            <Eye className="w-3 h-3" />
            Xem
          </button>
        )}
      </div>

      {/* Approve / Reject buttons for approver */}
      {showActions && canApprove && batch.status === "draft" && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/40">
          <button
            onClick={() => onApprove(batch.id)}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
            Phê duyệt
          </button>
          <button
            onClick={() => onReject(batch.id)}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
            Từ chối
          </button>
        </div>
      )}
    </div>
  );
}
