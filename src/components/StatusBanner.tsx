import React from "react";
import { Calendar, AlertCircle, CheckCircle2, Lock, Flame, Info } from "lucide-react";
import { AppConfig } from "../types";

interface StatusBannerProps {
  config: AppConfig;
  isOpen: boolean;
  totalSeats: number;
  availableSeats: number;
  nextOpenTimeStr: string;
  nextResetTimeStr: string;
  currentTimeFormatted?: string;
}

const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export const StatusBanner: React.FC<StatusBannerProps> = ({
  config,
  isOpen,
  totalSeats,
  availableSeats,
  nextOpenTimeStr,
  nextResetTimeStr,
  currentTimeFormatted,
}) => {
  const { timeConfig } = config;
  const occupiedSeats = totalSeats - availableSeats;

  const openTimeDesc = `${dayNames[timeConfig.openDay]} ${String(timeConfig.openHour).padStart(2, "0")}:${String(
    timeConfig.openMinute
  ).padStart(2, "0")}`;

  const resetTimeDesc = `${dayNames[timeConfig.closeDay]} ${String(timeConfig.closeHour).padStart(2, "0")}:${String(
    timeConfig.closeMinute
  ).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Rule & Timing Bar */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-stone-900">本周自习室预约规则</span>
              {timeConfig.alwaysOpenForTesting && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                  测试模式（全天候开放中）
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-stone-600">
              每周 <strong className="text-stone-900">{openTimeDesc}</strong> 准时开放本周选座，每周{" "}
              <strong className="text-stone-900">{resetTimeDesc}</strong> 系统自动清空本周预约数据。
              {currentTimeFormatted && (
                <span className="text-stone-500 font-normal ml-2">（当前服务器时间：{currentTimeFormatted}）</span>
              )}
            </p>
          </div>

          {/* Seat Stats */}
          <div className="flex items-center gap-3 sm:gap-6 bg-white px-4 py-2.5 rounded-lg border border-stone-200 shadow-xs">
            <div className="text-center">
              <span className="block text-xs text-stone-700">总座位</span>
              <span className="text-base sm:text-lg font-bold text-stone-800">{totalSeats}</span>
            </div>
            <div className="w-px h-6 bg-stone-200" />
            <div className="text-center">
              <span className="block text-xs text-emerald-600 font-medium">剩余可约</span>
              <span className="text-base sm:text-lg font-bold text-emerald-600">{availableSeats}</span>
            </div>
            <div className="w-px h-6 bg-stone-200" />
            <div className="text-center">
              <span className="block text-xs text-stone-700">已锁定</span>
              <span className="text-base sm:text-lg font-bold text-stone-700">{occupiedSeats}</span>
            </div>
          </div>
        </div>

        {/* Live Tips */}
        <div className="mt-3 pt-3 border-t border-stone-200/80 flex flex-wrap items-center justify-between text-xs text-stone-700 gap-2">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>实时多IP协同抢座中 · 名字支持纯中文或纯英文 · 选座后请按需刷新页面继续选座</span>
          </div>
          <div className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-stone-400" />
            <span>每人限占 1 席</span>
          </div>
        </div>
      </div>

      {/* Warning banner when closed */}
      {!isOpen && (
        <div
          id="closed-notice-banner"
          className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-900"
        >
          <Lock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">非规定时间，预约系统目前已锁定</h4>
            <p className="text-xs sm:text-sm text-rose-700">
              当前时间不在预约窗口内，所有座位暂时无法点击或提交预约。开放时间为：
              <span className="font-semibold underline ml-1">{nextOpenTimeStr}</span>。
              {currentTimeFormatted && (
                <span className="ml-1 text-rose-800">（当前系统时间：{currentTimeFormatted}）</span>
              )}
              若为测试人员，可在管理员后台开启“测试模式”直接体验预约。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
