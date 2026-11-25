# 使用方法（给你看的）

1. 在电脑上新建一个空文件夹，例如 `hotscript-demo`，把本压缩包里的全部内容解压进去（`SPEC.md`、`TASKS.md`、`data/`、`public/`）。
2. 用 Antigravity 打开这个文件夹。
3. 第一条消息原样发送下面「首条指令」。之后每次只发「请执行 T1」「请执行 T2」……
4. 每张卡做完后，把它的汇报和截图贴给 Claude，由 Claude 判断是否通过、需要改什么，再进入下一张。
5. T4 之前到 Google AI Studio / 学校平台准备好 API Key；**Key 只填到 Vercel 的 Environment Variables 和本地 `.env.local`，不要发给任何 AI，也不要提交到 GitHub**（确认 `.gitignore` 包含 `.env*`）。

建议时间：今晚 T0–T3，明早 T4–T5，明天下午 T6–T7，21:00 前提交链接。

---

## 首条指令（复制发送给 Antigravity）

你好。我们要在这个文件夹里做一个可部署到 Vercel 的演示网站。请先完整阅读 `SPEC.md` 和 `TASKS.md`，然后：

1. 用 5 句话以内复述你对项目的理解；
2. 列出你认为 SPEC 中不清楚或有冲突的地方（没有就说没有）；
3. 然后只执行 TASKS.md 中的 T0，完成后按「通用要求」汇报并停下，等我确认再继续。

严格遵守 SPEC 的技术栈和设计规范，不要自行增加功能。
