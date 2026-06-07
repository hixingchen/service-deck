import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

interface HealthCheckResult {
  service_name: string;
  is_healthy: boolean;
  message: string;
  response_time_ms: number;
}

interface ServiceHealthCheckProps {
  serviceName: string;
  healthCheckUrl: string;
  onClose: () => void;
}

export function ServiceHealthCheck({ serviceName, healthCheckUrl, onClose }: ServiceHealthCheckProps) {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
  }, [serviceName]);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<HealthCheckResult>("check_service_health", {
        serviceName,
        healthCheckUrl: healthCheckUrl || null,
      });
      setResult(res);
    } catch (e) {
      console.error("健康检查失败:", e);
      setError("健康检查失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-[#1a1a2e] border border-white/[0.1] shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-white/90">健康检查</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <XCircle className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 服务信息 */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="text-[13px] text-gray-400 mb-1">服务</div>
            <div className="text-[14px] font-medium text-white/90">{serviceName}</div>
            {healthCheckUrl && (
              <div className="text-[12px] text-gray-500 mt-1 font-mono">{healthCheckUrl}</div>
            )}
          </div>

          {/* 检查结果 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="text-[13px] text-red-400">{error}</div>
            </div>
          ) : result ? (
            <div className={`p-3 rounded-xl ${
              result.is_healthy
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {result.is_healthy ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`text-[14px] font-medium ${
                  result.is_healthy ? "text-emerald-400" : "text-red-400"
                }`}>
                  {result.is_healthy ? "健康" : "不健康"}
                </span>
              </div>
              <div className="text-[13px] text-gray-400">{result.message}</div>
              {result.response_time_ms > 0 && (
                <div className="text-[12px] text-gray-500 mt-1">
                  响应时间: {result.response_time_ms}ms
                </div>
              )}
            </div>
          ) : null}

          {/* 刷新按钮 */}
          <button
            onClick={checkHealth}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            重新检查
          </button>
        </div>
      </div>
    </div>
  );
}
