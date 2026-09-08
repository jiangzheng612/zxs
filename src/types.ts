export interface Seat {
  id: number;           // 1 to 15
  isReserved: boolean;
  reservedBy: string | null;      // Student name
  reservedAt: string | null;      // ISO string or formatted time
  ip?: string;                    // Client IP for logging
}

export interface BlacklistItem {
  name: string;
  addedAt: string;
  reason?: string;
}

export interface TimeConstraintConfig {
  openDay: number;       // 0=Sun, 1=Mon, ..., 6=Sat (Default 1: Mon)
  openHour: number;      // 0-23 (Default 8: 08:00)
  openMinute: number;    // 0-59 (Default 0)
  closeDay: number;      // 0-6 (Default 6: Sat)
  closeHour: number;     // 0-23 (Default 8: 08:00)
  closeMinute: number;   // 0-59 (Default 0)
  alwaysOpenForTesting: boolean; // Facilitate easy testing anytime
}

export interface AppConfig {
  systemTitle: string;
  timeConfig: TimeConstraintConfig;
  lastWeeklyResetAt: string | null;
}

export interface SystemStatusResponse {
  seats: Seat[];
  config: AppConfig;
  isOpen: boolean;
  nextOpenTimeStr: string;
  nextResetTimeStr: string;
  currentTimeStr: string;
  currentTimeFormatted?: string;
  totalSeats: number;
  availableSeats: number;
  blacklistedCount: number;
}
