import React, { useState, useEffect } from "react";
import { Clock, ShieldCheck, RefreshCw, Sparkles } from "lucide-react";

interface HeaderProps {
  systemTitle: string;
  isOpen: boolean;
  onOpenAdmin: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  systemTitle,
  isOpen,
  onOpenAdmin,
  onRefresh,
  isRefreshing = false,
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      const dayStr = days[now.getDay()];
      const timeStr = now.toLocaleTimeString("zh-CN", { hour12: false });
      const dateStr = now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      setCurrentTime(`${dateStr} ${dayStr} ${timeStr}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand and Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <span>{systemTitle || "自习室座位预约系统"}</span>
            </h1>
            <p className="text-xs text-stone-700 hidden sm:block">
              16席自习空间 · 实时在线选座预约
            </p>
          </div>
        </div>

        {/* Right: Clock, Status, Admin button */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Real-time Clock */}
          <div className="hidden md:flex items-center text-xs font-mono text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-stone-500" />
            <span>{currentTime}</span>
          </div>

          {/* System Open Status Tag */}
          <div
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOpen
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            {isOpen ? "预约开放中" : "非开放时段"}
          </div>

          {/* Refresh Button */}
          <button
            id="refresh-page-btn"
            onClick={onRefresh}
            title="手动刷新座位状态"
            className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-amber-600" : ""}`} />
          </button>

          {/* Admin Access Button */}
          <button
            id="open-admin-btn"
            onClick={onOpenAdmin}
            className="inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition-all shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>管理员后台</span>
          </button>
        </div>
      </div>
    </header>
  );
};
