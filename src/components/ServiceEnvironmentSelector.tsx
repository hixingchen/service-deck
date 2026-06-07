import { useState } from "react";
import { X, Globe, Check } from "lucide-react";

interface Environment {
  id: string;
  name: string;
  description: string;
  variables: Record<string, string>;
}

const ENVIRONMENTS: Environment[] = [
  {
    id: "development",
    name: "开发环境",
    description: "本地开发环境",
    variables: {
      NODE_ENV: "development",
      DEBUG: "true",
    },
  },
  {
    id: "staging",
    name: "测试环境",
    description: "测试服务器环境",
    variables: {
      NODE_ENV: "staging",
      DEBUG: "false",
    },
  },
  {
    id: "production",
    name: "生产环境",
    description: "生产服务器环境",
    variables: {
      NODE_ENV: "production",
      DEBUG: "false",
    },
  },
];

interface ServiceEnvironmentSelectorProps {
  currentEnv: string;
  onClose: () => void;
  onSelect: (envId: string) => void;
}

export function ServiceEnvironmentSelector({ currentEnv, onClose, onSelect }: ServiceEnvironmentSelectorProps) {
  const [selectedId, setSelectedId] = useState(currentEnv);

  const handleSelect = () => {
    onSelect(selectedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-[#1a1a2e] border border-white/[0.1] shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            <h3 className="text-[15px] font-semibold text-white/90">选择环境</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-4">
          {/* 环境列表 */}
          <div className="space-y-2">
            {ENVIRONMENTS.map(env => (
              <button
                key={env.id}
                onClick={() => setSelectedId(env.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  selectedId === env.id
                    ? "bg-blue-500/20 border border-blue-500/30"
                    : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {/* 图标 */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/20">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>

                {/* 信息 */}
                <div className="flex-1 text-left">
                  <div className="text-[14px] font-medium text-white/90">{env.name}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">{env.description}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.entries(env.variables).map(([key, value]) => (
                      <span key={key} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-500">
                        {key}={value}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 选中指示 */}
                {selectedId === env.id && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* 应用按钮 */}
          <button
            onClick={handleSelect}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-[14px] font-medium hover:bg-blue-500 transition-colors"
          >
            应用环境
          </button>
        </div>
      </div>
    </div>
  );
}
