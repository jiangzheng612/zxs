import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Seat, AppConfig, BlacklistItem, TimeConstraintConfig } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());

// Set timezone to Asia/Shanghai for Node environment
process.env.TZ = "Asia/Shanghai";

// State directory & persistence
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

interface ServerState {
  adminPassword: string; // Initial preset: 910802
  config: AppConfig;
  blacklist: BlacklistItem[];
  seats: Seat[];
  lastResetWeekKey: string;
}

// Default initial state
function getInitialSeats(): Seat[] {
  return Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    isReserved: false,
    reservedBy: null,
    phone: null,
    researchGroup: null,
    reservedAt: null,
  }));
}

const defaultTimeConfig: TimeConstraintConfig = {
  openDay: 1,      // Monday
  openHour: 8,     // 08:00
  openMinute: 0,
  closeDay: 6,     // Saturday
  closeHour: 8,    // 08:00
  closeMinute: 0,
  alwaysOpenForTesting: false,
};

let state: ServerState = {
  adminPassword: "910802", // Default preset password
  config: {
    systemTitle: "自习室座位预约系统",
    timeConfig: defaultTimeConfig,
    lastWeeklyResetAt: null,
  },
  blacklist: [
    { name: "测试黑名单", addedAt: new Date().toISOString(), reason: "示例黑名单测试" }
  ],
  seats: getInitialSeats(),
  lastResetWeekKey: "",
};

// Safe Beijing Time (UTC+8) helper across all container environments
function getBeijingDate(date: Date = new Date()): {
  year: number;
  month: number;
  date: number;
  day: number; // 0: 周日, 1: 周一, ... 6: 周六
  hour: number;
  minute: number;
  second: number;
  weekMinute: number;
  isoBeijing: string;
  formattedStr: string;
} {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const beijingMs = utcMs + 8 * 3600000;
  const bj = new Date(beijingMs);

  const day = bj.getDay();
  const hour = bj.getHours();
  const minute = bj.getMinutes();
  const second = bj.getSeconds();
  const weekMinute = day * 24 * 60 + hour * 60 + minute;
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const pad = (n: number) => String(n).padStart(2, "0");

  const formattedStr = `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${days[day]} ${pad(hour)}:${pad(minute)}:${pad(second)}`;

  return {
    year: bj.getFullYear(),
    month: bj.getMonth() + 1,
    date: bj.getDate(),
    day,
    hour,
    minute,
    second,
    weekMinute,
    isoBeijing: bj.toISOString(),
    formattedStr,
  };
}

// Load persisted state if available
function loadState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed) {
        state = {
          ...state,
          ...parsed,
          config: {
            ...state.config,
            ...(parsed.config || {}),
            timeConfig: {
              ...state.config.timeConfig,
              ...(parsed.config?.timeConfig || {})
            }
          }
        };
        // Guarantee 16 seats exist
        if (!state.seats || !Array.isArray(state.seats)) {
          state.seats = getInitialSeats();
        } else if (state.seats.length < 16) {
          for (let i = state.seats.length + 1; i <= 16; i++) {
            state.seats.push({
              id: i,
              isReserved: false,
              reservedBy: null,
              phone: null,
              researchGroup: null,
              reservedAt: null,
            });
          }
        } else if (state.seats.length > 16) {
          state.seats = state.seats.slice(0, 16);
        }
      }
    }
  } catch (err) {
    console.error("Failed to load persisted state:", err);
  }
}

function saveState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

loadState();

// SSE (Server-Sent Events) clients for real-time live synchronization
type SSEClient = { id: number; res: Response };
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastStateUpdate() {
  const now = new Date();
  const bj = getBeijingDate(now);
  const { timeConfig } = state.config;
  const openStr = formatRuleTime(timeConfig.openDay, timeConfig.openHour, timeConfig.openMinute);
  const closeStr = formatRuleTime(timeConfig.closeDay, timeConfig.closeHour, timeConfig.closeMinute);
  const availableSeats = state.seats.filter((s) => !s.isReserved).length;

  const payload = JSON.stringify({
    type: "STATE_UPDATE",
    seats: state.seats,
    config: {
      systemTitle: state.config.systemTitle,
      timeConfig: state.config.timeConfig,
      lastWeeklyResetAt: state.config.lastWeeklyResetAt,
    },
    isOpen: checkIsSystemOpen(now),
    nextOpenTimeStr: openStr,
    nextResetTimeStr: closeStr,
    currentTimeStr: bj.isoBeijing,
    currentTimeFormatted: bj.formattedStr,
    availableSeats,
    timestamp: Date.now(),
  });

  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      // client dropped
    }
  });
}

// Compute week cycle key to detect Saturday 8:00 auto-clear
function getWeekCycleKey(date: Date = new Date()): string {
  const bj = getBeijingDate(date);
  return `${bj.year}-W${Math.ceil((bj.date + 6) / 7)}-${bj.month}`;
}

// Check if reservation is currently open (evaluated against Beijing Time UTC+8)
function checkIsSystemOpen(now: Date = new Date()): boolean {
  const { timeConfig } = state.config;
  if (timeConfig.alwaysOpenForTesting) {
    return true;
  }

  const bj = getBeijingDate(now);
  const currentWeekMinute = bj.weekMinute;
  const openWeekMinute = timeConfig.openDay * 24 * 60 + timeConfig.openHour * 60 + timeConfig.openMinute;
  const closeWeekMinute = timeConfig.closeDay * 24 * 60 + timeConfig.closeHour * 60 + timeConfig.closeMinute;

  if (openWeekMinute < closeWeekMinute) {
    return currentWeekMinute >= openWeekMinute && currentWeekMinute < closeWeekMinute;
  } else if (openWeekMinute > closeWeekMinute) {
    // Spans over the weekend cycle (e.g. open Fri 18:00, close Mon 08:00)
    return currentWeekMinute >= openWeekMinute || currentWeekMinute < closeWeekMinute;
  } else {
    // If open and close are identical, consider it open 24/7
    return true;
  }
}

// Check and execute auto-reset if reset condition hit (evaluated against Beijing Time UTC+8)
function checkWeeklyAutoReset() {
  const now = new Date();
  const bj = getBeijingDate(now);
  const { timeConfig } = state.config;
  
  const currentWeekMinute = bj.weekMinute;
  const closeWeekMinute = timeConfig.closeDay * 24 * 60 + timeConfig.closeHour * 60 + timeConfig.closeMinute;
  
  const currentCycleKey = `${bj.year}-${bj.month}-${Math.floor(bj.date / 7)}-bj-reset`;
  
  // If we crossed the reset point in this week and haven't reset yet
  if (currentWeekMinute >= closeWeekMinute && state.lastResetWeekKey !== currentCycleKey) {
    // Check if any seats are reserved
    const hasReservations = state.seats.some((s) => s.isReserved);
    if (hasReservations) {
      console.log(`[Auto-Reset] Saturday 08:00 threshold reached at Beijing Time ${bj.formattedStr}, resetting weekly reservations.`);
      state.seats = getInitialSeats();
      state.config.lastWeeklyResetAt = new Date().toISOString();
      state.lastResetWeekKey = currentCycleKey;
      saveState();
      broadcastStateUpdate();
    }
  }
}

// Check every 10 seconds for automatic reset
setInterval(checkWeeklyAutoReset, 10000);

// Helper for formatting time strings
function getDayName(dayIndex: number): string {
  const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return days[dayIndex] || `周${dayIndex}`;
}

function formatRuleTime(day: number, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${getDayName(day)} ${hh}:${mm}`;
}

// Validate student name
// Rule: Must be either entirely Chinese characters (2-10 chars) or entirely English letters (2-20 chars, case-insensitive)
function validateStudentName(name: string): { valid: boolean; error?: string; cleanedName: string } {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return { valid: false, error: "请输入姓名", cleanedName: "" };
  }

  const isAllChinese = /^[\u4e00-\u9fa5]{2,10}$/.test(trimmed);
  const isAllEnglish = /^[a-zA-Z\s]{2,20}$/.test(trimmed);

  if (!isAllChinese && !isAllEnglish) {
    return {
      valid: false,
      error: "姓名格式不正确：只能是全中文（2-10字）或全英文（2-20字母，不区分大小写），且不能混杂数字或符号",
      cleanedName: trimmed,
    };
  }

  return { valid: true, cleanedName: trimmed };
}

// Validate student phone number: must be exactly 11 digits
function validatePhone(phone: string): { valid: boolean; error?: string; cleanedPhone: string } {
  const trimmed = String(phone || "").trim();
  if (!trimmed) {
    return { valid: false, error: "请输入预约人联系电话", cleanedPhone: "" };
  }

  if (!/^\d{11}$/.test(trimmed)) {
    return {
      valid: false,
      error: "联系电话格式不正确：必须填写11位数字（例如 13800138000）",
      cleanedPhone: trimmed,
    };
  }

  return { valid: true, cleanedPhone: trimmed };
}

// Validate student research group: max 7 Chinese characters
function validateResearchGroup(group: string): { valid: boolean; error?: string; cleanedGroup: string } {
  const trimmed = String(group || "").trim();
  if (!trimmed) {
    return { valid: false, error: "请输入来自的课题组名称", cleanedGroup: "" };
  }

  if (!/^[\u4e00-\u9fa5]{1,7}$/.test(trimmed)) {
    return {
      valid: false,
      error: "课题组格式不正确：最多填写7个汉字，且不能包含数字、英文或符号",
      cleanedGroup: trimmed,
    };
  }

  return { valid: true, cleanedGroup: trimmed };
}

// --- API ROUTES ---

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// SSE endpoint for live seat changes
app.get("/api/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = nextClientId++;
  sseClients.push({ id: clientId, res });

  // Send immediate initial sync
  const now = new Date();
  const bj = getBeijingDate(now);
  const openStr = formatRuleTime(state.config.timeConfig.openDay, state.config.timeConfig.openHour, state.config.timeConfig.openMinute);
  const closeStr = formatRuleTime(state.config.timeConfig.closeDay, state.config.timeConfig.closeHour, state.config.timeConfig.closeMinute);
  const availableSeats = state.seats.filter((s) => !s.isReserved).length;

  const initialData = JSON.stringify({
    type: "INITIAL_SYNC",
    seats: state.seats,
    config: {
      systemTitle: state.config.systemTitle,
      timeConfig: state.config.timeConfig,
      lastWeeklyResetAt: state.config.lastWeeklyResetAt,
    },
    isOpen: checkIsSystemOpen(now),
    nextOpenTimeStr: openStr,
    nextResetTimeStr: closeStr,
    currentTimeStr: bj.isoBeijing,
    currentTimeFormatted: bj.formattedStr,
    availableSeats,
    timestamp: Date.now(),
  });
  res.write(`data: ${initialData}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Public status endpoint
app.get("/api/status", (_req: Request, res: Response) => {
  const now = new Date();
  const bj = getBeijingDate(now);
  const isOpen = checkIsSystemOpen(now);
  const { timeConfig } = state.config;

  const openStr = formatRuleTime(timeConfig.openDay, timeConfig.openHour, timeConfig.openMinute);
  const closeStr = formatRuleTime(timeConfig.closeDay, timeConfig.closeHour, timeConfig.closeMinute);

  const availableSeats = state.seats.filter((s) => !s.isReserved).length;

  res.json({
    seats: state.seats,
    config: {
      systemTitle: state.config.systemTitle,
      timeConfig: state.config.timeConfig,
      lastWeeklyResetAt: state.config.lastWeeklyResetAt,
    },
    isOpen,
    nextOpenTimeStr: openStr,
    nextResetTimeStr: closeStr,
    currentTimeStr: bj.isoBeijing,
    currentTimeFormatted: bj.formattedStr,
    totalSeats: 16,
    availableSeats,
    blacklistedCount: state.blacklist.length,
  });
});

// Check student name in real-time for blacklist or existing seat reservation
app.get("/api/check-name", (req: Request, res: Response) => {
  const nameQuery = String(req.query.name || "").trim();
  if (!nameQuery) {
    return res.json({ valid: false, isBlacklisted: false });
  }

  const cleanName = nameQuery.toLowerCase();
  const isBlacklisted = state.blacklist.some(
    (item) => item.name.toLowerCase() === cleanName
  );

  if (isBlacklisted) {
    return res.json({
      valid: false,
      isBlacklisted: true,
      error: "该同学已加入黑名单，如有疑问请联系管理员。",
    });
  }

  const existing = state.seats.find(
    (s) => s.isReserved && s.reservedBy && s.reservedBy.toLowerCase() === cleanName
  );
  if (existing) {
    return res.json({
      valid: false,
      isBlacklisted: false,
      alreadyReserved: true,
      seatId: existing.id,
      error: `同学【${nameQuery}】已经预约了 ${existing.id} 号座位，每位同学只能预约一个座位！`,
    });
  }

  return res.json({
    valid: true,
    isBlacklisted: false,
  });
});

// Reservation endpoint (抢座核心接口，支持多IP高并发与原子冲突检测)
app.post("/api/reserve", (req: Request, res: Response) => {
  const { seatId, name, phone, researchGroup } = req.body;
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "未知IP";

  // 1. Check if reservation is currently open
  const isOpen = checkIsSystemOpen();
  if (!isOpen) {
    const { timeConfig } = state.config;
    const openStr = formatRuleTime(timeConfig.openDay, timeConfig.openHour, timeConfig.openMinute);
    return res.json({
      success: false,
      error: `当前非规定预约时间，系统未开放选座！开放时间为每周 ${openStr}。`,
    });
  }

  // 2. Validate seatId (1 to 16)
  const seatNumber = Number(seatId);
  if (!seatNumber || seatNumber < 1 || seatNumber > 16) {
    return res.json({ success: false, error: "座位号无效，必须为 1 至 16 号座位" });
  }

  // 3. Validate student name (真实姓名)
  const nameValidation = validateStudentName(name);
  if (!nameValidation.valid) {
    return res.json({ success: false, error: nameValidation.error });
  }
  const cleanName = nameValidation.cleanedName;

  // 4. Validate phone number (联系电话：11位数字)
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) {
    return res.json({ success: false, error: phoneValidation.error });
  }
  const cleanPhone = phoneValidation.cleanedPhone;

  // 5. Validate research group (所属课题组：最多7个汉字)
  const groupValidation = validateResearchGroup(researchGroup);
  if (!groupValidation.valid) {
    return res.json({ success: false, error: groupValidation.error });
  }
  const cleanGroup = groupValidation.cleanedGroup;

  // 6. Check Blacklist:
  // "在列表中的名字无法选择座位后输入，如果输入可提示该同学已加入黑名单，如有疑问请联系管理员。"
  const isBlacklisted = state.blacklist.some(
    (item) => item.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (isBlacklisted) {
    return res.json({
      success: false,
      error: "该同学已加入黑名单，如有疑问请联系管理员。",
      isBlacklisted: true,
    });
  }

  // 7. Check if the same student name has already reserved another seat
  // "同一个名字只能选中一个座位，英文不区分大小写"
  const existingReservation = state.seats.find(
    (s) => s.isReserved && s.reservedBy && s.reservedBy.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingReservation) {
    return res.json({
      success: false,
      error: `同学【${cleanName}】已经预约了 ${existingReservation.id} 号座位，每位同学只能预约一个座位！`,
    });
  }

  // 8. Check if target seat is already occupied (抢座并发保护)
  const targetSeat = state.seats.find((s) => s.id === seatNumber);
  if (!targetSeat) {
    return res.json({ success: false, error: "未找到该座位" });
  }
  if (targetSeat.isReserved) {
    return res.json({
      success: false,
      error: `手慢了！${seatNumber} 号座位刚刚已被【${targetSeat.reservedBy}】抢占，请选择其他空余座位！`,
    });
  }

  // 9. Atomic reservation success
  targetSeat.isReserved = true;
  targetSeat.reservedBy = cleanName;
  targetSeat.phone = cleanPhone;
  targetSeat.researchGroup = cleanGroup;
  targetSeat.reservedAt = new Date().toISOString();
  targetSeat.ip = clientIp;

  saveState();
  broadcastStateUpdate();

  return res.json({
    success: true,
    message: `恭喜！已成功为您预约 ${seatNumber} 号座位。`,
    seat: targetSeat,
  });
});

// --- ADMIN API ROUTES ---

// Simple token authentication check middleware
function requireAdminAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "需要管理员权限，请先登录" });
  }
  const token = authHeader.substring(7);
  // Verify token matches active password token
  if (token !== `admin_${state.adminPassword}`) {
    return res.status(401).json({ error: "登录凭证已失效或密码错误，请重新输入管理员密码" });
  }
  next();
}

// Admin login: default preset password is 910802
// "预设密码不可以显示出来" (never returned in cleartext to client)
app.post("/api/admin/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || String(password) !== state.adminPassword) {
    return res.status(401).json({ error: "管理员密码错误，请核对后重试" });
  }

  // Return session token (does NOT expose the raw password)
  const token = `admin_${state.adminPassword}`;
  res.json({
    success: true,
    token,
    message: "管理员身份验证成功",
    config: state.config,
    blacklist: state.blacklist,
    seats: state.seats,
  });
});

// Admin modify password
// "预设密码可以修改"
app.post("/api/admin/change-password", requireAdminAuth, (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  if (String(oldPassword) !== state.adminPassword) {
    return res.status(400).json({ error: "原密码不正确" });
  }
  if (!newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ error: "新密码至少需要 4 位字符" });
  }

  state.adminPassword = String(newPassword).trim();
  saveState();

  const newToken = `admin_${state.adminPassword}`;
  res.json({
    success: true,
    token: newToken,
    message: "管理员密码已成功更新！",
  });
});

// Admin update settings (Title, Time constraints, Test mode)
// "标题可以在配置界面修改，在最终界面展示"
// "设置界面可以调整信息约束信息例如把周一8点开放改成周一到周日，0-24点中的任何值，这样可以便于测试系统"
app.post("/api/admin/config", requireAdminAuth, (req: Request, res: Response) => {
  const { systemTitle, timeConfig } = req.body;

  if (systemTitle && typeof systemTitle === "string") {
    state.config.systemTitle = systemTitle.trim();
  }

  if (timeConfig && typeof timeConfig === "object") {
    const parseField = (val: any, fallback: number, min: number, max: number) => {
      const num = Number(val);
      return !isNaN(num) && num >= min && num <= max ? Math.floor(num) : fallback;
    };

    state.config.timeConfig = {
      openDay: parseField(timeConfig.openDay, state.config.timeConfig.openDay, 0, 6),
      openHour: parseField(timeConfig.openHour, state.config.timeConfig.openHour, 0, 23),
      openMinute: parseField(timeConfig.openMinute, state.config.timeConfig.openMinute, 0, 59),
      closeDay: parseField(timeConfig.closeDay, state.config.timeConfig.closeDay, 0, 6),
      closeHour: parseField(timeConfig.closeHour, state.config.timeConfig.closeHour, 0, 23),
      closeMinute: parseField(timeConfig.closeMinute, state.config.timeConfig.closeMinute, 0, 59),
      alwaysOpenForTesting: Boolean(timeConfig.alwaysOpenForTesting),
    };
  }

  saveState();
  broadcastStateUpdate();

  const now = new Date();
  const openStr = formatRuleTime(state.config.timeConfig.openDay, state.config.timeConfig.openHour, state.config.timeConfig.openMinute);
  const closeStr = formatRuleTime(state.config.timeConfig.closeDay, state.config.timeConfig.closeHour, state.config.timeConfig.closeMinute);

  res.json({
    success: true,
    message: `配置已更新并立即在前台生效！当前每周开放时刻为【${openStr}】，每周自动清空时刻为【${closeStr}】。`,
    config: state.config,
    isOpen: checkIsSystemOpen(now),
    nextOpenTimeStr: openStr,
    nextResetTimeStr: closeStr,
  });
});

// Admin manual clear all reservations
// "配置界面增加一个手动清空所有预约信息的按钮"
app.post("/api/admin/clear-all", requireAdminAuth, (_req: Request, res: Response) => {
  state.seats = getInitialSeats();
  state.config.lastWeeklyResetAt = new Date().toISOString();
  saveState();
  broadcastStateUpdate();

  res.json({
    success: true,
    message: "已成功清空所有 16 个座位的预约记录！",
    seats: state.seats,
  });
});

// Admin cancel individual seat reservation
app.post("/api/admin/cancel-seat", requireAdminAuth, (req: Request, res: Response) => {
  const { seatId } = req.body;
  const targetSeat = state.seats.find((s) => s.id === Number(seatId));
  if (!targetSeat) {
    return res.status(404).json({ error: "座位不存在" });
  }

  const prevStudent = targetSeat.reservedBy;
  targetSeat.isReserved = false;
  targetSeat.reservedBy = null;
  targetSeat.phone = null;
  targetSeat.researchGroup = null;
  targetSeat.reservedAt = null;
  targetSeat.ip = undefined;

  saveState();
  broadcastStateUpdate();

  res.json({
    success: true,
    message: `已成功撤销【${prevStudent || seatId + "号"}】的座位预约！`,
    seats: state.seats,
  });
});

// Admin Blacklist list
app.get("/api/admin/blacklist", requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ blacklist: state.blacklist });
});

// Admin Blacklist Add
// "黑名单列表可以添加和移除"
app.post("/api/admin/blacklist/add", requireAdminAuth, (req: Request, res: Response) => {
  const { name, reason } = req.body;
  const val = validateStudentName(name);
  if (!val.valid) {
    return res.json({ success: false, error: val.error });
  }

  const cleanName = val.cleanedName;
  const exists = state.blacklist.some(
    (item) => item.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (exists) {
    return res.json({ success: false, error: `【${cleanName}】已经在黑名单中，无需重复添加` });
  }

  const newItem: BlacklistItem = {
    name: cleanName,
    addedAt: new Date().toISOString(),
    reason: reason ? String(reason).trim() : "违规占用/爽约",
  };

  state.blacklist.push(newItem);

  // If this student currently holds a seat, also automatically release it!
  const heldSeat = state.seats.find(
    (s) => s.isReserved && s.reservedBy && s.reservedBy.toLowerCase() === cleanName.toLowerCase()
  );
  let releasedSeatMsg = "";
  if (heldSeat) {
    heldSeat.isReserved = false;
    heldSeat.reservedBy = null;
    heldSeat.phone = null;
    heldSeat.researchGroup = null;
    heldSeat.reservedAt = null;
    heldSeat.ip = undefined;
    releasedSeatMsg = `，同时已自动撤销其占用的 ${heldSeat.id} 号座位`;
  }

  saveState();
  broadcastStateUpdate();

  res.json({
    success: true,
    message: `已成功将【${cleanName}】加入黑名单${releasedSeatMsg}！`,
    blacklist: state.blacklist,
  });
});

// Admin Blacklist Remove
app.post("/api/admin/blacklist/remove", requireAdminAuth, (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    return res.json({ success: false, error: "请指定要移除的姓名" });
  }

  const targetName = String(name).trim().toLowerCase();
  const initialLen = state.blacklist.length;
  state.blacklist = state.blacklist.filter((item) => item.name.toLowerCase() !== targetName);

  if (state.blacklist.length === initialLen) {
    return res.json({ success: false, error: "未在黑名单中找到该姓名" });
  }

  saveState();
  res.json({
    success: true,
    message: `已将【${name}】从黑名单中移除！`,
    blacklist: state.blacklist,
  });
});

// Vite middleware in dev or static serving in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Study Room Reservation Server running on http://localhost:${PORT}`);
  });
}

startServer();
