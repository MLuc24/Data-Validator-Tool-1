import { useState, useRef, useCallback } from "react";
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
import { KHOI_DATA, DEMO_USERS } from "@/data/masterData";

const REQUIRED_COLUMNS = [
  "Ngày",
  "Mã hệ thống",
  "Nhóm chỉ tiêu",
  "Khoản mục",
  "Tiểu mục",
  "Thuộc tính",
  "Nội dung",
  "Công ty",
  "Loại dữ liệu",
  "Khối",
  "Bộ phận",
  "Số tiền",
];

interface RowData {
  [key: string]: string | number;
}

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export default function UploadPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Login state
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dropdown cascade state
  const [selectedKhoi, setSelectedKhoi] = useState<string>("");
  const [selectedCty, setSelectedCty] = useState<string>("");
  const [selectedCC, setSelectedCC] = useState<string>("");

  // File upload state
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("idle");
  const [validationError, setValidationError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // === Derived dropdown options ===
  const khoiOptions = KHOI_DATA;

  const companiesForKhoi = selectedKhoi
    ? (KHOI_DATA.find((k) => k.id === selectedKhoi)?.companies ?? [])
    : [];

  const ccForCompany = selectedKhoi && selectedCty
    ? (companiesForKhoi.find((c) => c.maCty === selectedCty)?.costCenters ?? [])
    : [];

  // === Handlers ===
  const handleKhoiChange = (val: string) => {
    setSelectedKhoi(val);
    setSelectedCty("");
    setSelectedCC("");
  };

  const handleCtyChange = (val: string) => {
    setSelectedCty(val);
    setSelectedCC("");
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    // === SUPABASE AUTH (commented until credentials are provided) ===
    // const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
    // const { data: { user } } = await supabase.auth.signInWithPassword({ email, password });
    // const { data: profile } = await supabase.from("users").select("full_name").eq("id", user.id).single();
    // setLoggedInUser(profile.full_name);

    await new Promise((r) => setTimeout(r, 800));
    const randomUser = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
    setLoggedInUser(randomUser);
    setIsLoggingIn(false);
    toast({ title: "Đăng nhập thành công", description: `Xin chào, ${randomUser}!` });
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    toast({ title: "Đã đăng xuất" });
  };

  const parseFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
      setValidationStatus("invalid");
      setValidationError("Chỉ chấp nhận file CSV hoặc XLSX/XLS.");
      setRows([]);
      setHeaders([]);
      setFileName("");
      return;
    }

    setFileName(file.name);
    setValidationStatus("validating");
    setValidationError("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<RowData>(worksheet, {
        raw: false,
        dateNF: "dd/mm/yyyy",
      });

      if (jsonData.length === 0) {
        setValidationStatus("invalid");
        setValidationError("File không có dữ liệu.");
        setRows([]);
        setHeaders([]);
        return;
      }

      const fileHeaders = Object.keys(jsonData[0]);
      const missingCols = REQUIRED_COLUMNS.filter(
        (col) => !fileHeaders.some((h) => h.trim() === col)
      );

      if (missingCols.length > 0) {
        setValidationStatus("invalid");
        setValidationError(`File thiếu các cột: ${missingCols.join(", ")}`);
        setRows([]);
        setHeaders([]);
        return;
      }

      setHeaders(REQUIRED_COLUMNS);
      setRows(jsonData.slice(0, 100));
      setValidationStatus("valid");
      toast({
        title: "File hợp lệ",
        description: `Đọc được ${jsonData.length} dòng dữ liệu.`,
      });
    } catch {
      setValidationStatus("invalid");
      setValidationError("Không thể đọc file. Hãy kiểm tra lại định dạng.");
      setRows([]);
      setHeaders([]);
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleSubmit = async () => {
    if (!loggedInUser) {
      toast({ title: "Lỗi", description: "Vui lòng đăng nhập trước.", variant: "destructive" });
      return;
    }
    if (!selectedKhoi) {
      toast({ title: "Lỗi", description: "Vui lòng chọn Khối.", variant: "destructive" });
      return;
    }
    if (!selectedCty) {
      toast({ title: "Lỗi", description: "Vui lòng chọn Công ty.", variant: "destructive" });
      return;
    }
    if (!selectedCC) {
      toast({ title: "Lỗi", description: "Vui lòng chọn Cost Center.", variant: "destructive" });
      return;
    }
    if (validationStatus !== "valid" || rows.length === 0) {
      toast({ title: "Lỗi", description: "Vui lòng upload file hợp lệ.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // === SUPABASE INTEGRATION (commented until credentials are provided) ===
      //
      // import { createClient } from "@supabase/supabase-js";
      // const supabase = createClient(
      //   import.meta.env.VITE_SUPABASE_URL,
      //   import.meta.env.VITE_SUPABASE_ANON_KEY
      // );
      //
      // const khoiTen = KHOI_DATA.find(k => k.id === selectedKhoi)?.ten ?? "";
      // const ctyTen = companiesForKhoi.find(c => c.maCty === selectedCty)?.tenCty ?? "";
      // const ccTen = ccForCompany.find(cc => cc.ma === selectedCC)?.ten ?? "";
      //
      // const payload = rows.map((row) => ({
      //   ngay: row["Ngày"],
      //   ma_he_thong: row["Mã hệ thống"],
      //   nhom_chi_tieu: row["Nhóm chỉ tiêu"],
      //   khoan_muc: row["Khoản mục"],
      //   tieu_muc: row["Tiểu mục"],
      //   thuoc_tinh: row["Thuộc tính"],
      //   noi_dung: row["Nội dung"],
      //   cong_ty: row["Công ty"],
      //   loai_du_lieu: row["Loại dữ liệu"],
      //   khoi: row["Khối"],
      //   bo_phan: row["Bộ phận"],
      //   so_tien: row["Số tiền"],
      //   khoi_id: selectedKhoi,
      //   khoi_ten: khoiTen,
      //   ma_cty: selectedCty,
      //   ten_cty: ctyTen,
      //   ma_cost_center: selectedCC,
      //   ten_cost_center: ccTen,
      //   ke_toan: loggedInUser,
      // }));
      //
      // const { error } = await supabase.from("ke_toan_data").insert(payload);
      // if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 1200));
      toast({
        title: "Submit thành công",
        description: `Đã gửi ${rows.length} dòng dữ liệu.`,
      });
    } catch {
      toast({ title: "Lỗi", description: "Không thể submit dữ liệu.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedKhoiLabel = KHOI_DATA.find((k) => k.id === selectedKhoi)?.ten ?? "";
  const selectedCtyLabel = companiesForKhoi.find((c) => c.maCty === selectedCty)?.tenCty ?? "";
  const selectedCCLabel = ccForCompany.find((cc) => cc.ma === selectedCC)?.ten ?? "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="text-primary w-5 h-5" />
            <h1 className="text-base font-semibold text-foreground">Upload Dữ Liệu Kế Toán</h1>
          </div>

          {/* Login / User area */}
          <div className="flex items-center gap-3">
            {loggedInUser ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <UserCircle2 className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground" data-testid="text-logged-user">
                    {loggedInUser}
                  </span>
                  <span className="text-muted-foreground text-xs">(Kế toán)</span>
                </div>
                <Button
                  data-testid="button-logout"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </Button>
              </>
            ) : (
              <Button
                data-testid="button-login"
                size="sm"
                className="gap-2"
                onClick={handleLogin}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                {isLoggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">
        {/* Form card */}
        <div className="bg-card border rounded-lg p-5 shadow-sm space-y-5">

          {/* Row 1: Ngày + Kế toán */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ngày</Label>
              <div
                data-testid="text-date"
                className="h-9 px-3 flex items-center rounded-md border bg-muted/50 text-sm font-medium"
              >
                {today}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kế toán</Label>
              <div
                data-testid="text-accountant"
                className={cn(
                  "h-9 px-3 flex items-center rounded-md border text-sm",
                  loggedInUser
                    ? "bg-muted/50 font-medium text-foreground"
                    : "bg-muted/30 text-muted-foreground italic"
                )}
              >
                {loggedInUser ?? "Chưa đăng nhập"}
              </div>
            </div>
          </div>

          {/* Row 2: 3-cấp dropdown */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Phân loại đơn vị
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Khối */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Khối kinh doanh</Label>
                <Select value={selectedKhoi} onValueChange={handleKhoiChange}>
                  <SelectTrigger data-testid="select-khoi" className="h-9">
                    <SelectValue placeholder="Chọn khối..." />
                  </SelectTrigger>
                  <SelectContent>
                    {khoiOptions.map((k) => (
                      <SelectItem key={k.id} value={k.id} data-testid={`option-khoi-${k.id}`}>
                        {k.ten}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Công ty */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Công ty</Label>
                <Select
                  value={selectedCty}
                  onValueChange={handleCtyChange}
                  disabled={!selectedKhoi}
                >
                  <SelectTrigger data-testid="select-cty" className="h-9">
                    <SelectValue
                      placeholder={selectedKhoi ? "Chọn công ty..." : "Chọn khối trước"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {companiesForKhoi.map((c) => (
                      <SelectItem key={c.maCty} value={c.maCty} data-testid={`option-cty-${c.maCty}`}>
                        [{c.maCty}] {c.tenCty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cost Center */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cost Center</Label>
                <Select
                  value={selectedCC}
                  onValueChange={setSelectedCC}
                  disabled={!selectedCty}
                >
                  <SelectTrigger data-testid="select-cc" className="h-9">
                    <SelectValue
                      placeholder={selectedCty ? "Chọn cost center..." : "Chọn công ty trước"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {ccForCompany.map((cc) => (
                      <SelectItem key={cc.ma} value={cc.ma} data-testid={`option-cc-${cc.ma}`}>
                        [{cc.ma}] {cc.ten}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected breadcrumb */}
            {(selectedKhoi || selectedCty || selectedCC) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {selectedKhoi && (
                  <Badge variant="secondary" className="font-normal">
                    {selectedKhoiLabel}
                  </Badge>
                )}
                {selectedCty && (
                  <>
                    <span>›</span>
                    <Badge variant="secondary" className="font-normal">
                      [{selectedCty}] {selectedCtyLabel}
                    </Badge>
                  </>
                )}
                {selectedCC && (
                  <>
                    <span>›</span>
                    <Badge variant="secondary" className="font-normal">
                      [{selectedCC}] {selectedCCLabel}
                    </Badge>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Upload + Submit */}
          <div className="pt-4 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Upload File</Label>

              <Button
                data-testid="button-upload"
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" />
                Chọn file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file"
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
                {fileName ? (
                  <span className="font-medium text-foreground truncate">{fileName}</span>
                ) : (
                  <span className="truncate">Kéo thả file vào đây (CSV, XLSX)</span>
                )}
              </div>

              {validationStatus === "validating" && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kiểm tra...</span>
                </div>
              )}
              {validationStatus === "valid" && (
                <Badge
                  data-testid="badge-valid"
                  variant="secondary"
                  className="gap-1.5 bg-green-100 text-green-700 border-green-200 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Hợp lệ
                </Badge>
              )}
              {validationStatus === "invalid" && (
                <Badge
                  data-testid="badge-invalid"
                  variant="destructive"
                  className="gap-1.5 shrink-0"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Lỗi định dạng
                </Badge>
              )}

              <Button
                data-testid="button-submit"
                onClick={handleSubmit}
                disabled={isSubmitting || validationStatus !== "valid" || !loggedInUser}
                className="gap-2 shrink-0"
                size="sm"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit
              </Button>
            </div>

            {validationStatus === "invalid" && validationError && (
              <div
                data-testid="error-validation"
                className="mt-2.5 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
              >
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
              <span className="text-xs text-muted-foreground">
                Hiển thị {rows.length} dòng
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table data-testid="table-preview">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {headers.map((col) => (
                      <TableHead
                        key={col}
                        className="text-xs font-semibold text-foreground whitespace-nowrap px-3 py-2 border-r last:border-r-0"
                      >
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      data-testid={`row-data-${idx}`}
                      className="hover:bg-muted/30"
                    >
                      {headers.map((col) => (
                        <TableCell
                          key={col}
                          className="text-xs px-3 py-1.5 whitespace-nowrap border-r last:border-r-0"
                        >
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
