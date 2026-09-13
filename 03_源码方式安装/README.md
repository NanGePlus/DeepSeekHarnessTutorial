# 03 源码安装运行

## 1、安装 Git

#### macOS

```bash
# 先查询下是否安装git
git --version

# 若未安装，则执行如下命令安装
xcode-select --install
git --version
```

看到类似 `git version 2.x.x` 即成功。官方开发指南要求 **Git 2.26+**。

#### Windows

1. 打开 [https://gitforwindows.org](https://gitforwindows.org) 下载 Git for Windows。
2. 一路使用默认配置安装。
3. 打开 Git Bash 或命令提示符，输入：

```bash
git --version
```

看到类似 `git version 2.x.x.windows.x` 即成功。

#### Linux

Ubuntu/Debian：

```bash
sudo apt-get update
sudo apt-get install git
git --version
```

CentOS/Fedora：

```bash
sudo yum install git
git --version
```

## 2、本地运行环境配置

确认本地运行环境（推荐：为本项目做隔离，别弄乱整机，本项目**不需要** MySQL / Redis / JDK。会话与设置落在 `$DSH_HOME`（默认 `~/.dsh`）。

#### 2.1 一次性装好「隔离工具」

**nvm**（Node）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm --version
```

**Corepack**（pnpm）：

```bash
corepack enable
corepack --version
```



## 3、源码安装运行



### 3.1 项目初始化

新建项目目录

```bash
# 新建空目录
mkdir my-dsh-plugins
cd my-dsh-plugins
# 用 Cursor 打开这个文件夹
cursor .
```

克隆官方仓库到本地

```bash
# 进到项目根目录
cd my-dsh-plugins

# 官方 GitHub · 默认 master
git clone https://github.com/deepseek-ai/deepseek-harness.git .
```

**说明**：

- `git clone` = 把官方整份代码下载到本机  
- 跟做**留在** `master`  
- 仓库体积与提交历史都很大，首次克隆需要一点时间

克隆完成后，在项目根目录应能看到 `package.json`、`pnpm-workspace.yaml`、`packages/`、`apps/`、`AGENTS.md` 等（以官方当前结构为准）。

### 3.2 运行

官方要求：从源码运行要先装依赖、再构建、再启动。

**0）激活本项目隔离环境**

```bash
# 为本项目准备Node(nvm)
nvm install 24.19.0
nvm list
nvm use 24.19.0

# 自检
node -v
corepack enable
pnpm --version
git --version
```

**1）安装依赖并做一次类型检查**

```bash
pnpm install
pnpm run typecheck
```

**2）构建（源码启动 Web / headless 前必须）**

```bash
pnpm run build
```

**3）启动 Web UI**

在**项目根**执行：

```bash
pnpm dsh web
```

**成功标志**

- 终端打印访问地址，默认 **[http://127.0.0.1:3080](http://127.0.0.1:3080)**。  
- 浏览器能打开 Web UI。

**4）安装社区插件**

DeepSeek Harness 的插件生态基于 **npm**，社区插件通常带有 GitHub topic `dsh-plugin`。  
社区插件链接：[https://dsh.deepseek404.com/](https://dsh.deepseek404.com/)

```bash
# 向当前 web profile 添加插件（示例包名请替换为实际社区插件）
pnpm dsh plugin --profile web add github:RevolutionLA/dsh-dream-skin
pnpm dsh plugin --profile web add @jiyr0119/dsh-workspace-explorer
# 再重启服务
pnpm dsh web

# 卸载插件
pnpm dsh plugin --profile web remove dsh-dream-skin
pnpm dsh plugin --profile web remove @jiyr0119/dsh-workspace-explorer
```

安装后可在 Settings → Plugins 中查看插件状态与配置项。

### 验证插件是否生效

- 进入 设置（Settings） → 插件（Plugins）插件列表中确认插件状态为 已启用（ACTIVE）
- 若插件注册了工具或服务，在新会话中触发对应能力

