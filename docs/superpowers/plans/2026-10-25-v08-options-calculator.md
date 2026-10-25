# V0.8 期权计算 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 上线十二种常见期权策略的介绍、固定示意图与手动输入的到期盈亏计算器。

**Architecture:** `src/lib/options-strategies.ts` 保存策略定义、默认案例及输入字段，`src/lib/options-payoff.ts` 以期权腿和股票腿组合计算分段线性盈亏、最大值与零点。客户端页面用纯 SVG 渲染示意图和动态曲线，所有导航加入 `/options`。不调用行情 API 或交易服务。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、SVG、Vitest、Testing Library、CSS；不新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-10-25-v08-options-calculator-design.md`

## Global Constraints

- 十二种策略与组成腿、同一到期日、手填股价/执行价/每股权利金/张数、默认乘数 100 按设计文档执行。
- 备兑看涨与衣领式的股票成本价独立于当前股价；铁鹰式四执行价有序，允许不等宽两翼并显示风险不对称。
- 图与结果共享计算函数；固定示意图明确为示例，动态结果明确为到期情景，不声称实时行情或到期前估值。
- 不复制外站图片；策略教育来源链接至期权行业委员会。
- 继续在 `codex/v0.8-options-calculator` 分支；本地预览使用当前项目目录。

## Review Focus

- 到期股价为零或恰好等于执行价时，盈亏/零点正确且无重复标记。
- 股价、成本价、执行价、权利金、张数、乘数的无效输入应阻止计算，不出现 NaN 或误导数值。
- 衣领式成本价与当前股价不同、铁鹰式两翼不等宽时，极值与平衡点仍正确。
- 输入的净权利金与通常信用/借记方向相反时只警告，并照实际数值计算。
- 盈亏平衡点落在通常图域外、没有零点或出现零盈亏区间时，图与文字如实呈现。

---

### Task 1: 策略定义与到期盈亏引擎

**Files:** Create `src/lib/options-strategies.ts`, `src/lib/options-payoff.ts`, `src/lib/options-payoff.test.ts`.

**Interfaces:** Export `STRATEGIES`, `getStrategy(id)`, `validateScenario(strategy, input)`, `calculatePayoff(strategy, input, expiryPrice)`, `analyzeScenario(strategy, input)`; `ScenarioInput` holds `spot`, `stockCost?`, `contracts`, `multiplier`, and keyed strike/premium values.

- [x] Write failing literal-value tests for all twelve presets; include long call, collar with stock cost, asymmetric iron condor, two break-even strangle, invalid strike order, and unusual net premium warning.
- [x] Run targeted Vitest; verify failures are due to the missing engine.
- [x] Implement the minimal definitions and piecewise payoff/zero-crossing/extrema logic.
- [x] Run targeted tests until green; run full suite with bounded workers to check regressions.
- [x] Commit the engine and tests.

### Task 2: 页面、示意图与全站入口

**Files:** Create `src/app/options/page.tsx`, `src/components/options-calculator.tsx`, `src/components/options-payoff-chart.tsx`, `src/components/options-calculator.test.tsx`, `src/app/options-calculator.css`; modify `src/app/layout.tsx` and six existing navigation components.

**Interfaces:** `/options` renders twelve strategy cards. Selected strategy shows per-leg inputs, stock cost where needed, dynamic payoff SVG, break-even points, best/worst outcomes and warnings. Card mini SVG uses fixed preset through the same analyzer.

- [ ] Write failing UI tests for twelve cards, navigation entry, strategy switching, live recalculation, invalid input state and editable collar/iron-condor cases.
- [ ] Run targeted tests; verify expected failure.
- [ ] Implement responsive light UI, original SVG chart, strategy source links and navigation.
- [ ] Run targeted tests until green, then full suite with bounded workers.
- [ ] Commit page, styling, navigation and tests.

### Task 3: 浏览器验收与版本归档

**Files:** Update `docs/v0.8-status.md`, `docs/README.md`, design if implementation decisions change, and PR #11 body/title.

- [ ] In the local browser test twelve cards, collar stock-cost changes, asymmetric iron condor, invalid input and small viewport; inspect screenshot and console.
- [ ] Run fresh full tests, ESLint and production build sequentially; confirm exact outputs.
- [ ] Record delivery, limits and verification in version docs; commit, push and sync draft PR #11.
- [ ] Perform whole-branch review and fix important findings before final delivery.
