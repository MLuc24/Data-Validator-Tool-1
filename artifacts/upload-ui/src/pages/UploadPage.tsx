import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

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

const COMPANIES: Record<string, { label: string; costCenters: { value: string; label: string }[] }> = {
  cty001: {
    label: "Công ty ABC",
    costCenters: [
      { value: "cc001", label: "CC001 - Phòng Tài chính" },
      { value: "cc002", label: "CC002 - Phòng Kế toán" },
      { value: "cc003", label: "CC003 - Phòng Kinh doanh" },
    ],
  },
  cty002: {
    label: "Công ty XYZ",
    costCenters: [
      { value: "cc004", label: "CC004 - Ban Giám đốc" },
      { value: "cc005", label: "CC005 - Phòng Marketing" },
    ],
  },
  cty003: {
    label: "Công ty DEF",
    costCenters: [
      { value: "cc006", label: "CC006 - Phòng Vận hành" },
      { value: "cc007", label: "CC007 - Phòng Hành chính" },
      { value: "cc008", label: "CC008 - Phòng IT" },
    ],
  },
};

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

  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("");
  const [accountant, setAccountant] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("idle");
  const [validationError, setValidationError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const costCenters = selectedCompany ? COMPANIES[selectedCompany]?.costCenters ?? [] : [];

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value);
    setSelectedCostCenter("");
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
      const jsonData = XLSX.utils.sheet_to_json<RowData>(worksheet, { raw: false, dateNF: "dd/mm/yyyy" });

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
      toast({ title: "File hợp lệ", description: `Đọc được ${jsonData.length} dòng dữ liệu.` });
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleSubmit = async () => {
    if (!selectedCompany) {
      toast({ title: "Lỗi", description: "Vui lòng chọn công ty.", variant: "destructive" });
      return;
    }
    if (!selectedCostCenter) {
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
      //   company_id: selectedCompany,
      //   cost_center_id: selectedCostCenter,
      //   ke_toan: accountant,
      // }));
      //
      // const { error } = await supabase.from("ke_toan_data").insert(payload);
      // if (error) throw error;

      await new Promise((resolve) => setTimeout(resolve, 1200));

      toast({
        title: "Thành công",
        description: `Đã submit ${rows.length} dòng dữ liệu.`,
      });
    } catch {
      toast({ title: "Lỗi", description: "Không thể submit dữ liệu.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <FileSpreadsheet className="text-primary w-6 h-6" />
          <h1 className="text-lg font-semibold text-foreground">Upload Dữ Liệu Kế Toán</h1>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-card border rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Ngày</Label>
              <div
                data-testid="text-date"
                className="h-10 px-3 flex items-center rounded-md border bg-muted/40 text-sm font-medium text-foreground"
              >
                {today}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kế toán</Label>
              <Input
                data-testid="input-accountant"
                placeholder="Nhập tên kế toán..."
                value={accountant}
                onChange={(e) => setAccountant(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Tên công ty</Label>
              <Select value={selectedCompany} onValueChange={handleCompanyChange}>
                <SelectTrigger data-testid="select-company" className="h-10">
                  <SelectValue placeholder="Chọn công ty..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPANIES).map(([value, { label }]) => (
                    <SelectItem key={value} value={value} data-testid={`option-company-${value}`}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Cost Center</Label>
              <Select
                value={selectedCostCenter}
                onValueChange={setSelectedCostCenter}
                disabled={!selectedCompany}
              >
                <SelectTrigger data-testid="select-cost-center" className="h-10">
                  <SelectValue placeholder={selectedCompany ? "Chọn cost center..." : "Chọn công ty trước"} />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map(({ value, label }) => (
                    <SelectItem key={value} value={value} data-testid={`option-cc-${value}`}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium whitespace-nowrap">Upload File</Label>
                <Button
                  data-testid="button-upload"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
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
              </div>

              <div
                className={cn(
                  "flex-1 h-10 rounded-md border-2 border-dashed px-4 flex items-center text-sm text-muted-foreground transition-colors",
                  isDragging && "border-primary bg-primary/5 text-primary",
                  fileName && "border-solid"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                data-testid="dropzone"
              >
                {fileName ? (
                  <span className="font-medium text-foreground truncate">{fileName}</span>
                ) : (
                  <span>Kéo thả file vào đây (CSV, XLSX)</span>
                )}
              </div>

              {validationStatus === "validating" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </div>
              )}
              {validationStatus === "valid" && (
                <Badge variant="secondary" className="gap-1.5 bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Hợp lệ
                </Badge>
              )}
              {validationStatus === "invalid" && (
                <Badge variant="destructive" className="gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Lỗi
                </Badge>
              )}

              <Button
                data-testid="button-submit"
                onClick={handleSubmit}
                disabled={isSubmitting || validationStatus !== "valid"}
                className="gap-2 sm:ml-auto"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit
              </Button>
            </div>

            {validationStatus === "invalid" && validationError && (
              <div
                data-testid="error-validation"
                className="mt-3 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        </div>

        {rows.length > 0 && (
          <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between">
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
                        className="text-xs font-semibold text-foreground whitespace-nowrap px-3 py-2.5 border-r last:border-r-0"
                      >
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx} data-testid={`row-data-${idx}`} className="hover:bg-muted/30">
                      {headers.map((col) => (
                        <TableCell
                          key={col}
                          className="text-xs px-3 py-2 whitespace-nowrap border-r last:border-r-0"
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
        )}

        {validationStatus === "idle" && rows.length === 0 && (
          <div className="bg-card border rounded-lg shadow-sm">
            <div className="px-5 py-3.5 border-b">
              <h2 className="font-semibold text-sm">Dữ liệu Preview</h2>
            </div>
            <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
              <FileSpreadsheet className="w-10 h-10 opacity-30" />
              <p className="text-sm">Upload file để xem preview dữ liệu</p>
              <p className="text-xs opacity-60">Yêu cầu các cột: {REQUIRED_COLUMNS.join(", ")}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
