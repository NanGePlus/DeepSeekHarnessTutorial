# dsh-hello-tool

DeepSeek Harness **树外插件**最小示例：向 Agent 注册一个名为 `hello` 的模型可见工具。

本包演示「不改官方 `packages/`、通过 `cordis.patch.yml` 挂载自定义 bundle」的标准写法，适合作为自研插件的起点。

## 功能

安装并启动 Harness 后，Agent 可调用 `hello` 工具：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `name` | `string`（可选） | 要问候的对象；省略时默认为 `world` |

**示例**：对 Agent 说「请调用 hello 工具，name 填 南哥AGI研习社」，应返回：

```text
Hello, 南哥AGI研习社! (from dsh-hello-tool)
```

## 环境要求

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh` CLI 可用）
- 本插件位于 Harness **monorepo 工作区**内开发时：Node.js `^22.19 \|\| >=24`，pnpm workspace 已 `pnpm install`
- 与所装 `dsh` 同一条 release wave 的 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`（开发态由 workspace 提供）

## 目录结构

```text
plugins/hello-tool/
  package.json              # npm 包声明 + dsh.bundle.patch
  cordis.patch.yml            # 正式安装：指向构建产物 lib/
  cordis.source.patch.yml     # 本地开发：指向源码 src/（配合 --patch）
  src/index.ts                # Cordis 插件入口，注册 hello 工具
  tsconfig.json
  lib/types/                  # pnpm build 生成（勿手改）
    index.js
    index.d.ts
```

## 核心文件说明

### `package.json`

- `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` — 声明这是一个可 `dsh plugin add` 的 bundle 包
- `peerDependencies` — 运行时由 Harness 宿主提供，**不要**把 `@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` 打进插件包
- `files` — 发布 npm / tarball 时只带上 `lib/` 与 `cordis.patch.yml`

### `cordis.patch.yml` vs `cordis.source.patch.yml`

| 文件 | 用途 | 入口 |
| --- | --- | --- |
| `cordis.source.patch.yml` | 本地 `--patch` 热迭代，**无需 build** | `./src/index.ts` |
| `cordis.patch.yml` | `dsh plugin add` 正式安装 | `./lib/types/index.js` |

两者 `insert.id` 均为 `hello-tool`，**不要**与 `--patch` 和 `plugin add` 同时使用，否则会 `duplicate loader entry id`。

### `src/index.ts`

标准 Cordis function plugin 三件套：

```ts
export const name = 'hello-tool'   // loader entry id
export const inject = ['tools']    // 注入全局工具注册表
export function apply(ctx) { ... } // 注册 hello 工具
```

工具通过 `@deepseek-ai/dsh-tools` 的 `defineTool` 定义，包含 `name`、`description`、`parameters`、`output`、`execute`。

## 开发与构建

在 Harness 仓库**根目录**执行：

```sh
pnpm install
pnpm --filter dsh-hello-tool build
```

### 本地迭代（推荐）

无需 build，直接通过 patch 加载源码插件：

```sh
pnpm dsh web --patch plugins/hello-tool/cordis.source.patch.yml
```

改 `src/index.ts` 后重启 `dsh web` 即可验证。

### 构建产物

正式安装、`pnpm pack`、npm 发布前需要 build：

```sh
pnpm --filter dsh-hello-tool build
```

产物输出到 `lib/types/`；`cordis.patch.yml` 引用 `./lib/types/index.js`。

## 安装

前提：已 build（`cordis.patch.yml` 依赖 `lib/`）。

**本地路径（同机开发 / 内部分发）**

```sh
pnpm dsh plugin --profile web add file:./plugins/hello-tool
pnpm dsh web
```

**卸载**

```sh
pnpm dsh plugin --profile web remove dsh-hello-tool
```

更多分发方式（tarball、npm、Git 仓库）及发布前检查清单，见上级教程：[../README.md](../README.md)。

## 验证

**1. 功能验证**

启动 Web UI 后，在会话中让 Agent 调用 `hello` 工具（见上文示例）。

**2. 配置层验证**

```sh
pnpm dsh --profile web --dump-config | rg hello-tool
```

输出中应能看到 `hello-tool` 对应的 loader entry。

## 从本示例扩展

常见下一步：

1. 增加更多 `defineTool` 或 Host 侧服务（`inject` 其他 Cordis service）
2. 增加 Client UI（`dsh.client` slot）— 本示例仅 Tool 面
3. 复制本目录为新插件包，改 `name`、`cordis.patch.yml` 的 `id`、业务逻辑
4. 发布前将 `peerDependencies` 的 `workspace:^` 改为与用户 `dsh` 兼容的 semver（如 `"^4.0.2"`、`"^0.1.2-rc.1"`）

## 注意事项

- 本插件**不修改**官方 `packages/*`、`vendor/*` 或 web-app bundle
- monorepo 外单独建 Git 仓分发时，需调整 `tsconfig.json`（不能引用 `../../vendor/cordis`），或预构建 `lib/` 后提交
- 发布 npm 前：`"private": false`，递增 `version`，并确认 `cordis.patch.yml` 的 `id` 与包内逻辑一致

## License

MIT
