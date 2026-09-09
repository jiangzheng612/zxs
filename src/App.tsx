import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { StatusBanner } from "./components/StatusBanner";
import { SeatGrid } from "./components/SeatGrid";
import { ReservationModal } from "./components/ReservationModal";
import { SessionLockedBanner } from "./components/SessionLockedBanner";
import { AdminModal } from "./components/AdminModal";
import { Seat, AppConfig, SystemStatusResponse } from "./types";
import { ShieldAlert, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

const initialSeats: Seat[] = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  isReserved: false,
  reservedBy: null,
  phone: null,
  researchGroup: null,
  reservedAt: null,
}));

const initialConfig: AppConfig = {
  systemTitle: "自习室座位预约系统",
  timeConfig: {
    openDay: 1,
    openHour: 8,
    openMinute: 0,
    closeDay: 6,
    closeHour: 8,
    closeMinute: 0,
    alwaysOpenForTesting: false,
  },
  lastWeeklyResetAt: null,
};

export default function App() {
  const [seats, setSeats] = useState<Seat[]>(initialSeats);
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [nextOpenTimeStr, setNextOpenTimeStr] = useState<string>("周一 08:00");
  const [nextResetTimeStr, setNextResetTimeStr] = useState<string>("周六 08:00");
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState<string>("");
  const [totalSeats, setTotalSeats] = useState<number>(16);
  const [availableSeats, setAvailableSeats] = useState<number>(16);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active modal states
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Single-seat per session constraint
  // "进入系统的人只能选一个座位，如果想选下一个座位需要重新刷新页面。"
  const [mySessionReservation, setMySessionReservation] = useState<{
    seatId: number;
    name: string;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem("my_study_seat_reservation");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Global Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch status from API
  const fetchStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/status");
      if (res.ok) {
        const data: SystemStatusResponse = await res.json();
        setSeats(data.seats || []);
        setConfig(data.config || initialConfig);
        setIsOpen(data.isOpen);
        setNextOpenTimeStr(data.nextOpenTimeStr);
        setNextResetTimeStr(data.nextResetTimeStr);
        if (data.currentTimeFormatted) {
          setCurrentTimeFormatted(data.currentTimeFormatted);
        }
        setTotalSeats(data.totalSeats || 15);
        setAvailableSeats(data.availableSeats);

        // Update document title dynamically based on configured title
        if (data.config?.systemTitle) {
          document.title = data.config.systemTitle;
        }
      }
    } catch (err) {
      console.error("Failed to fetch system status:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial load + Real-time Server-Sent Events (SSE)
  useEffect(() => {
    fetchStatus();

    // Setup SSE connection for instant multi-user concurrent updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/events");
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.seats) {
            setSeats(data.seats);
            const avail = data.seats.filter((s: Seat) => !s.isReserved).length;
            setAvailableSeats(avail);
          }
          if (data.config) {
            setConfig(data.config);
            if (data.config.systemTitle) {
              document.title = data.config.systemTitle;
            }
          }
          if (typeof data.isOpen === "boolean") {
            setIsOpen(data.isOpen);
          }
          if (data.nextOpenTimeStr) {
            setNextOpenTimeStr(data.nextOpenTimeStr);
          }
          if (data.nextResetTimeStr) {
            setNextResetTimeStr(data.nextResetTimeStr);
          }
          if (data.currentTimeFormatted) {
            setCurrentTimeFormatted(data.currentTimeFormatted);
          }
        } catch (e) {
          console.error("Error parsing SSE event data:", e);
        }
      };
      eventSource.onerror = () => {
        // SSE dropped, will auto-reconnect
      };
    } catch (err) {
      console.error("EventSource failed:", err);
    }

    // Secondary fallback polling every 4 seconds
    const interval = setInterval(fetchStatus, 4000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [fetchStatus]);

  // Handle seat click
  const handleSelectSeat = (seat: Seat) => {
    if (!isOpen) {
      showToast("当前非规定开放时间，系统暂不允许选座！", "error");
      return;
    }

    if (seat.isReserved) {
      showToast(`该座位已被【${seat.reservedBy}】锁定占用，无法再次选中。`, "error");
      return;
    }

    // Constraint: Single seat per session
    // "进入系统的人只能选一个座位，如果想选下一个座位需要重新刷新页面。"
    if (mySessionReservation) {
      showToast(
        `您已在本页面预约了【${mySessionReservation.seatId} 号座】。根据规则，单次进入仅限选一个座位；如想选下一个座位，请重新刷新本页面。`,
        "info"
      );
      return;
    }

    setSelectedSeat(seat);
  };

  // Submit reservation
  const handleReserve = async (
    seatId: number,
    name: string,
    phone: string,
    researchGroup: string
  ): Promise<{ success: boolean; error?: string; isBlacklisted?: boolean }> => {
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatId, name, phone, researchGroup }),
      });

      let data: any = null;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        return {
          success: false,
          error: "网络通讯异常，请稍后刷新重试",
        };
      }

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || "预约失败",
          isBlacklisted: Boolean(data.isBlacklisted),
        };
      }

      // Mark session as reserved
      const sessionData = { seatId, name };
      setMySessionReservation(sessionData);
      try {
        sessionStorage.setItem("my_study_seat_reservation", JSON.stringify(sessionData));
      } catch {
        // storage ignored
      }

      setSelectedSeat(null);
      showToast(data.message || `恭喜！已成功锁定 ${seatId} 号座位！`, "success");
      fetchStatus();
      return { success: true };
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("<") || msg.includes("JSON") || msg.includes("token")) {
        return { success: false, error: "网络通讯异常，请稍后刷新重试" };
      }
      return { success: false, error: msg || "请求失败，请检查网络" };
    }
  };

  // Page reload helper for next seat
  const handleRefreshPage = () => {
    try {
      sessionStorage.removeItem("my_study_seat_reservation");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans">
      {/* Global Top Toast Alert */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`p-4 rounded-xl shadow-xl border text-xs sm:text-sm font-medium flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : toast.type === "error"
                ? "bg-rose-50 border-rose-300 text-rose-900"
                : "bg-amber-50 border-amber-300 text-amber-900"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === "info" && <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Header */}
      <Header
        systemTitle={config.systemTitle}
        isOpen={isOpen}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onRefresh={fetchStatus}
        isRefreshing={isRefreshing}
      />

      {/* Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Session Reserved Banner (shown if user booked in this session) */}
        {mySessionReservation && (
          <SessionLockedBanner
            reservedSeatId={mySessionReservation.seatId}
            reservedName={mySessionReservation.name}
            onRefresh={handleRefreshPage}
          />
        )}

        {/* Schedule & Availability Status Banner */}
        <StatusBanner
          config={config}
          isOpen={isOpen}
          totalSeats={totalSeats}
          availableSeats={availableSeats}
          nextOpenTimeStr={nextOpenTimeStr}
          nextResetTimeStr={nextResetTimeStr}
          currentTimeFormatted={currentTimeFormatted}
        />

        {/* 15 Seats Floor Grid */}
        <SeatGrid
          seats={seats}
          isOpen={isOpen}
          hasReservedInSession={Boolean(mySessionReservation)}
          myReservedSeatId={mySessionReservation?.seatId || null}
          onSelectSeat={handleSelectSeat}
        />
      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-700 gap-2">
          <div>
            <span>© {new Date().getFullYear()} {config.systemTitle}</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsAdminOpen(true)}
              className="text-stone-700 hover:text-amber-700 underline"
            >
              管理员配置
            </button>
          </div>
        </div>
      </footer>

      {/* Reservation Dialog Modal */}
      <ReservationModal
        seat={selectedSeat}
        onClose={() => setSelectedSeat(null)}
        onReserve={handleReserve}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        config={config}
        seats={seats}
        currentTimeFormatted={currentTimeFormatted}
        onConfigUpdated={(newConf) => {
          setConfig(newConf);
          fetchStatus();
        }}
        onSeatsUpdated={(newSeats) => {
          setSeats(newSeats);
          const avail = newSeats.filter((s) => !s.isReserved).length;
          setAvailableSeats(avail);
        }}
      />
    </div>
  );
}
