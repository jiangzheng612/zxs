import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, ShieldAlert, User, Phone, Building2, Armchair } from "lucide-react";
import { Seat } from "../types";

interface ReservationModalProps {
  seat: Seat | null;
  onClose: () => void;
  onReserve: (
    seatId: number,
    name: string,
    phone: string,
    researchGroup: string
  ) => Promise<{ success: boolean; error?: string; isBlacklisted?: boolean }>;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  seat,
  onClose,
  onReserve,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [researchGroup, setResearchGroup] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName("");
    setPhone("");
    setResearchGroup("");
    setErrorMessage(null);
    setIsBlacklisted(false);
    setIsSubmitting(false);
  }, [seat]);

  // Real-time name checking for blacklist or prior reservation as user inputs
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      if (isBlacklisted) {
        setIsBlacklisted(false);
        setErrorMessage(null);
      }
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-name?name=${encodeURIComponent(trimmed)}`);
        const text = await res.text();
        const data = JSON.parse(text);
        if (data.isBlacklisted) {
          setIsBlacklisted(true);
          setErrorMessage(data.error || "该同学已加入黑名单，如有疑问请联系管理员。");
        } else if (data.alreadyReserved) {
          setIsBlacklisted(false);
          setErrorMessage(data.error);
        } else {
          if (isBlacklisted) {
            setIsBlacklisted(false);
            setErrorMessage(null);
          }
        }
      } catch {
        // Silent catch for pre-validation fetch
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [name, isBlacklisted]);

  if (!seat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsBlacklisted(false);

    // 1. Validate Name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("请输入预约人真实姓名");
      return;
    }
    const isAllChinese = /^[\u4e00-\u9fa5]{2,10}$/.test(trimmedName);
    const isAllEnglish = /^[a-zA-Z\s]{2,20}$/.test(trimmedName);
    if (!isAllChinese && !isAllEnglish) {
      setErrorMessage("姓名格式不正确：只能是全中文（2-10字）或全英文（2-20字母，不区分大小写），不能夹杂数字或符号！");
      return;
    }

    // 2. Validate Phone (必须为11位数字)
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setErrorMessage("请输入预约人电话");
      return;
    }
    if (!/^\d{11}$/.test(trimmedPhone)) {
      setErrorMessage("预约人电话格式不正确：必须填写11位数字（例如 13800138000）");
      return;
    }

    // 3. Validate Research Group (最多填写7个汉字)
    const trimmedGroup = researchGroup.trim();
    if (!trimmedGroup) {
      setErrorMessage("请输入来自的课题组名称");
      return;
    }
    if (!/^[\u4e00-\u9fa5]{1,7}$/.test(trimmedGroup)) {
      setErrorMessage("课题组格式不正确：最多填写7个汉字，且不能包含数字、英文或符号");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onReserve(seat.id, trimmedName, trimmedPhone, trimmedGroup);
      if (!result.success) {
        if (result.isBlacklisted) {
          setIsBlacklisted(true);
          setErrorMessage(result.error || "该同学已加入黑名单，如有疑问请联系管理员。");
        } else {
          setErrorMessage(result.error || "预约失败，请重试");
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("<") || msg.includes("JSON") || msg.includes("token")) {
        setErrorMessage("服务器网络繁忙，请稍后刷新重试");
      } else {
        setErrorMessage(msg || "网络请求异常，请重试");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="reservation-modal"
        className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-stone-200 relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                预约 {String(seat.id).padStart(2, "0")} 号自习座位
              </h3>
              <p className="text-xs text-stone-700">请如实填写以下3项信息完成锁定</p>
            </div>
          </div>
          <button
            id="close-reservation-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* 1. 真实姓名 */}
          <div>
            <label htmlFor="student-name-input" className="block text-xs font-semibold text-stone-700 mb-1.5">
              1. 预约人真实姓名 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="student-name-input"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMessage(null);
                  setIsBlacklisted(false);
                }}
                placeholder="全中文(2-10字) 或 全英文(2-20字母)"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* 2. 预约人电话 (11位数字) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="student-phone-input" className="block text-xs font-semibold text-stone-700">
                2. 预约人电话 <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-stone-700 font-mono">
                {phone.replace(/\D/g, "").length}/11 位
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="student-phone-input"
                type="tel"
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  // Keep only digits
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setPhone(digits);
                  setErrorMessage(null);
                }}
                placeholder="请输入11位手机号码（如 13800138000）"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* 3. 来自某个课题组 (最多7个汉字) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="student-group-input" className="block text-xs font-semibold text-stone-700">
                3. 来自某个课题组 <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-stone-700 font-mono">
                {researchGroup.trim().length}/7 汉字
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                id="student-group-input"
                type="text"
                maxLength={7}
                value={researchGroup}
                onChange={(e) => {
                  setResearchGroup(e.target.value.slice(0, 7));
                  setErrorMessage(null);
                }}
                placeholder="最多填写7个汉字（如：智能算法组）"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* Rules Summary */}
          <div className="text-[11px] text-stone-700 bg-stone-50 p-2.5 rounded-lg border border-stone-100 space-y-0.5">
            <p>• 同一姓名全周仅限预约一个座位，不可重复选座</p>
            <p>• 预约信息将同步至管理员监控，便于自习室秩序管理</p>
          </div>

          {/* Error Message display */}
          {errorMessage && (
            <div
              id="reservation-error-box"
              className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
                isBlacklisted
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              {isBlacklisted ? (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              id="cancel-reservation-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              id="confirm-reservation-submit-btn"
              disabled={
                isSubmitting ||
                !name.trim() ||
                !phone.trim() ||
                !researchGroup.trim() ||
                isBlacklisted
              }
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>正在抢座锁定...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>立即确认预约</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
