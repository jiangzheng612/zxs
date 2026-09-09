import React from "react";
import { Lock, User, Armchair, CheckCircle, Building2, Phone } from "lucide-react";
import { Seat } from "../types";

interface SeatGridProps {
  seats: Seat[];
  isOpen: boolean;
  hasReservedInSession: boolean;
  myReservedSeatId: number | null;
  onSelectSeat: (seat: Seat) => void;
}

export const SeatGrid: React.FC<SeatGridProps> = ({
  seats,
  isOpen,
  hasReservedInSession,
  myReservedSeatId,
  onSelectSeat,
}) => {
  // Helper for masking phone number (e.g. 13800138000 -> 138****8000) for privacy on public page
  const maskPhone = (phone?: string | null) => {
    if (!phone) return "";
    const clean = phone.trim();
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}****${clean.slice(7)}`;
    }
    return clean;
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-7 shadow-xs">
      {/* Floor Plan Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-5 border-b border-stone-200 gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Armchair className="w-5 h-5 text-amber-700" />
            <span>自习室座位平面图 (共16席)</span>
          </h2>
          <p className="text-xs text-stone-700 mt-1">
            实时同步预约状态 · 选中即锁定防抢 · 4×4 矩阵自适应布局
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-emerald-50 border border-emerald-300 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <span className="text-stone-600">空闲可约</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-rose-50 border border-rose-300 flex items-center justify-center">
              <Lock className="w-2.5 h-2.5 text-rose-500" />
            </div>
            <span className="text-stone-600">已锁定 (姓名+课题组)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-amber-500 border border-amber-600 flex items-center justify-center">
              <CheckCircle className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-stone-700 font-medium">我的预约</span>
          </div>
        </div>
      </div>

      {/* 16 Seats Grid: 4 columns x 4 rows on desktop/tablet, 2 columns on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
        {seats.map((seat) => {
          const isOccupied = seat.isReserved;
          const isMine = myReservedSeatId === seat.id;
          const canClick = isOpen && !isOccupied;

          return (
            <div
              key={seat.id}
              id={`seat-card-${seat.id}`}
              onClick={() => {
                if (canClick) {
                  onSelectSeat(seat);
                }
              }}
              className={`relative rounded-xl border p-3.5 sm:p-4 transition-all duration-200 flex flex-col justify-between select-none ${
                isMine
                  ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-400 shadow-sm"
                  : isOccupied
                  ? "bg-stone-50 border-stone-200 opacity-95 cursor-not-allowed"
                  : !isOpen
                  ? "bg-stone-100/70 border-stone-200 opacity-60 cursor-not-allowed"
                  : "bg-white border-stone-200 hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-98"
              }`}
              style={{ minHeight: "175px" }}
            >
              {/* Desk Top: Seat Number + Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold font-mono ${
                      isMine
                        ? "bg-amber-600 text-white"
                        : isOccupied
                        ? "bg-stone-200 text-stone-700"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {String(seat.id).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-semibold text-stone-800">号座</span>
                </div>

                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isMine
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : isOccupied
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {isMine ? "我的预约" : isOccupied ? "已锁定" : "可预约"}
                </span>
              </div>

              {/* Desk Middle: Reserved Details or Open Status */}
              <div className="my-2 py-2 flex flex-col items-center justify-center border-y border-dashed border-stone-200/80 min-h-[76px]">
                {isOccupied ? (
                  <div className="flex flex-col items-center text-center w-full px-0.5 space-y-1">
                    {/* Prominent Name Badge */}
                    <div
                      id={`seat-${seat.id}-name-badge`}
                      className={`w-full py-1 px-2 rounded-lg text-xs font-bold truncate flex items-center justify-center gap-1 shadow-2xs ${
                        isMine
                          ? "bg-amber-500 text-white"
                          : "bg-stone-200 text-stone-900 border border-stone-300"
                      }`}
                      title={seat.reservedBy || "已预约"}
                    >
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{seat.reservedBy}</span>
                    </div>

                    {/* Research Group Tag */}
                    {seat.researchGroup && (
                      <div
                        className="w-full py-0.5 px-2 rounded-md bg-stone-100 border border-stone-200 text-[11px] text-stone-700 truncate flex items-center justify-center gap-1"
                        title={`课题组: ${seat.researchGroup}`}
                      >
                        <Building2 className="w-3 h-3 text-stone-500 shrink-0" />
                        <span className="truncate font-medium">{seat.researchGroup}</span>
                      </div>
                    )}

                    {/* Masked Phone for Privacy */}
                    {seat.phone && (
                      <div
                        className="text-[11px] text-stone-500 flex items-center gap-1 font-mono"
                        title="联系电话已进行隐私脱敏保护"
                      >
                        <Phone className="w-2.5 h-2.5" />
                        <span>{maskPhone(seat.phone)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                      <Armchair className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">
                      {isOpen ? "虚位以待 · 点击预约" : "暂未开放"}
                    </span>
                  </div>
                )}
              </div>

              {/* Desk Bottom: Quick Action Note */}
              <div className="text-[11px] flex items-center justify-between text-stone-600 pt-0.5">
                {isOccupied ? (
                  <>
                    <span className="text-stone-500">
                      {seat.reservedAt
                        ? new Date(seat.reservedAt).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }) + " 锁定"
                        : "已预约"}
                    </span>
                    {isMine ? (
                      <span className="text-amber-700 font-semibold">本席位</span>
                    ) : (
                      <span className="text-stone-400">已占座</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-emerald-700 font-medium">空余席位</span>
                    {isOpen && (
                      <span className="text-amber-700 font-bold group-hover:underline">
                        选座 →
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
