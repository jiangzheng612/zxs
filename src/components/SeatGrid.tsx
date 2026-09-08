import React from "react";
import { Lock, User, Armchair, CheckCircle } from "lucide-react";
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
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-8 shadow-xs">
      {/* Floor Plan Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-stone-200 gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Armchair className="w-5 h-5 text-amber-700" />
            <span>自习室座位平面图 (共15席)</span>
          </h2>
          <p className="text-xs text-stone-700 mt-1">
            实时同步预约状态 · 选中即锁定防抢
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
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
            <span className="text-stone-600">已锁定 (显示姓名)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-md bg-amber-500 border border-amber-600 flex items-center justify-center">
              <CheckCircle className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-stone-700 font-medium">我的预约</span>
          </div>
        </div>
      </div>

      {/* 15 Seats Grid: 3 rows of 5 desks or 5 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
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
              className={`relative rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between select-none ${
                isMine
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400 shadow-sm"
                  : isOccupied
                  ? "bg-stone-50 border-stone-200 opacity-90 cursor-not-allowed"
                  : !isOpen
                  ? "bg-stone-100/70 border-stone-200 opacity-60 cursor-not-allowed"
                  : "bg-white border-stone-200 hover:border-amber-500 hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-98"
              }`}
              style={{ minHeight: "155px" }}
            >
              {/* Desk Top: Seat Number */}
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
                  <span className="text-xs font-medium text-stone-700">号座</span>
                </div>

                <div className="text-[11px] font-mono text-stone-400">
                  {isOccupied ? "已占用" : "可用"}
                </div>
              </div>

              {/* Desk Middle: Visual representation of Desk + Chair */}
              <div className="my-2 py-2 flex flex-col items-center justify-center border-y border-dashed border-stone-200/70">
                {isOccupied ? (
                  <div className="flex flex-col items-center text-center w-full px-1">
                    <div className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium mb-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>已被抢占·锁定</span>
                    </div>

                    {/* Prominent Name Badge required by prompt */}
                    <div
                      id={`seat-${seat.id}-name-badge`}
                      className={`w-full py-1 px-2 rounded-md text-xs font-bold truncate flex items-center justify-center gap-1 shadow-2xs ${
                        isMine
                          ? "bg-amber-500 text-white"
                          : "bg-stone-200 text-stone-800 border border-stone-300"
                      }`}
                      title={seat.reservedBy || "已预约"}
                    >
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{seat.reservedBy}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                      <Armchair className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">
                      {isOpen ? "虚位以待 · 点击预约" : "暂未开放"}
                    </span>
                  </div>
                )}
              </div>

              {/* Desk Bottom: Status Action / Timestamp */}
              <div className="text-[11px] flex items-center justify-between text-stone-700">
                {isOccupied ? (
                  <>
                    <span className="text-stone-700">状态：已预约</span>
                    {isMine && <span className="text-amber-700 font-medium">我的位置</span>}
                  </>
                ) : (
                  <>
                    <span className="text-emerald-700">状态：空闲</span>
                    {isOpen && (
                      <span className="text-amber-700 font-medium group-hover:underline">
                        抢座 →
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
