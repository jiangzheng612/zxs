import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, ShieldAlert, Sparkles, User, Armchair } from "lucide-react";
import { Seat } from "../types";

interface ReservationModalProps {
  seat: Seat | null;
  onClose: () => void;
  onReserve: (seatId: number, name: string) => Promise<{ success: boolean; error?: string; isBlacklisted?: boolean }>;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  seat,
  onClose,
  onReserve,
}) => {
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName("");
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

  // Local client validator
  const validateInput = (input: string): { valid: boolean; message?: string } => {
    const trimmed = input.trim();
    if (!trimmed) {
      return { valid: false, message: "请输入您的姓名" };
    }
    const isAllChinese = /^[\u4e00-\u9fa5]{2,10}$/.test(trimmed);
    const isAllEnglish = /^[a-zA-Z\s]{2,20}$/.test(trimmed);

    if (!isAllChinese && !isAllEnglish) {
      return {
        valid: false,
        message: "姓名只能是全中文（2-10字）或全英文（2-20字母，不区分大小写），不能夹杂数字、中英混杂或符号！",
      };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsBlacklisted(false);

    const validation = validateInput(name);
    if (!validation.valid) {
      setErrorMessage(validation.message || "姓名格式不正确");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onReserve(seat.id, name.trim());
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
              <p className="text-xs text-stone-700">本周座位 · 确认输入姓名即可锁定</p>
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
          <div>
            <label htmlFor="student-name-input" className="block text-xs font-semibold text-stone-700 mb-1.5">
              预约人真实姓名 <span className="text-rose-500">*</span>
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
                placeholder="例如：李华 或 Alice"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            {/* Strict rules explanation */}
            <div className="mt-2 text-xs text-stone-700 space-y-0.5">
              <p className="flex items-center gap-1 text-stone-700">
                <span>• 姓名只能是全中文（2-10字）或全英文（不区分大小写）</span>
              </p>
              <p className="flex items-center gap-1 text-stone-700">
                <span>• 同一姓名全周仅可锁定一个座位</span>
              </p>
              <p className="flex items-center gap-1 text-stone-700">
                <span>• 提交成功后若想预约其他座位需重新刷新页面</span>
              </p>
            </div>
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
              disabled={isSubmitting || !name.trim() || isBlacklisted}
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
