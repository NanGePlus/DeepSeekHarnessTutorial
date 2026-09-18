# 04 插件交付4种方式

# dsh-hello-tool

本仓库**树外插件**的最小可跑示例。

## 这个例子说明什么

- 插件代码在 `plugins/hello-tool/`，不在 `packages/`。
- 通过 `cordis.patch.yml` 的 `insert` 挂载，**不需要改**官方 bundle 文件。
- 插件是标准 Cordis function plugin（`name` / `inject` / `apply`），注册一个模型可见的 `hello` 工具。

## 目录结构

```text
plugins/hello-tool/
  package.json        # npm 包 + dsh.bundle.patch 声明
  cordis.patch.yml    # 如何把本插件 insert 进 profile
  tsconfig.json
  src/index.ts        # 注册 hello 工具
  lib/                # 构建产物（生成）
```

## 构建

在仓库根目录：

```sh
pnpm install
```

## 挂载方式一：`--patch`（开发迭代）

启动 web 并通过 patch 加载源码插件（指向源码路径，无需先 build）：

```sh
pnpm dsh web --patch plugins/hello-tool/cordis.source.patch.yml
```

对 Agent 说：**「请调用 hello 工具，name 填 南哥AGI研习社」**，应返回 `Hello, 南哥AGI研习社! (from dsh-hello-tool)`。

## 挂载方式二：正式交付（`dsh plugin add`）

正式交付给别人时，用 **dsh plugin add** 安装进 profile；安装后直接用 `dsh web`（或 `dsh --profile <name>`）启动，**不要再加** `--patch`。

前提：对方已安装 `dsh` CLI；本包已 build（`cordis.patch.yml` 指向 `lib/` 产物）。

交付前在仓库根目录构建：

```sh
pnpm --filter dsh-hello-tool build
```

### 方式 1：本地目录 / 文件路径

在包含插件目录的路径下安装（内部分发、同机拷贝最常用）：

```sh
# 安装插件
pnpm dsh plugin --profile web add file:./plugins/hello-tool
# 重新启动
pnpm dsh web

# 卸载插件
pnpm dsh plugin --profile web remove dsh-hello-tool
```

### 方式 2：tarball（`pnpm pack`）

无需发布到 npm registry，适合邮件、网盘或 CI 产物分发：

```sh
pnpm --filter dsh-hello-tool build
# 生成 dsh-hello-tool-0.0.1.tgz
pnpm --filter dsh-hello-tool pack 
```

对方安装：

```sh
# 安装插件
pnpm dsh plugin --profile web add ./dsh-hello-tool-0.0.1.tgz
# 重新启动
pnpm dsh web

# 卸载插件
pnpm dsh plugin --profile web remove dsh-hello-tool
```

tarball 内已含预构建 `lib/`，对方安装时**不需要**运行 build 脚本。

### 方式 3：npm registry

把本包封装成普通 npm 包发布到公共 [npmjs.com](https://www.npmjs.com) 或公司私有 registry。用户按**包名**安装，适合对外公开、团队统一安装和版本管理。

#### 发布物包含什么

`pnpm publish` 只上传 `package.json` 的 `files` 所列内容：

- `lib/types/index.js` 及类型声明（须先 build）
- `cordis.patch.yml`

不会带上 `src/`、`tsconfig.json` 等开发文件。`cordis.patch.yml` 指向 `./lib/types/index.js`，因此 **publish 前必须先 build**。

#### 发布前检查并修改包中的package.json

1. 设置name，确认包名 `dsh-hello-tool` 在目标 registry 上可用；若冲突可改为 `@你的scope/dsh-hello-tool`。
2. 设置“version” 版本号，如0.0.1。
3. 将`"private" 改为 false`（否则 npm 拒绝 publish）。
4. 将 `peerDependencies` 中的 `workspace:^` 改为与用户所装 `dsh` 兼容的 semver，例如 `"@deepseek-ai/cordis": "^4.0.2"`、`"@deepseek-ai/dsh-tools": "^0.1.2-rc.1"`。可以通过指令查询：pm view @deepseek-ai/cordis version。
5. 再修改下 cordis.patch.yml 中的name与包名一致。
6. 每次发新版本时递增 `version`，再 publish。

#### 作者发布

首先，登陆[npmjs.com](https://www.npmjs.com)，注册npm账号。

然后，登陆平台，建议用 Access Token 进行发布。按照如下步骤操作：

1. npm 网站 → Access Tokens → Generate New Token → 选 Granular Access Token
2. 权限选 Publish，并勾选 Bypass two-factor authentication
3. 写入 `.npmrc`（不要提交到 git）：

```
//registry.npmjs.org/:_authToken=你的token
```

1. 再执行：

```sh
cd plugins/hello-tool
pnpm build
npm publish --access public --no-git-checks
```

#### 使用方安装

前提：已安装 `dsh` CLI。

```sh
# 安装插件
pnpm dsh plugin --profile web add dsh-hello-tool
# 重新启动
pnpm dsh web

# 卸载插件
pnpm dsh plugin --profile web remove dsh-hello-tool
```

### 方式 4：Git 仓库

把插件托管在 GitHub（或 GitLab 等），用户一条命令从 Git 地址安装。适合**开源分享、快速迭代**。

#### 作者发布：把插件推到 GitHub

**第 1 步：新建独立仓库**

在 GitHub 新建一个空仓库，例如 `dsh-hello-tool`（仓库根目录就是 npm 包根，**不要**把整个 harness 官方仓 push 上去）。

**第 2 步：准备仓库内容**

把本教程 `plugins/hello-tool/` 下的文件复制到新仓库根目录，至少包含：

```text
dsh-hello-tool/          ← 仓库根
  package.json
  cordis.patch.yml
  src/index.ts
  tsconfig.json
  lib/ 
```

**第 3 步：改** `package.json`**（发布前必做）**

与方式3相同。

#### 使用方：从 GitHub 安装

前提：已安装 `dsh` CLI。

```sh
# 安装插件
# 跟踪 main 最新（不推荐生产）
pnpm dsh plugin --profile web add github:你的用户名/dsh-hello-tool
# 推荐：锁定 tag 或 commit，避免作者 push 后 silently 变代码
pnpm dsh plugin --profile web add github:你的用户名/dsh-hello-tool#v0.0.1
# 或
pnpm dsh plugin --profile web add github:你的用户名/dsh-hello-tool#<commit-sha>

# 重新启动
pnpm dsh web

# 卸载插件
pnpm dsh plugin --profile web remove dsh-hello-tool
```

