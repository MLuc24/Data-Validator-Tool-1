import {
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  FileX2,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { UploadBatchStatus } from "@/types/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BatchPreviewRow, BatchRecord } from "./types";

type UploadHistorySheetProps = {
  allCompanies: unknown[];
  batchRows: BatchPreviewRow[];
  batchRowsLoading: boolean;
  canRead: boolean;
  historyBatches: BatchRecord[];
  historyLoading: boolean;
  historyOpen: boolean;
  loggedInUserName: string | null;
  onHistoryOpenChange: (open: boolean) => void;
  onPreviewOpenChange: (open: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onViewBatch: (batch: BatchRecord) => void | Promise<void>;
  previewBatch: BatchRecord | null;
  uploadRowsPreviewAvailable: boolean;
  uploadRowsPreviewNotice: string | null;
};

const STATUS_CONFIG: Record<
  UploadBatchStatus,
  { label: string; icon: typeof FileClock; className: string }
> = {
  draft: {
    label: "Nhap",
    icon: FileClock,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  processing: {
    label: "Dang xu ly",
    icon: Loader2,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Hoan tat",
    icon: FileCheck2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  failed: {
    label: "Loi",
    icon: FileX2,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  validated: {
    label: "Da kiem tra",
    icon: FileCheck2,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  submitted: {
    label: "Da gui",
    icon: FileCheck2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function BatchPreviewDialog({
  batchRows,
  batchRowsLoading,
  onPreviewOpenChange,
  previewBatch,
  uploadRowsPreviewNotice,
}: Pick<
  UploadHistorySheetProps,
  | "batchRows"
  | "batchRowsLoading"
  | "onPreviewOpenChange"
  | "previewBatch"
  | "uploadRowsPreviewNotice"
>) {
  const previewColumns =
    batchRows.length > 0 ? Object.keys(batchRows[0] ?? {}) : [];

  return (
    <Dialog open={!!previewBatch} onOpenChange={onPreviewOpenChange}>
      <DialogContent className="max-w-5xl w-full p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span>{previewBatch?.original_file_name ?? previewBatch?.file_name}</span>
            {previewBatch && (
              <span className="text-muted-foreground font-normal text-xs">
                #{previewBatch.upload_batch_id} · {previewBatch.total_rows.toLocaleString()} dong
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          {batchRowsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : batchRows.length > 0 ? (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    {previewColumns.map((column) => (
                      <TableHead key={column} className="whitespace-nowrap">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchRows.map((row, index) => (
                    <TableRow key={index}>
                      {previewColumns.map((column) => (
                        <TableCell key={column} className="whitespace-nowrap text-xs">
                          {String(row[column] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground text-center">
                {uploadRowsPreviewNotice ?? "Khong co du lieu preview."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryBatchCard({
  batch,
  canRead,
  onViewBatch,
  uploadRowsPreviewAvailable,
}: {
  batch: BatchRecord;
  canRead: boolean;
  onViewBatch: (batch: BatchRecord) => void | Promise<void>;
  uploadRowsPreviewAvailable: boolean;
}) {
  const statusConfig = STATUS_CONFIG[batch.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const createdAt = new Date(batch.created_at).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="border border-border/60 rounded-xl p-3.5 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <StatusIcon
            className={cn(
              "w-4 h-4 text-muted-foreground",
              batch.status === "processing" && "animate-spin",
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-xs font-semibold text-foreground truncate max-w-[220px]"
              title={batch.original_file_name ?? batch.file_name}
            >
              {batch.original_file_name ?? batch.file_name}
            </p>
            <span
              className={cn(
                "text-[10px] font-medium border px-1.5 py-0.5 rounded-md",
                statusConfig.className,
              )}
            >
              {statusConfig.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              #{batch.upload_batch_id}
            </span>
            <span className="text-[10px] text-muted-foreground">{createdAt}</span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {batch.total_rows.toLocaleString()} dong
            </span>
            <span className="text-[10px] text-muted-foreground">
              OK: {batch.success_rows.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Loi: {batch.failed_rows.toLocaleString()}
            </span>
          </div>
        </div>

        {canRead && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl text-xs"
            onClick={() => void onViewBatch(batch)}
          >
            {uploadRowsPreviewAvailable ? "Preview" : "Chi tiet"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function UploadHistorySheet({
  allCompanies: _allCompanies,
  batchRows,
  batchRowsLoading,
  canRead,
  historyBatches,
  historyLoading,
  historyOpen,
  loggedInUserName,
  onHistoryOpenChange,
  onPreviewOpenChange,
  onRefresh,
  onViewBatch,
  previewBatch,
  uploadRowsPreviewAvailable,
  uploadRowsPreviewNotice,
}: UploadHistorySheetProps) {
  return (
    <>
      <BatchPreviewDialog
        batchRows={batchRows}
        batchRowsLoading={batchRowsLoading}
        onPreviewOpenChange={onPreviewOpenChange}
        previewBatch={previewBatch}
        uploadRowsPreviewNotice={uploadRowsPreviewNotice}
      />

      <Sheet open={historyOpen} onOpenChange={onHistoryOpenChange}>
        <SheetContent
          className="w-full sm:w-[560px] sm:max-w-[560px] p-0 flex flex-col"
          side="right"
        >
          <SheetHeader className="px-6 py-4 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <History className="w-4 h-4 text-primary" />
                Lich su file upload
              </SheetTitle>
              <button
                onClick={() => void onRefresh()}
                disabled={historyLoading}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                title="Lam moi"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    historyLoading && "animate-spin",
                  )}
                />
              </button>
            </div>

            {loggedInUserName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {loggedInUserName}
              </p>
            )}

            {canRead && uploadRowsPreviewNotice && (
              <p className="text-[11px] text-amber-700 mt-1.5">
                {uploadRowsPreviewNotice}
              </p>
            )}
          </SheetHeader>

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
                <p className="text-sm text-muted-foreground">
                  Chua co file nao duoc upload
                </p>
              </div>
            ) : (
              <div className="space-y-2 pb-6">
                {historyBatches.map((batch) => (
                  <HistoryBatchCard
                    key={batch.upload_batch_id}
                    batch={batch}
                    canRead={canRead}
                    onViewBatch={onViewBatch}
                    uploadRowsPreviewAvailable={uploadRowsPreviewAvailable}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
