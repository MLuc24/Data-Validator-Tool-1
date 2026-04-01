import {
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  History,
  Loader2,
  LogIn,
  LogOut,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { UsersApp } from "@/types/supabase";
import { AVATAR_COLORS, getInitials } from "./use-upload-access";

type Props = {
  allUsers: UsersApp[];
  canRead: boolean;
  historyOpen: boolean;
  isLoadingMaster: boolean;
  isLoggingIn: boolean;
  loggedInUser: UsersApp | null;
  loginPopoverOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onLoginAs: (user: UsersApp) => void;
  onLogout: () => void;
  onLoginPopoverOpenChange: (open: boolean) => void;
};

export function UploadPageHeader({
  allUsers,
  canRead,
  historyOpen,
  isLoadingMaster,
  isLoggingIn,
  loggedInUser,
  loginPopoverOpen,
  onHistoryOpenChange,
  onLoginAs,
  onLogout,
  onLoginPopoverOpenChange,
}: Props) {
  return (
    <header className="bg-white border-b border-border/60 sticky top-0 z-20 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground">
              Kế Toán Upload
            </span>
            <span className="hidden sm:inline text-muted-foreground text-xs ml-2">
              / Nhập liệu dữ liệu tài chính
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoadingMaster && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="hidden sm:inline">Đang tải...</span>
            </span>
          )}

          {loggedInUser && canRead && (
            <button
              onClick={() => onHistoryOpenChange(!historyOpen)}
              className="flex items-center gap-1.5 border border-border/60 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              title="Lịch sử file của tôi"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lịch sử</span>
            </button>
          )}

          {loggedInUser ? (
            <Popover
              open={loginPopoverOpen}
              onOpenChange={onLoginPopoverOpenChange}
            >
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 bg-primary/8 border border-primary/15 rounded-full pl-2 pr-3 py-1.5 hover:bg-primary/12 transition-colors">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold",
                      AVATAR_COLORS[
                        allUsers.findIndex(
                          (user) => user.user_id === loggedInUser.user_id,
                        ) % AVATAR_COLORS.length
                      ],
                    )}
                  >
                    {getInitials(loggedInUser.full_name)}
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    {loggedInUser.full_name}
                  </span>
                  <ChevronDown className="w-3 h-3 text-primary/60" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 p-2 rounded-2xl shadow-lg"
              >
                <p className="text-[11px] font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wide">
                  Chuyển tài khoản
                </p>
                <div className="space-y-0.5">
                  {allUsers
                    .filter((user) => user.is_active)
                    .map((user, index) => {
                      const isActive = loggedInUser.user_id === user.user_id;
                      return (
                        <button
                          key={user.user_id}
                          onClick={() => onLoginAs(user)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                            isActive ? "bg-primary/10" : "hover:bg-muted",
                          )}
                        >
                          <div
                            className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0",
                              AVATAR_COLORS[index % AVATAR_COLORS.length],
                            )}
                          >
                            {getInitials(user.full_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-xs font-semibold truncate",
                                isActive ? "text-primary" : "text-foreground",
                              )}
                            >
                              {user.full_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                          {isActive && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                </div>
                <div className="border-t border-border/50 mt-2 pt-2">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Đăng xuất
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Popover
              open={loginPopoverOpen}
              onOpenChange={onLoginPopoverOpenChange}
            >
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  disabled={isLoggingIn || isLoadingMaster}
                  className="h-8 gap-2 rounded-full px-4 shadow-sm"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5" />
                  )}
                  {isLoggingIn ? "Đang xử lý..." : "Đăng nhập"}
                  {!isLoggingIn && (
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 p-2 rounded-2xl shadow-lg"
              >
                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Chọn tài khoản
                  </p>
                </div>
                <div className="space-y-0.5">
                  {allUsers.filter((user) => user.is_active).length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">
                      Không có dữ liệu users_app để đăng nhập.
                    </p>
                  )}
                  {allUsers
                    .filter((user) => user.is_active)
                    .map((user, index) => (
                      <button
                        key={user.user_id}
                        onClick={() => onLoginAs(user)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-colors group"
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0",
                            AVATAR_COLORS[index % AVATAR_COLORS.length],
                          )}
                        >
                          {getInitials(user.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {user.full_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <LogIn className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}
