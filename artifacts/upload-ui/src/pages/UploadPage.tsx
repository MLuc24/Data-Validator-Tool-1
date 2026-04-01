import { useCallback, useMemo } from "react";

import { AlertCircle } from "lucide-react";

import { UploadHistorySheet } from "@/features/upload/upload-history-sheet";
import { UploadPageHeader } from "@/features/upload/upload-page-header";
import { UploadWorkspace } from "@/features/upload/upload-workspace";
import { useUploadAccess } from "@/features/upload/use-upload-access";
import { useUploadHistory } from "@/features/upload/use-upload-history";
import { useUploadWorkflow } from "@/features/upload/use-upload-workflow";
import { useToast } from "@/hooks/use-toast";

export default function UploadPage() {
  const { toast } = useToast();
  const access = useUploadAccess();

  const scope = useMemo(
    () => ({
      loggedInUser: access.loggedInUser,
      userCompanies: access.userCompanies,
      userPlans: access.userPlans,
      userCostCenters: access.userCostCenters,
    }),
    [
      access.loggedInUser,
      access.userCompanies,
      access.userCostCenters,
      access.userPlans,
    ],
  );

  const history = useUploadHistory({
    historyEnabled: access.canRead,
    loggedInUser: access.loggedInUser,
  });

  const workflow = useUploadWorkflow({
    canCreate: access.canCreate,
    loggedInUser: access.loggedInUser,
    masterDataNotice: access.masterDataNotice,
    onSubmitted: history.historyOpen ? history.loadHistory : undefined,
    resolvedCCId: access.resolvedCCId,
    resolvedCompanyId: access.resolvedCompanyId,
    scope,
    selectedCCId: access.selectedCCId,
    selectedCompanyId: access.selectedCompanyId,
    selectedPlanId: access.selectedPlanId,
  });

  const handleLoginAs = useCallback(
    (user: (typeof access.allUsers)[number]) => {
      access.handleLoginAs(user);
      toast({
        title: `Xin chào, ${user.full_name}!`,
        description: "Đã tải phạm vi đơn vị theo tài khoản.",
      });
    },
    [access, toast],
  );

  const handleLogout = useCallback(() => {
    history.setHistoryOpen(false);
    history.handlePreviewOpenChange(false);
    access.handleLogout();
  }, [access, history]);

  const openFilePicker = useCallback(() => {
    workflow.fileInputRef.current?.click();
  }, [workflow.fileInputRef]);

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <UploadPageHeader
        allUsers={access.allUsers}
        canRead={access.canRead}
        historyOpen={history.historyOpen}
        isLoadingMaster={access.isLoadingMaster}
        isLoggingIn={access.isLoggingIn}
        loggedInUser={access.loggedInUser}
        loginPopoverOpen={access.loginPopoverOpen}
        onHistoryOpenChange={history.setHistoryOpen}
        onLoginAs={handleLoginAs}
        onLoginPopoverOpenChange={access.setLoginPopoverOpen}
        onLogout={handleLogout}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {access.masterDataNotice && (
          <div className="bg-amber-50 border border-amber-200 rounded-[28px] overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 flex items-center gap-2 text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{access.masterDataNotice}</span>
            </div>
          </div>
        )}

        <UploadWorkspace
          activeTarget={workflow.activeTarget}
          canSubmit={workflow.canSubmit}
          factTabs={workflow.factTabs}
          fileInputRef={workflow.fileInputRef}
          fileName={workflow.fileName}
          fileSize={workflow.fileSize}
          headers={workflow.headers}
          isDragging={workflow.isDragging}
          isLoggingIn={access.isLoggingIn}
          isLoadingFacts={workflow.isLoadingFacts}
          isSubmitting={workflow.isSubmitting}
          notLoggedIn={!access.loggedInUser}
          onCompanyChange={access.handleCompanyChange}
          onDrop={workflow.handleDrop}
          onFactChange={workflow.handleFactChange}
          onFileChange={workflow.handleFileChange}
          onPickFile={openFilePicker}
          onPlanChange={access.setSelectedPlanId}
          onSelectedCCChange={access.setSelectedCCId}
          onSubmit={workflow.handleSubmit}
          rows={workflow.rows}
          selectedCCId={access.selectedCCId}
          selectedCompanyId={access.selectedCompanyId}
          selectedImportTarget={workflow.selectedImportTarget}
          selectedPlanId={access.selectedPlanId}
          setIsDragging={workflow.setIsDragging}
          totalRows={workflow.totalRows}
          userCompanies={access.userCompanies}
          userCostCenters={access.userCostCenters}
          userPlans={access.userPlans}
          validationErrors={workflow.validationErrors}
          validationStatus={workflow.validationStatus}
          validationWarnings={workflow.validationWarnings}
        />
      </main>

      <UploadHistorySheet
        allCompanies={access.allCompanies}
        batchRows={history.batchRows}
        batchRowsLoading={history.batchRowsLoading}
        canRead={access.canRead}
        historyBatches={history.historyBatches}
        historyLoading={history.historyLoading}
        historyOpen={history.historyOpen}
        loggedInUserName={access.loggedInUser?.full_name ?? null}
        onHistoryOpenChange={history.setHistoryOpen}
        onPreviewOpenChange={history.handlePreviewOpenChange}
        onRefresh={history.loadHistory}
        onViewBatch={history.handleViewBatch}
        previewBatch={history.previewBatch}
        uploadRowsPreviewAvailable={history.uploadRowsPreviewAvailable}
        uploadRowsPreviewNotice={history.uploadRowsPreviewNotice}
      />
    </div>
  );
}
