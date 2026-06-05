import { ArrowLeft } from "lucide-react";

export function GuidePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0f]" style={{ top: '2.75rem' }}>
      <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-white/[0.06]">
        <button onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <h2 className="ml-3 text-[15px] font-semibold text-white/90">服务列表操作指南</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-8 text-[13px] leading-relaxed text-gray-300">

          {/* 配置字段说明 */}
          <section>
            <h3 className="text-[14px] font-semibold text-white/90 mb-3">配置字段说明</h3>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="px-4 py-2.5 text-left font-medium text-gray-400">字段</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-400">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr><td className="px-4 py-2.5 text-gray-400">工作目录</td><td className="px-4 py-2.5">服务可执行文件所在目录的绝对路径</td></tr>
                  <tr><td className="px-4 py-2.5 text-gray-400">启动命令</td><td className="px-4 py-2.5">在工作目录下执行的命令</td></tr>
                  <tr><td className="px-4 py-2.5 text-gray-400">启动类型</td><td className="px-4 py-2.5">自动（项目启动时一起运行）/ 手动（需单独启动）</td></tr>
                  <tr><td className="px-4 py-2.5 text-gray-400">环境变量</td><td className="px-4 py-2.5">可选，格式 KEY=VALUE，注入到进程环境</td></tr>
                  <tr><td className="px-4 py-2.5 text-gray-400">日志路径</td><td className="px-4 py-2.5">可选，填文件路径读取指定日志，填目录路径自动找最新日志</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 常见服务配置 */}
          <section>
            <h3 className="text-[14px] font-semibold text-white/90 mb-3">常见服务配置</h3>
            <div className="space-y-3">

              <div className="rounded-xl border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  <span className="text-[13px] font-semibold text-white/80">Redis</span>
                </div>
                <div className="text-[12px] font-mono bg-white/[0.02] rounded-lg p-3 space-y-0.5">
                  <p><span className="text-gray-500">工作目录：</span>{"<Redis安装目录>"}</p>
                  <p><span className="text-gray-500">启动命令：</span>redis-server.exe</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="text-[13px] font-semibold text-white/80">MongoDB</span>
                </div>
                <div className="text-[12px] font-mono bg-white/[0.02] rounded-lg p-3 space-y-0.5">
                  <p><span className="text-gray-500">工作目录：</span>{"<MongoDB安装目录>"}/bin</p>
                  <p><span className="text-gray-500">启动命令：</span>mongod --dbpath {"<数据目录>"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                  <span className="text-[13px] font-semibold text-white/80">ActiveMQ</span>
                </div>
                <div className="text-[12px] font-mono bg-white/[0.02] rounded-lg p-3 space-y-0.5">
                  <p><span className="text-gray-500">工作目录：</span>{"<ActiveMQ安装目录>"}/bin/win64</p>
                  <p><span className="text-gray-500">启动命令：</span>activemq.bat</p>
                  <p><span className="text-gray-500">日志路径：</span>{"<ActiveMQ安装目录>"}/data</p>
                </div>
                <p className="text-[11px] text-yellow-400/80 mt-2">⚠ Java 程序控制台输出不完整，需填 data 目录读取完整日志</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <span className="text-[13px] font-semibold text-white/80">Tomcat</span>
                </div>
                <div className="text-[12px] font-mono bg-white/[0.02] rounded-lg p-3 space-y-0.5">
                  <p><span className="text-gray-500">工作目录：</span>{"<Tomcat安装目录>"}/bin</p>
                  <p><span className="text-gray-500">启动命令：</span>catalina.bat run</p>
                  <p><span className="text-gray-500">日志路径：</span>{"<Tomcat安装目录>"}/logs</p>
                </div>
                <p className="text-[11px] text-yellow-400/80 mt-2">⚠ 不要用 startup.bat（会弹窗），必须用 catalina.bat run，日志路径填 logs 目录</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  <span className="text-[13px] font-semibold text-white/80">Java JAR</span>
                </div>
                <div className="text-[12px] font-mono bg-white/[0.02] rounded-lg p-3 space-y-0.5">
                  <p><span className="text-gray-500">工作目录：</span>{"<JAR文件所在目录>"}</p>
                  <p><span className="text-gray-500">启动命令：</span>java -jar app.jar</p>
                </div>
              </div>

            </div>
          </section>

          {/* 日志说明 */}
          <section>
            <h3 className="text-[14px] font-semibold text-white/90 mb-3">日志路径说明</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>不填：自动捕获控制台输出（适合 Redis、Java JAR 等）</li>
              <li>填文件路径：直接读取指定日志文件</li>
              <li>填目录路径：自动查找目录下最新的 .out 或 .log 文件（适合 Tomcat、ActiveMQ）</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
