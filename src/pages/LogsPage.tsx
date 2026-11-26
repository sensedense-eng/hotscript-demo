import { useMemo, useState } from "react";
import { Bot, Cpu, User } from "lucide-react";
import metaData from "@data/meta.json";
import { formatRelativeTime, formatShortDateTime } from "@/core/time";
import { useHotscriptStore } from "@/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LogActor, MetaConfig } from "@/types";

const meta = metaData as MetaConfig;

type ActorFilter = "all" | LogActor;

const ACTOR_STYLE: Record<
  LogActor,
  { className: string; dotClass: string; Icon: typeof User }
> = {
  "运营·演示用户": {
    className: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]/80",
    dotClass: "bg-[#0F766E]",
    Icon: User,
  },
  系统: {
    className: "bg-slate-100 text-slate-700 border-slate-200",
    dotClass: "bg-slate-400",
    Icon: Cpu,
  },
  模型: {
    className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/80",
    dotClass: "bg-[#059669]",
    Icon: Bot,
  },
};

export function LogsPage() {
  const logs = useHotscriptStore((s) => s.logs);
  const [filter, setFilter] = useState<ActorFilter>("all");

  const counts = useMemo(() => {
    return {
      all: logs.length,
      "运营·演示用户": logs.filter((l) => l.actor === "运营·演示用户").length,
      系统: logs.filter((l) => l.actor === "系统").length,
      模型: logs.filter((l) => l.actor === "模型").length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((l) => l.actor === filter);
  }, [logs, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 leading-tight">
            操作日志
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            完整记录热点采集核验、程序规则检查、模型创作评审与人工确认轨迹
          </p>
        </div>

        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as ActorFilter)}
        >
          <TabsList className="bg-white border border-[#E2E8F0] p-1 h-10 rounded-[10px]">
            <TabsTrigger
              value="all"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              全部
              <span className="ml-1.5 tabular-nums text-slate-400">
                {counts.all}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="运营·演示用户"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              运营
              <span className="ml-1.5 tabular-nums text-slate-400">
                {counts["运营·演示用户"]}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="系统"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              系统
              <span className="ml-1.5 tabular-nums text-slate-400">
                {counts["系统"]}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="模型"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              模型
              <span className="ml-1.5 tabular-nums text-slate-400">
                {counts["模型"]}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-slate-500">
            当前筛选条件下暂无操作日志
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
            {filteredLogs.map((entry) => {
              const actorMeta = ACTOR_STYLE[entry.actor];
              const ActorIcon = actorMeta.Icon;

              return (
                <div key={entry.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-white",
                      actorMeta.dotClass
                    )}
                  />
                  <div className="rounded-[10px] border border-slate-200/80 bg-[#F8FAFC]/60 px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[12px] font-medium px-2 py-0 h-5 rounded-md border gap-1",
                            actorMeta.className
                          )}
                        >
                          <ActorIcon className="h-3 w-3" />
                          <span>{entry.actor}</span>
                        </Badge>
                        <span className="text-[14px] font-semibold text-slate-900">
                          {entry.action}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[14px] text-slate-700">
                          {entry.target}
                        </span>
                      </div>
                      <span className="text-[13px] text-slate-400 tabular-nums">
                        {formatShortDateTime(entry.timestamp)}（
                        {formatRelativeTime(entry.timestamp, meta.demoNow)}）
                      </span>
                    </div>
                    <p className="text-[14px] text-slate-600 leading-relaxed">
                      {entry.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
