# 01 一键快捷安装与功能演示

## 前置准备

### 1. 环境要求

- **Node.js**：`^22.19` 或 `>=24`（官方推荐）
- **网络**：可访问 npm registry 与 DeepSeek API
- **浏览器**：Chrome / Edge / Safari 等现代浏览器

### 2. 安装 Node.js（macOS / Linux 示例）

推荐使用 nvm 管理 Node 版本：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm --version

nvm install 24.19.0
nvm use 24.19.0

node -v
```

Windows 用户可直接从 [https://nodejs.org/](https://nodejs.org/) 下载 LTS 安装包。

## 第一部分：npm 安装与启动

### 步骤 1：启动 Web UI

无需全局安装，直接通过 npx 运行：

```bash
npx @deepseek-ai/dsh web
```

首次运行会自动下载 `@deepseek-ai/dsh` 包。启动成功后，终端会提示监听地址，默认：

```
http://127.0.0.1:3080
```

在浏览器中打开上述地址即可进入 Harness Web UI。

> 说明：`dsh` CLI 是启动器，官方内置两个 profile：`web`（浏览器交互）和 `headless`（无 UI 一次性任务）。npm 方式适合快速体验，不涉及源码编译。



### 步骤 2：配置模型 API Key

1. 进入 **设置（Settings） → 模型（Models）**
2. 在 DeepSeek 卡片中填入 API Key（热生效，无需重启），API Key获取链接： [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)

也可通过 **添加提供方（Add provider）** 接入 Anthropic / OpenAI，或添加自定义提供方（Add a custom provider）接入任意 OpenAI 兼容网关。

### 步骤 3：选择 工作区（Workspace） 并新建会话

1. 在首页选择或创建一个 **工作区**（Agent 的工作目录）
2. 点击 **新会话（New Session）** 新建会话
3. 配置以下选项：
  - **Agent预设（Agent Preset）**：如 标准模式（Standard Mode）、PTC模式（Programs-That-Compose Mode）、极简模式（Minimal Mode）、创造模式（Creative Mode）
  - **权限档位**：如 仅可查看（Read Only）、工作区内修改（Workspace Write）、完全权限（Full Access）
  - **模型**：如 DeepSeek-V4-Flash

发送第一条消息，确认 Agent 能正常响应。

## 第二部分：安装社区插件

DeepSeek Harness 的插件生态基于 **npm**，社区插件通常带有 GitHub topic `dsh-plugin`。  
社区插件链接：[https://dsh.deepseek404.com/](https://dsh.deepseek404.com/)

```bash
# 向当前 web profile 添加插件（示例包名请替换为实际社区插件）
npx @deepseek-ai/dsh plugin --profile web add github:RevolutionLA/dsh-dream-skin
npx @deepseek-ai/dsh plugin --profile web add @jiyr0119/dsh-workspace-explorer
# 再重启服务
npx @deepseek-ai/dsh web

# 卸载插件
npx @deepseek-ai/dsh plugin --profile web remove dsh-dream-skin
npx @deepseek-ai/dsh plugin --profile web remove @jiyr0119/dsh-workspace-explorer
```

安装后可在 Settings → Plugins 中查看插件状态与配置项。

### 验证插件是否生效

- 进入 设置（Settings） → 插件（Plugins）插件列表中确认插件状态为 已启用（ACTIVE）
- 若插件注册了工具或服务，在新会话中触发对应能力

