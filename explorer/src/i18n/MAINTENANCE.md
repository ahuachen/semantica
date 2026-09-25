# i18n 维护手册

这是一个 fork。上游 `semantica-agi/semantica` 仍在高频开发，而本地的 i18n 改造触及 49 个前端文件，
所以**合并冲突不是意外，是常态**。这份文档说明怎么让它变成一件便宜的事。

## 冲突概率（实测）

| 指标 | 值 |
|---|---|
| 上游最近 300 个提交中触及 `explorer/src` 的 | 88 个（29%） |
| `GraphWorkspace.tsx` 在其中被改动 | 36 次 |
| `App.tsx` | 12 次 |
| `OntologyWorkspace/*` 合计 | 约 60 次 |

结论：平均每 3 个上游提交就有 1 个碰前端。按批次合并（攒一周再合）比每天合更省事。

## 关键前提：本地改动必须已提交

i18n 改造是 1800+ 行的跨 49 文件改动。只要它还躺在工作区里没提交，
任何 `git merge` / `git checkout` / 并发 agent 的 `git stash` 都可能一次抹掉。
本项目历史上已经发生过一次（见 git reflog）。

**合并前第一件事永远是确认工作区干净**：

```bash
git status --short     # 必须为空
```

## 为什么冲突面是这个形状

改动分两类，命运完全不同：

| 类型 | 文件 | 上游会碰吗 | 冲突风险 |
|---|---|---|---|
| 词条目录 | `src/i18n/locales/{en,zh}/*.json` | 不会（上游没有这些文件） | **零** |
| i18n 基建 | `src/i18n/*`、`src/ui/LanguageSwitcher.tsx`、`scripts/*` | 不会（新增文件） | **零** |
| 源码接线 | 49 个 `.tsx` / `.ts` | 会 | **全部风险在这里** |

所以优化方向很明确：**不要试图减少词条，要让源码接线的冲突容易解**。

## 合并流程

### 1. 一次性配置（每个 clone 做一次）

```bash
git config rerere.enabled true      # 记住冲突怎么解的，下次自动重放
git config rerere.autoupdate true
```

`rerere` 对本仓库价值很高：同一批 i18n 改动会在多次合并中反复和上游相撞，
记录一次解法后续自动套用。

### 2. 合并

```bash
git fetch upstream
git diff --stat HEAD upstream/main -- explorer/src    # 先看上游动了哪些前端文件
git merge upstream/main
```

用 `merge` 而不是 `rebase`。rebase 会把我们这 49 个文件的改动在每个上游提交上重放一遍，
同一个冲突要解 N 次；merge 每批只解一次。

### 3. 解冲突的固定套路

冲突几乎总是同一种形状——上游改了一行我们翻译过的 JSX：

```
<<<<<<< HEAD
        {t('decision.causalChain')}
=======
        Causal Chain (beta)
>>>>>>> upstream/main
```

**保留上游的语义，套用我们的机制**：

1. 看上游那侧的新英文是什么（这里多了 `(beta)`）
2. 改 `locales/en/<ns>.json` 里对应 key 的值，使其与上游新文案逐字一致
3. 同步更新 `locales/zh/<ns>.json`
4. 冲突处保留 `{t('...')}` 那一侧

如果某个文件被上游大改到难以逐处解，**放弃手工解，整文件取上游版本再重做接线**：

```bash
git checkout --theirs explorer/src/workspaces/XXX/YYY.tsx
# 然后把该文件里的硬编码串重新换成 t()，key 直接复用 locales 里已有的
```

词条目录不会丢，只是接线要重做——这比逐行解冲突快得多，也更不容易出错。

### 4. 合并后必跑的四件事

```bash
cd explorer
npx tsc -b                 # 抓「t() 用了不存在的 key」
npm run check:i18n:all     # 抓「en/zh 不对齐」「术语漂移」「上游新增的硬编码英文」
npm run build
npm run test:graph-workspace
```

四个检查的分工，缺一不可：

- **`tsc`**：key 写错 / 词条被删 → 编译失败。这是最强的一道，因为 `i18next.d.ts` 把
  英文目录绑成了类型。
- **`check:i18n`**：en/zh key 是否对齐、`{{插值}}` 是否匹配、术语是否漂移、是否有已知误译。
- **`check:i18n:usage`**：**这条专治上游合并**。上游新增的硬编码英文 `tsc` 是看不见的
  （代码完全合法），只有这个扫描器能发现。
- **测试**：`markdownEditorInteraction` / `explorerCapabilities` 这类测试会渲染组件，
  没初始化 i18n 就会渲染出原始 key。上游若新增此类测试，需要补一行
  `await import("../src/i18n/index.ts")`。

### 5. 处理 `check:i18n:usage` 的报告

它报出来的每一条，只有两种合法归宿：

```bash
# 归宿一：确实是文案 → 翻译它，加 key 到 en/zh 两个目录

# 归宿二：确实是数据（API 字段、示例查询、节点类型名、抛出的 Error）→ 记录例外
node scripts/find-untranslated.mjs --write-allow
# 然后编辑 scripts/untranslated-allow.json，把每条 TODO 换成真实理由
```

**不要为了让检查变绿而随手加例外**。例外里写清理由，是为了下一个人（或下一个 agent）
能判断这条到底该不该翻。

## 新增界面时

1. 先在 `locales/en/<ns>.json` 加 key，再在代码里 `t('...')`——顺序反了 `tsc` 会报错，
   这是刻意的。
2. `zh` 目录同步加，key 集合必须完全一致。
3. 术语查 `scripts/check-i18n.mjs` 里的 `GLOSSARY`；新的高频术语应加进去，
   这样以后不会漂移。
4. 无 DOM 的 `.ts` 模块用 `i18n.t(key, { ns })`，不要用 hook。
   `src/i18n/index.ts` 已做无 DOM 守卫，Node 单测可以直接导入。

## namespace 划分

| namespace | 覆盖 |
|---|---|
| `common` | 导航、首页、工作区框架（`defaultNS`，`t('...')` 不必带前缀） |
| `graph` | `workspaces/GraphWorkspace/**` |
| `ontology` | `workspaces/OntologyWorkspace/**` |
| `workspaces` | 其余所有工作区 |

按模块切分是为了多人（或多 agent）并行改造时不写同一个文件。新增大模块时建议开新 namespace。

## 长期方案：把 i18n 基建推给上游

只要 i18n 接线还是 fork 的私有改动，冲突就会一直存在。

彻底的解法是把**基建部分**（`src/i18n/`、`LanguageSwitcher`、以及 49 个文件的 `t()` 接线）
以 PR 形式并入上游，fork 只保留 `locales/zh/*.json`。那之后：

- 中文目录是纯新增文件 → 永远不冲突
- 上游自己维护英文目录，改文案时会同步改 key
- 我们只需要在合并后跑 `check:i18n` 补新增的 zh 词条

这是把「每次合并都要解 49 个文件」变成「每次合并补几条翻译」的唯一途径。
在推上游之前，上面的流程是控制成本的权宜之计，不是终局。
