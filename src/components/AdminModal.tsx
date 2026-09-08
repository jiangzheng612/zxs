import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Settings,
  UserX,
  Calendar,
  Trash2,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  LogOut,
  Armchair,
  Sparkles,
  Clock,
} from "lucide-react";
import { AppConfig, BlacklistItem, Seat, TimeConstraintConfig } from "../types";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  seats: Seat[];
  currentTimeFormatted?: string;
  onConfigUpdated: (newConfig: AppConfig) => void;
  onSeatsUpdated: (seats: Seat[]) => void;
}

const dayOptions = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  config,
  seats,
  currentTimeFormatted,
  onConfigUpdated,
  onSeatsUpdated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem("admin_session_token"));
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("admin_session_token");
    } catch {
      return null;
    }
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "blacklist" | "seats" | "password">("settings");

  // Editable config state
  const [systemTitle, setSystemTitle] = useState(config.systemTitle);
  const [timeConfig, setTimeConfig] = useState<TimeConstraintConfig>(config.timeConfig);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Blacklist state
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [newBlacklistName, setNewBlacklistName] = useState("");
  const [newBlacklistReason, setNewBlacklistReason] = useState("");
  const [blacklistMsg, setBlacklistMsg] = useState<string | null>(null);

  // Password modification state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Manual clear confirmation state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Only initialize form values from server when modal is opened, avoiding background polling overwriting edits!
  useEffect(() => {
    if (isOpen) {
      setSystemTitle(config.systemTitle);
      setTimeConfig(config.timeConfig);
      setSaveSuccessMsg(null);
      setSaveErrorMsg(null);
    }
  }, [isOpen]);

  // Load blacklist if already authenticated on mount
  useEffect(() => {
    if (isOpen && adminToken && isAuthenticated) {
      loadBlacklist(adminToken);
    }
  }, [isOpen, adminToken, isAuthenticated]);

  // Load blacklist when authenticated
  const loadBlacklist = async (token: string) => {
    try {
      const res = await fetch("/api/admin/blacklist", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBlacklist(data.blacklist || []);
      }
    } catch (err) {
      console.error("Failed to fetch blacklist:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "密码错误");
        return;
      }

      setIsAuthenticated(true);
      setAdminToken(data.token);
      try {
        sessionStorage.setItem("admin_session_token", data.token);
      } catch {
        // ignore
      }
      setPasswordInput("");
      setBlacklist(data.blacklist || []);
      if (data.config) {
        setSystemTitle(data.config.systemTitle);
        setTimeConfig(data.config.timeConfig);
      }
    } catch (err: any) {
      setLoginError(err.message || "登录请求失败");
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;

    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          systemTitle: systemTitle.trim(),
          timeConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveErrorMsg(data.error || "保存失败");
        return;
      }

      setSaveSuccessMsg(data.message || "配置已保存，系统标题与时间约束已立即在前台生效！");
      if (data.config) {
        setSystemTitle(data.config.systemTitle);
        setTimeConfig(data.config.timeConfig);
        onConfigUpdated(data.config);
      }
      setTimeout(() => setSaveSuccessMsg(null), 6000);
    } catch (err: any) {
      setSaveErrorMsg(err.message || "网络请求异常");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newBlacklistName.trim()) return;

    setBlacklistMsg(null);
    try {
      const res = await fetch("/api/admin/blacklist/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: newBlacklistName.trim(),
          reason: newBlacklistReason.trim() || "违规爽约/占用",
        }),
      });

      let data: any = null;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        setBlacklistMsg("网络通讯异常，请稍后刷新重试");
        return;
      }

      if (!res.ok || !data.success) {
        setBlacklistMsg(data.error || "添加失败");
        return;
      }

      setBlacklist(data.blacklist);
      setNewBlacklistName("");
      setNewBlacklistReason("");
      setBlacklistMsg(data.message || "已成功添加至黑名单！该同学在系统中选座将无法提交。");
      setTimeout(() => setBlacklistMsg(null), 3500);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("<") || msg.includes("JSON") || msg.includes("token")) {
        setBlacklistMsg("网络通讯异常，请稍后刷新重试");
      } else {
        setBlacklistMsg(msg || "操作异常");
      }
    }
  };

  const handleRemoveBlacklist = async (name: string) => {
    if (!adminToken) return;
    try {
      const res = await fetch("/api/admin/blacklist/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name }),
      });

      let data: any = null;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        setBlacklistMsg("网络通讯异常，请稍后刷新重试");
        return;
      }

      if (res.ok && data.success) {
        setBlacklist(data.blacklist);
        setBlacklistMsg(data.message || `已从黑名单中移除【${name}】`);
        setTimeout(() => setBlacklistMsg(null), 3000);
      } else {
        setBlacklistMsg(data.error || "移除失败");
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("<") || msg.includes("JSON") || msg.includes("token")) {
        setBlacklistMsg("网络通讯异常，请稍后刷新重试");
      } else {
        setBlacklistMsg(msg || "操作异常");
      }
    }
  };

  const handleClearAllReservations = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch("/api/admin/clear-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const data = await res.json();
      if (res.ok) {
        onSeatsUpdated(data.seats);
        setShowClearConfirm(false);
        setSaveSuccessMsg("所有 15 个座位的预约记录已手动重置清空！");
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSeat = async (seatId: number) => {
    if (!adminToken) return;
    try {
      const res = await fetch("/api/admin/cancel-seat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ seatId }),
      });

      const data = await res.json();
      if (res.ok) {
        onSeatsUpdated(data.seats);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "两次输入的新密码不一致", isError: true });
      return;
    }

    if (newPassword.length < 4) {
      setPasswordMsg({ text: "新密码长度至少需要4位", isError: true });
      return;
    }

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          oldPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ text: data.error || "修改密码失败", isError: true });
        return;
      }

      setAdminToken(data.token);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ text: "管理员密码已修改成功！请牢记新密码。", isError: false });
    } catch (err: any) {
      setPasswordMsg({ text: err.message || "操作异常", isError: true });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="admin-modal"
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-stone-900">管理员配置控制台</h3>
              <p className="text-xs text-stone-700">系统时间约束 · 黑名单名单 · 一键清空预约</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <button
                onClick={() => {
                  setIsAuthenticated(false);
                  setAdminToken(null);
                }}
                className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-stone-200/60 transition-colors"
                title="退出登录"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>退出</span>
              </button>
            )}
            <button
              id="close-admin-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unauthenticated Login Screen */}
        {!isAuthenticated ? (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center max-w-sm mx-auto my-auto w-full">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-stone-900 mb-1">请输入管理员密码</h4>
            <p className="text-xs text-stone-700 text-center mb-6">
              预设密码已隐藏加密。初次使用请输入预设密码解锁系统配置。
            </p>

            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div>
                <label htmlFor="admin-password-input" className="block text-xs font-semibold text-stone-700 mb-1">
                  密码 (Password)
                </label>
                <input
                  id="admin-password-input"
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setLoginError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                id="admin-login-submit-btn"
                disabled={!passwordInput}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
              >
                验证密码并进入后台
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Dashboard Tabs & Body */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Nav Tabs */}
            <div className="px-5 border-b border-stone-200 bg-stone-50 flex items-center space-x-1 overflow-x-auto text-xs font-medium">
              <button
                id="admin-tab-settings"
                onClick={() => setActiveTab("settings")}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeTab === "settings"
                    ? "border-amber-600 text-amber-700 font-semibold"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>系统参数与开放时间</span>
              </button>

              <button
                id="admin-tab-blacklist"
                onClick={() => setActiveTab("blacklist")}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeTab === "blacklist"
                    ? "border-amber-600 text-amber-700 font-semibold"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <UserX className="w-3.5 h-3.5" />
                <span>黑名单管理 ({blacklist.length})</span>
              </button>

              <button
                id="admin-tab-seats"
                onClick={() => setActiveTab("seats")}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeTab === "seats"
                    ? "border-amber-600 text-amber-700 font-semibold"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <Armchair className="w-3.5 h-3.5" />
                <span>预约监控与清空</span>
              </button>

              <button
                id="admin-tab-password"
                onClick={() => setActiveTab("password")}
                className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeTab === "password"
                    ? "border-amber-600 text-amber-700 font-semibold"
                    : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>修改密码</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* TAB 1: System Title & Time Constraints */}
              {activeTab === "settings" && (
                <form onSubmit={handleSaveConfig} className="space-y-6">
                  {/* System Title */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
                    <label htmlFor="system-title-input" className="block text-xs font-bold text-stone-800">
                      系统主标题修改 (在前台全局实时展示)
                    </label>
                    <input
                      id="system-title-input"
                      type="text"
                      value={systemTitle}
                      onChange={(e) => setSystemTitle(e.target.value)}
                      placeholder="例如：自习室座位预约系统"
                      className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                    <p className="text-xs text-stone-700">
                      保存后，顶部导航、浏览器标题及预约页面将同步更新为该名称。
                    </p>
                  </div>

                  {/* Testing Mode Toggle */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>快速测试模式：全天候 24 小时开放预约</span>
                      </h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        开启后将无视周次和时段约束，便于老师或管理员立即测试并发选座与业务逻辑。
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timeConfig.alwaysOpenForTesting}
                        onChange={(e) =>
                          setTimeConfig({
                            ...timeConfig,
                            alwaysOpenForTesting: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
                    </label>
                  </div>

                  {/* Time Constraints Config: Mon-Sun, 0-24 hour */}
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-stone-600" />
                        <span>常规预约时段约束设定 (支持周一至周日，0-24点任意配置)</span>
                      </h4>
                      <p className="text-xs text-stone-700 mt-0.5">
                        按需自定义每周开放选座时刻与每周自动清空时刻。
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Open time */}
                      <div className="bg-white p-3.5 rounded-lg border border-stone-200 space-y-2">
                        <span className="text-xs font-semibold text-emerald-700 block">
                          每周开放预约时刻
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-stone-700 mb-1">星期</label>
                            <select
                              value={timeConfig.openDay}
                              onChange={(e) =>
                                setTimeConfig({
                                  ...timeConfig,
                                  openDay: Number(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:outline-none"
                            >
                              {dayOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-stone-700 mb-1">时间 (点:分)</label>
                            <div className="flex items-center gap-1">
                              <select
                                value={timeConfig.openHour}
                                onChange={(e) =>
                                  setTimeConfig({
                                    ...timeConfig,
                                    openHour: Number(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {String(i).padStart(2, "0")}时
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs text-stone-400">:</span>
                              <select
                                value={timeConfig.openMinute}
                                onChange={(e) =>
                                  setTimeConfig({
                                    ...timeConfig,
                                    openMinute: Number(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                                  <option key={m} value={m}>
                                    {String(m).padStart(2, "0")}分
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Close & Auto-Clear time */}
                      <div className="bg-white p-3.5 rounded-lg border border-stone-200 space-y-2">
                        <span className="text-xs font-semibold text-rose-700 block">
                          每周自动清空与截止时刻
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-stone-700 mb-1">星期</label>
                            <select
                              value={timeConfig.closeDay}
                              onChange={(e) =>
                                setTimeConfig({
                                  ...timeConfig,
                                  closeDay: Number(e.target.value),
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              {dayOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-stone-700 mb-1">时间 (点:分)</label>
                            <div className="flex items-center gap-1">
                              <select
                                value={timeConfig.closeHour}
                                onChange={(e) =>
                                  setTimeConfig({
                                    ...timeConfig,
                                    closeHour: Number(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                {Array.from({ length: 24 }, (_, i) => (
                                  <option key={i} value={i}>
                                    {String(i).padStart(2, "0")}时
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs text-stone-400">:</span>
                              <select
                                value={timeConfig.closeMinute}
                                onChange={(e) =>
                                  setTimeConfig({
                                    ...timeConfig,
                                    closeMinute: Number(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                                  <option key={m} value={m}>
                                    {String(m).padStart(2, "0")}分
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview summary & current system time */}
                    <div className="bg-white border border-stone-200 rounded-lg p-3 text-xs text-stone-700 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-stone-800">
                          设定生效预览：每周{dayOptions.find((d) => d.value === timeConfig.openDay)?.label}{" "}
                          {String(timeConfig.openHour).padStart(2, "0")}:{String(timeConfig.openMinute).padStart(2, "0")} 开放选座 · 每周
                          {dayOptions.find((d) => d.value === timeConfig.closeDay)?.label}{" "}
                          {String(timeConfig.closeHour).padStart(2, "0")}:{String(timeConfig.closeMinute).padStart(2, "0")} 自动清空
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTimeConfig(config.timeConfig);
                            setSystemTitle(config.systemTitle);
                          }}
                          className="text-[11px] text-amber-700 hover:text-amber-800 underline cursor-pointer"
                        >
                          还原为服务器当前配置
                        </button>
                      </div>
                      {currentTimeFormatted && (
                        <div className="text-[11px] text-stone-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>当前服务器北京时间：{currentTimeFormatted}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feedback alerts */}
                  {saveSuccessMsg && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  {saveErrorMsg && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{saveErrorMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTimeConfig(config.timeConfig);
                        setSystemTitle(config.systemTitle);
                        setSaveSuccessMsg(null);
                        setSaveErrorMsg(null);
                      }}
                      className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-xs hover:bg-stone-50 transition-all cursor-pointer"
                    >
                      放弃修改
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      id="save-admin-config-btn"
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSaving ? "正在保存生效..." : "保存并立即应用"}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: Blacklist Management */}
              {activeTab === "blacklist" && (
                <div className="space-y-5">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-stone-800 mb-1">
                      添加新黑名单名单
                    </h4>
                    <p className="text-xs text-stone-700 mb-3">
                      名单中的学生进入系统后无法预约，提交时系统会直接提示：
                      <span className="font-semibold text-rose-600 ml-1">
                        “该同学已加入黑名单，如有疑问请联系管理员。”
                      </span>
                    </p>

                    <form onSubmit={handleAddBlacklist} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={newBlacklistName}
                        onChange={(e) => setNewBlacklistName(e.target.value)}
                        placeholder="姓名 (如：张三 或 Bob)"
                        className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <input
                        type="text"
                        value={newBlacklistReason}
                        onChange={(e) => setNewBlacklistReason(e.target.value)}
                        placeholder="原因备注 (如：爽约三次)"
                        className="px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={!newBlacklistName.trim()}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>加入黑名单</span>
                      </button>
                    </form>
                  </div>

                  {blacklistMsg && (
                    <div className="p-3 rounded-lg bg-stone-100 border border-stone-200 text-stone-800 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{blacklistMsg}</span>
                    </div>
                  )}

                  {/* Blacklist Table */}
                  <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs font-semibold text-stone-700">
                      <span>黑名单列表 ({blacklist.length} 人)</span>
                    </div>

                    {blacklist.length === 0 ? (
                      <div className="p-8 text-center text-xs text-stone-400">
                        当前黑名单暂无记录
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-100">
                        {blacklist.map((item) => (
                          <div
                            key={item.name}
                            className="p-3.5 flex items-center justify-between hover:bg-stone-50/80 transition-colors"
                          >
                            <div>
                              <span className="text-xs font-bold text-stone-900 mr-2">
                                {item.name}
                              </span>
                              <span className="text-[11px] text-stone-700 bg-stone-100 px-2 py-0.5 rounded-sm">
                                {item.reason || "违规爽约"}
                              </span>
                              <span className="text-[11px] text-stone-700 ml-2">
                                添加时间：{new Date(item.addedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveBlacklist(item.name)}
                              className="text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-md transition-colors"
                            >
                              移出黑名单
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Seat Monitor & Manual Clear All */}
              {activeTab === "seats" && (
                <div className="space-y-5">
                  {/* Manual Clear All Area */}
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>手动清空所有预约信息</span>
                      </h4>
                      <p className="text-xs text-rose-700 mt-0.5">
                        按要求提供一键重置功能，可立即清空全部 15 个座位的占用数据并通知所有访客。
                      </p>
                    </div>

                    {!showClearConfirm ? (
                      <button
                        id="manual-clear-all-reservations-btn"
                        onClick={() => setShowClearConfirm(true)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all whitespace-nowrap"
                      >
                        手动清空所有座位
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-3 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs"
                        >
                          取消
                        </button>
                        <button
                          id="confirm-manual-clear-btn"
                          onClick={handleClearAllReservations}
                          className="px-3.5 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-bold hover:bg-rose-800 shadow-xs"
                        >
                          确认立即清空
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Seats Real-time Table */}
                  <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="p-3 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-700">
                      当前 15 个座位状态全览
                    </div>

                    <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
                      {seats.map((seat) => (
                        <div
                          key={seat.id}
                          className="p-3 flex items-center justify-between hover:bg-stone-50 transition-colors text-xs"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-bold text-stone-800 bg-stone-100 px-2 py-1 rounded">
                              {String(seat.id).padStart(2, "0")} 号座
                            </span>
                            {seat.isReserved ? (
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  <Lock className="w-3 h-3" />
                                  <span>已占用: {seat.reservedBy}</span>
                                </span>
                                {seat.reservedAt && (
                                  <span className="text-stone-700 text-[11px]">
                                    {new Date(seat.reservedAt).toLocaleTimeString("zh-CN", {
                                      hour12: false,
                                    })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                空闲
                              </span>
                            )}
                          </div>

                          {seat.isReserved && (
                            <button
                              onClick={() => handleCancelSeat(seat.id)}
                              className="text-stone-700 hover:text-rose-600 text-xs px-2 py-1 rounded hover:bg-stone-100"
                            >
                              撤销预约
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Modify Admin Password */}
              {activeTab === "password" && (
                <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-1">
                    <h4 className="text-xs font-bold text-stone-800">修改管理员登录密码</h4>
                    <p className="text-xs text-stone-700">
                      系统预设密码为 910802（已在界面隐藏掩码展示），您可在此将其修改为您自定义的密码。
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      当前原密码 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      设置新密码 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="至少 4 位字符"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      确认新密码 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="再次输入新密码"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>

                  {passwordMsg && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                        passwordMsg.isError
                          ? "bg-rose-50 border border-rose-200 text-rose-700"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      }`}
                    >
                      {passwordMsg.isError ? (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{passwordMsg.text}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!oldPassword || !newPassword || !confirmPassword}
                      className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                    >
                      确认更改密码
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
