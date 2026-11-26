import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  Maximize2,
  UserCheck,
} from "lucide-react";
import aboutMd from "@data/about.md?raw";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const ROLES = [
  {
    title: "程序 · 事实与硬约束",
    icon: Cpu,
    items: [
      "热点多源交叉核验与证据快照哈希留存",
      "热点与脚本双状态机，非法流转直接阻断",
      "R1–R7 规则引擎（时长、字数、极限词、必带提示、未公开剧透拦截、证据引用、设定硬事实正则）",
      "加权适配评分与全链路操作日志",
    ],
  },
  {
    title: "大模型 · 理解与创作",
    icon: Bot,
    items: [
      "基于公开/内部设定卡与平台规范生成分镜脚本",
      "独立评审角色对设定一致性、人设、钩子、平台适配打分挑刺",
      "结合程序规则失败项与人工意见自动修订",
      "异常或离线时自动回退预置结果，保证演示不中断",
    ],
  },
  {
    title: "人工 · 关键决策节点",
    icon: UserCheck,
    items: [
      "节点 ① 选题确认：审阅证据与风险后决定跟进平台与创作方向",
      "节点 ② 终稿确认：审阅规则检查与模型评审结果后决定定稿或退回修改",
      "未达核验门槛、已拦截或已过期热点自动禁用确认，避免误发",
    ],
  },
];

export function AboutPage() {
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <div className="max-w-[760px] space-y-8 pb-8">
      {/* 1. 一段话介绍 */}
      <section className="space-y-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 leading-tight">
          方案说明
        </h1>
        <p className="text-[14px] text-slate-700 leading-relaxed">
          本系统为手游《云屿食堂》营销团队演示热点营销脚本工作流：以多源证据快照确保热点真实可溯源，用程序规则引擎与状态机把关大模型输出，仅在选题与终稿两个节点交由运营确认。
        </p>
      </section>

      <Separator />

      {/* 2. 架构图 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-semibold text-slate-900">
            系统架构图
          </h2>
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0F766E] hover:text-[#115E59] transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>点击放大</span>
          </button>
        </div>
        <Card
          onClick={() => setZoomOpen(true)}
          className="rounded-[12px] border border-[#E2E8F0] bg-white p-3 shadow-sm cursor-zoom-in overflow-hidden hover:border-slate-300 transition-colors"
        >
          <img
            src="/architecture.png"
            alt="热点营销脚本系统架构图"
            className="w-full h-auto rounded-lg"
          />
        </Card>
      </section>

      {/* 3. 程序 / 大模型 / 人工 分工三列卡片 */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold text-slate-900">
          人机职责分工
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <Card
                key={role.title}
                className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
                  <Icon className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <span>{role.title}</span>
                </div>
                <ul className="space-y-2 text-[13px] text-slate-600 leading-relaxed list-disc pl-4">
                  {role.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4. 本作品实现范围 */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold text-slate-900">
          本作品实现范围
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#059669]" />
              <span className="text-[14px] font-semibold text-slate-900">
                真实运行模块
              </span>
              <Badge
                variant="outline"
                className="text-[12px] font-medium bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
              >
                实时执行
              </Badge>
            </div>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              R1–R7 规则检查引擎、热点与脚本双状态机、加权适配评分、未公开设定卡隔离、操作日志持久化，以及通过 Vercel Serverless Functions 真实调用大模型完成脚本生成、独立评审与自动修订。
            </p>
          </Card>

          <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-2.5">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-500" />
              <span className="text-[14px] font-semibold text-slate-900">
                模拟数据模块
              </span>
              <Badge
                variant="outline"
                className="text-[12px] font-normal bg-slate-100 text-slate-600 border-slate-200"
              >
                预置数据
              </Badge>
            </div>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              外部平台热点采集、热度曲线与证据快照采用固定批次的模拟数据（基准时钟固定为 11 月 25 日 20:00），确保评阅人任意时间打开都能复现一致的核验与拦截场景。
            </p>
          </Card>
        </div>
      </section>

      <Separator />

      {/* 5. 实现路线与验收标准（Markdown 渲染） */}
      <section className="space-y-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <h2 className="text-[16px] font-semibold text-slate-900 pt-2 pb-1">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-[15px] font-semibold text-slate-900 pt-1">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-[14px] text-slate-700 leading-relaxed">
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900">
                {children}
              </strong>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-slate-700 leading-relaxed">
                {children}
              </ul>
            ),
            table: ({ children }) => (
              <div className="rounded-[12px] border border-[#E2E8F0] bg-white overflow-hidden shadow-sm my-3">
                <table className="w-full border-collapse text-left">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-slate-50/90 border-b border-[#E2E8F0]">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-4 py-2.5 text-[13px] font-medium text-slate-600">
                {children}
              </th>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-slate-100">{children}</tbody>
            ),
            td: ({ children }) => (
              <td className="px-4 py-3 text-[14px] text-slate-700 align-top leading-relaxed">
                {children}
              </td>
            ),
          }}
        >
          {aboutMd}
        </ReactMarkdown>
      </section>

      {/* 架构图放大 Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[92vw] w-[1120px] p-4 bg-white">
          <DialogHeader className="px-2">
            <DialogTitle className="text-[16px] font-semibold text-slate-900">
              热点营销脚本系统架构图
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-auto rounded-lg border border-slate-200 bg-[#F8FAFC] p-2">
            <img
              src="/architecture.png"
              alt="热点营销脚本系统架构图（放大视图）"
              className="w-full h-auto"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
