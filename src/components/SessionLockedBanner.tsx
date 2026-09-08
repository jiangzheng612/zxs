import React from "react";
import { CheckCircle, RefreshCw, Armchair } from "lucide-react";

interface SessionLockedBannerProps {
  reservedSeatId: number;
  reservedName: string;
  onRefresh: () => void;
}

export const SessionLockedBanner: React.FC<SessionLockedBannerProps> = ({
  reservedSeatId,
  reservedName,
  onRefresh,
}) => {
  return (
    <div
      id="session-reserved-notice"
      className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs"
    >
      <div className="flex items-start sm:items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
          <CheckCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-emerald-900">
              您已成功预约【{String(reservedSeatId).padStart(2, "0")} 号座】
            </h4>
            <span className="text-xs bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-semibold">
              姓名: {reservedName}
            </span>
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            根据规则，单次进入系统仅可预约 1 个座位。如需为其他同学预约或重新选座，请刷新本页面。
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          id="reload-page-for-next-seat-btn"
          onClick={onRefresh}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>刷新页面 (选下一个座位)</span>
        </button>
      </div>
    </div>
  );
};
