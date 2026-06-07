import { useMemo, useState } from "react";
import { ArrowRight, Server, Zap, Wrench, Database, AlertTriangle } from "lucide-react";
import type { Service } from "../types";

interface ServiceDependencyGraphProps {
  services: Service[];
  runningServices: string[];
}

export function ServiceDependencyGraph({ services, runningServices }: ServiceDependencyGraphProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // 构建依赖图
  const graph = useMemo(() => {
    const nodes = services.map(s => ({
      id: s.id,
      name: s.name,
      running: runningServices.includes(s.name),
      serviceType: s.service_type,
      dependencies: s.depends_on || [],
    }));

    const edges: Array<{ from: string; to: string }> = [];
    nodes.forEach(node => {
      node.dependencies.forEach(depId => {
        edges.push({ from: node.id, to: depId });
      });
    });

    // 构建反向依赖映射（被谁依赖）
    const dependedBy = new Map<string, string[]>();
    nodes.forEach(node => {
      node.dependencies.forEach(depId => {
        if (!dependedBy.has(depId)) dependedBy.set(depId, []);
        dependedBy.get(depId)!.push(node.id);
      });
    });

    // 检测循环依赖
    const hasCycle = (() => {
      const visited = new Set<string>();
      const visiting = new Set<string>();

      const dfs = (nodeId: string): boolean => {
        if (visiting.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;
        visiting.add(nodeId);
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          for (const depId of node.dependencies) {
            if (dfs(depId)) return true;
          }
        }
        visiting.delete(nodeId);
        visited.add(nodeId);
        return false;
      };

      return nodes.some(node => dfs(node.id));
    })();

    return { nodes, edges, dependedBy, hasCycle };
  }, [services, runningServices]);

  // 获取高亮相关的服务 ID
  const highlightedIds = useMemo(() => {
    if (!highlightedId) return new Set<string>();
    const ids = new Set<string>();
    ids.add(highlightedId);

    // 高亮依赖的服务
    const node = graph.nodes.find(n => n.id === highlightedId);
    if (node) {
      node.dependencies.forEach(depId => ids.add(depId));
    }

    // 高亮依赖当前服务的服务
    const dependents = graph.dependedBy.get(highlightedId) || [];
    dependents.forEach(id => ids.add(id));

    return ids;
  }, [highlightedId, graph]);

  // 获取服务图标
  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case "npm":
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case "maven":
        return <Server className="w-4 h-4 text-green-500" />;
      case "database":
        return <Database className="w-4 h-4 text-blue-400" />;
      default:
        return <Wrench className="w-4 h-4 text-blue-400" />;
    }
  };

  // 如果没有依赖关系，显示简单列表
  if (graph.edges.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <h3 className="text-[13px] font-medium text-gray-400 mb-3">服务依赖关系</h3>
        <div className="text-[12px] text-gray-600 text-center py-4">
          暂无服务依赖关系
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <h3 className="text-[13px] font-medium text-gray-400 mb-3">服务依赖关系</h3>
      {graph.hasCycle && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>检测到循环依赖，请检查服务配置</span>
        </div>
      )}
      <p className="text-[11px] text-gray-600 mb-3">点击服务可高亮其依赖链</p>
      <div className="space-y-2">
        {graph.nodes.map(node => {
          const deps = node.dependencies
            .map(depId => graph.nodes.find(n => n.id === depId))
            .filter(Boolean);

          if (deps.length === 0) return null;

          const isHighlighted = highlightedId === node.id;
          const isInHighlightChain = highlightedIds.has(node.id);

          return (
            <div
              key={node.id}
              className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-200 cursor-pointer ${
                isHighlighted
                  ? "bg-blue-500/10 border border-blue-500/30"
                  : isInHighlightChain
                    ? "bg-white/[0.04] border border-white/[0.08]"
                    : "border border-transparent hover:bg-white/[0.02]"
              }`}
              onClick={() => setHighlightedId(isHighlighted ? null : node.id)}
            >
              {/* 依赖的服务 */}
              <div className="flex items-center gap-1.5">
                {deps.map(dep => dep && (
                  <div
                    key={dep.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] transition-all duration-200 ${
                      highlightedIds.has(dep.id)
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : dep.running
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-white/[0.06] text-gray-500"
                    }`}
                  >
                    {getServiceIcon(dep.serviceType)}
                    <span className="truncate max-w-[100px]">{dep.name}</span>
                  </div>
                ))}
              </div>

              {/* 箭头 */}
              <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-colors ${
                isInHighlightChain ? "text-blue-400" : "text-gray-600"
              }`} />

              {/* 当前服务 */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] transition-all duration-200 ${
                isHighlighted
                  ? "bg-blue-500/30 text-blue-300 border border-blue-500/40"
                  : isInHighlightChain
                    ? "bg-blue-500/15 text-blue-400"
                    : node.running
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.06] text-gray-500"
              }`}>
                {getServiceIcon(node.serviceType)}
                <span className="truncate max-w-[100px] font-medium">{node.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
