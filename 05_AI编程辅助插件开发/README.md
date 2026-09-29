# 05 **用 AI Coding SOP 高效写 DeepSeek Harness 插件**

> 本指南以 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/develop/basic/)（开源 agent harness，CLI 为 `dsh`）为载体，演示如何在 `my-dsh-plugins` 插件开发基线**上用 Cursor / Claude Code 等 AI 编程助手完成**多插件定制化开发。

---

## 一、你需要提前准备什么


| 条件               | 是否必须   | 说明                                                        |
| ---------------- | ------ | --------------------------------------------------------- |
| 一个 AI 编程助手       | ✅ 必须   | Cursor、Claude Code、Codex 等                                |
| GitHub 账号        | ✅ 必须   | 拉官方代码 + 托管你的私有仓、Issue、PR                                  |
| GitHub CLI（gh）   | ✅ 必须   | 终端或 Agent 创建 PR、关联 Issue                                  |
| Git              | ✅ 必须   | 本地版本控制；上游在官方 GitHub；官方要求 **Git 2.26+**                    |
| 工程 Skills        | ✅ 必须   | 本仓库 `v1.2/skills` 工程技能包                                   |
| Node.js          | ✅ 必须   | `^22.19` **或** `>=24`（CI 覆盖 22.19 / 24 / 26）；推荐 nvm，见 3.2 |
| pnpm             | ✅ 必须   | 仓库固定 `pnpm@11.7.0`；用 Corepack 启用                          |
| DeepSeek API Key | ⭐ 强烈推荐 | Web 里选工作区、发消息、验收「插入文件引用后模型能 read」需要                       |
| 现代浏览器            | ⭐ 强烈推荐 | 资源管理器是 Web UI 插件；Chrome / Edge / Safari 最新版即可             |




### 1.1 注册 GitHub 并准备 SSH

1. 打开 [https://github.com](https://github.com) 注册账号。
2. 进入 **Settings** → **SSH and GPG keys**。
3. 如果还没有 SSH 密钥，在终端执行：

```bash
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
```

复制公钥：

macOS：

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

Linux（需要 `xclip`）：

```bash
xclip -sel clip < ~/.ssh/id_ed25519.pub
```

Windows Git Bash：

```bash
cat ~/.ssh/id_ed25519.pub | clip
```

回到 GitHub，点击 **New SSH key**，粘贴公钥并保存。

测试 SSH：

```bash
ssh -T git@github.com
```

成功后会看到类似 `Hi 你的用户名!`

### 1.2 安装 Git



#### macOS

```bash
git --version
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



### 1.3 安装 GitHub CLI (gh)



#### macOS

```bash
gh --version
# 如果未安装，执行下列命令进行安装
brew install gh

# 安装后进行身份认证（建议使用 SSH 方式）
gh auth login

# （如遇权限问题）授予当前用户配置目录的权限
sudo chown -R "$(whoami):staff" ~/.config/gh

# 检查认证状态
gh auth status
```



#### Windows

1. 访问 [https://github.com/cli/cli/releases](https://github.com/cli/cli/releases) 下载 Windows 安装包（`gh_*_windows_amd64.msi`）。
2. 双击运行安装，完成后在“命令提示符”或 PowerShell 执行：

```bash
gh --version
```

1. 初始化并认证 GitHub 账户（建议选择 SSH 方式）：

```bash
gh auth login
```

1. 检查认证状态：

```bash
gh auth status
```



#### Linux

（以 Ubuntu/Debian 为例）

```bash
# 安装最新 gh 版本
type -p curl >/dev/null || sudo apt install curl -y
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh -y

# 安装完成后认证（推荐 SSH）
gh auth login

# 检查认证状态
gh auth status
```

看到 `gh version x.x.x` 信息和认证通过即可。

### 1.4 确认 Skills 已就绪

跟做前，确认你的 AI 编程助手已启用本指南用到的工程 Skills。Skills 包清单如下：


| 序号  | 命令                              | 分类  | 一句话                                             |
| --- | ------------------------------- | --- | ----------------------------------------------- |
| 1   | `/setup-skills`                 | 工程  | 每个仓跑一次，配置 Issue 跟踪器、Triage 标签、领域文档和 ADR、UI 设计治理 |
| 2   | `grill-with-docs`               | 工程  | 拷问方案的同时维护 `CONTEXT.md` / ADR / UI 设计治理骨架        |
| 3   | `grill-me`                      | 效率  | 纯拷问，不写仓库文档                                      |
| 4   | `to-prd`                        | 工程  | 把已对齐的需求整理成 PRD 并发布至 Issue                       |
| 5   | `to-issues`                     | 工程  | 按 tracer-bullet 垂直切片，拆功能 Issue 与 UI Issue       |
| 6   | `tdd`                           | 工程  | 红-绿-重构，测试驱动开发                                   |
| 7   | `diagnose`                      | 工程  | 有纪律的排错循环                                        |
| 8   | `triage`                        | 工程  | Issue 状态机分拣                                     |
| 9   | `improve-codebase-architecture` | 工程  | 找「加深模块」的架构重构机会                                  |
| 10  | `zoom-out`                      | 工程  | 拉高视角看陌生代码                                       |


---



## 二、跟做：完整闭环演练



### 2.1 项目初始化



#### 2.1.1 新建项目目录

```bash
# 新建空目录
mkdir my-dsh-plugins
cd my-dsh-plugins
# 用 Cursor 打开这个文件夹
cursor .
```



#### 2.1.2 克隆官方仓库到本地

```bash
# 进到项目根目录
cd my-dsh-plugins

# 官方 GitHub · 默认 master
git clone https://github.com/deepseek-ai/deepseek-harness.git .

# 确认在 master
git branch
```

**说明**：

- `git clone` = 把官方整份代码下载到本机  
- 跟做**留在** `master`  
- 仓库体积与提交历史都很大，首次克隆需要一点时间

**检查当前远程**（此时通常只有一个叫 `origin` 的远程，指向官方 GitHub）：

```bash
git remote -v
```

类似：

```text
origin  https://github.com/deepseek-ai/deepseek-harness.git (fetch)
origin  https://github.com/deepseek-ai/deepseek-harness.git (push)
```

接下来我们要把它改成：**upstream = 官方 GitHub，origin = 你的私有库**。

#### 2.1.3 把现在的 origin 改名为 upstream

```bash
git remote rename origin upstream
git remote -v
```

**成功标志**：

```text
upstream  https://github.com/deepseek-ai/deepseek-harness.git (fetch)
upstream  https://github.com/deepseek-ai/deepseek-harness.git (push)
```

此时还没有 `origin`，这是正常的。

#### 2.1.4 在 GitHub 创建空私有仓库

1. 浏览器打开 [https://github.com/new](https://github.com/new)
2. 填写：
  - **Repository name**：`my-dsh-plugins`（推荐；表示 Harness 插件开发基线，可放多个插件）  
  - **Description**：可选，如「DeepSeek Harness 插件开发基线（`plugins/` 多插件）」  
  - 选择 **Private**（私有；闭源商用必选）  
  - **不要**勾选 “Add a README file”  
  - **不要**勾选 “Add .gitignore”  
  - 要的是 **完全空仓库**
3. 点 **Create repository**。

创建后会看到仓库地址，二选一：

- SSH：`git@github.com:你的用户名/my-dsh-plugins.git`  
- HTTPS：`https://github.com/你的用户名/my-dsh-plugins.git`

**复制 SSH 地址**（推荐，已配置 SSH 的话）。

#### 2.1.5 添加你的私有仓库为 origin

把下面命令里的地址换成 **你刚复制的地址**：

```bash
git remote add origin git@github.com:YOUR_USER/my-dsh-plugins.git
git remote -v
```

**成功标志**（顺序无所谓）：

```text
origin    git@github.com:YOUR_USER/my-dsh-plugins.git (fetch)
origin    git@github.com:YOUR_USER/my-dsh-plugins.git (push)
upstream  https://github.com/deepseek-ai/deepseek-harness.git (fetch)
upstream  https://github.com/deepseek-ai/deepseek-harness.git (push)
```



#### 2.1.6 创建定制分支 custom/main

**为什么要新分支？**  
官方更新会进 `master`；你的插件代码与 `CUSTOM.md` 放在 `custom/main`，合并时界限清晰。预览期上游变动很快，这条分界尤其重要。

```bash
# 查看当前在哪个分支（跟做应在 master）
git branch

# 创建并切换到 custom/main
git checkout -b custom/main
```

**成功标志**：终端提示 `Switched to a new branch 'custom/main'`，`git branch` 里 `custom/main` 前面有 `*`。

#### 2.1.7 第一次推送到你的私有仓库

```bash
git push -u origin custom/main
```

**说明**：

- `push` = 把本地分支上传到 GitHub。  
- `-u` = 以后在这个分支上直接 `git push` 即可，不用每次写远程名。

**成功标志**：

- 终端无报错，最后一行类似 `Branch 'custom/main' set up to track remote branch 'custom/main' from 'origin'.`  
- 浏览器打开 `https://github.com/你的用户名/my-dsh-plugins`，能看到代码，分支选 `custom/main`。

> **若提示权限错误**：检查 SSH（见 1.1）或改用 HTTPS 地址再 `git remote set-url origin https://...`。



#### 2.1.8 本地跑通一次（强烈建议，再谈定制）

官方要求：**从源码运行要先装依赖、再构建、再启动**。对于 Node / pnpm 的隔离安装请参考第 4 章，配置完成后再继续往下操作。

**0）激活本项目隔离环境（每个新终端做一次）**

```bash
# 在项目根目录
nvm use          # 读取 .nvmrc（若尚未创建，见 3.2）
corepack enable
pnpm --version   # 应解析到仓库锁定的 11.7.0 一带
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

**3）（可选）准备 API Key**

任选其一，**不要把真实 Key 提交进 Git**：

- 稍后在 Web UI **设置 → 模型**里填写（写入 `~/.dsh/.credentials.yaml`）  
- 或在仓库根目录建被 gitignore 的 `.env`：

```sh
DEEPSEEK_API_KEY=sk-...
```

**4）启动 Web UI**

在**项目根**执行：

```bash
pnpm dsh web
```

**成功标志**

- 终端打印访问地址，默认 **[http://127.0.0.1:3080](http://127.0.0.1:3080)**。  
- 浏览器能打开 Web UI。  
- 打开 **设置 → 模型**，填入 DeepSeek API Key 并保存。  
- 点击 **选择工作区**，选中你启动 `dsh` 时所在的项目目录。  
- 新开会话，发送一句例如：`List the main packages in this repository.`，模型能回复（需已配置 Key）。

> `dsh web` 是 `--profile web` 的别名。改端口：`pnpm dsh web --port 3081`。



#### 2.1.9 创建 CUSTOM.md（强烈建议）

用来记录「我改了什么、插件挂在哪」，以后合并官方时非常有用。

在仓库根目录新建 `CUSTOM.md`，内容可先照抄：

```markdown
# 相对官方的定制说明

## 基线（my-dsh-plugins 整仓）
- 项目名：my-dsh-plugins（Harness fork + plugins/ 多插件开发基线）
- 上游仓库：https://github.com/deepseek-ai/deepseek-harness
- 跟做基线分支：master（developer preview，会有破坏性变更）
- 运行方式：从源码 pnpm install / build / pnpm dsh web
- Node：^22.19 或 >=24；pnpm@11.7.0（Corepack）
- 扩展策略：树外插件放 plugins/<插件名>/；不改 packages/client，不改 vendor/

## 我的插件与组合包

## 我改过的官方文件（尽量为空）
| 文件/目录 | 改了什么 | 日期 |
|-----------|----------|------|
| | | |

## 我故意不跟的上游行为
| 点 | 原因 |
|----|------|
| | |

## 合并官方记录
| 日期 | 官方提交/标签 | 有没有冲突 | 备注 |
|------|---------------|------------|------|
| | | | |
```

保存后执行：

```bash
git add CUSTOM.md
git commit -m "docs: 添加定制记录文件 CUSTOM.md"
git push
```



#### 2.1.10 初始化自检（做完打勾）

在 `my-dsh-plugins` 目录执行：

```bash
git status
git branch
git remote -v
```


| 检查项             | 期望结果                                                  |
| --------------- | ----------------------------------------------------- |
| `git status`    | `nothing to commit, working tree clean`（或只有你知道的未提交文件） |
| `git branch`    | 当前在 `* custom/main`                                   |
| `git remote -v` | 同时有 `origin`（你的私有 GitHub）和 `upstream`（官方 GitHub）      |
| GitHub 网页       | 私有库 `my-dsh-plugins`，分支 `custom/main` 有代码             |
| 本地联调            | `pnpm run typecheck` 通过；`pnpm dsh web` 可打开 UI         |
| 插件路径            | `--patch` 后终端出现 `[hello-plugin] plugin loaded!`       |


**到这里初始化完成。** 后面所有开发都在 `custom/main` 上进行（或从其上拉 `issue/`* 分支）。各插件代码放 `plugins/<插件名>/`（成熟后可拆独立仓），不要和官方 `packages/` 缠在一起。

### 2.2 二次开发（接入工作法）



#### 2.2.1 项目初始配置 — `/setup-skills`

**自然语言（在 Cursor 里说）**：

```bash
/setup-skills
```


| 步骤  | 问什么             | 小白怎么选                                                            |
| --- | --------------- | ---------------------------------------------------------------- |
| A   | Issue 跟踪器放哪？    | **跟做推荐 GitHub**                                                  |
| B   | Triage 标签叫什么？   | 第一次用 → 接受默认；资源管理器 UI 会用到 `design-input`                          |
| C   | 领域文档放哪？         | 单仓 monorepo → **Single-context**（根目录 `CONTEXT.md` + `docs/adr/`） |
| D   | Repo Wiki 代码导读？ | 启用，zh-CN                                                         |


完成后会在项目里生成 `AGENTS.md` / `docs/agents/` 等工作法配置。**不要删掉官方** `AGENTS.md` **里的仓库纪律**；你的插件术语进 `CONTEXT.md`。

**每个仓库只需跑一次**。最后：

```
提交并push
```



#### 2.2.2 查看当前代码结构 — `/zoom-out 和 /repo-wiki`

**自然语言（在 Cursor 里说）：**

```
/zoom-out

当前代码整体架构
```

**自然语言（在 Cursor 里说）：**

```
/repo-wiki 
```



#### 2.2.3 开工前对齐 — `/grill-with-docs`

**自然语言（在 Cursor 里说）**：

```
/grill-with-docs 

我要做插件定制化：开发 **SOP 胶囊** Web UI 插件。插件工作名：dsh-sop-capsules。

产品定位（通用，不绑定某一业务需求）：
- 用户可**自定义分组**（例如分组 id：`ai-coding-sop-capsules`），组内可**自行添加、编辑、排序**胶囊；胶囊正文尽量通用，点击注入输入框后我再针对性修改再发送
- 分组与胶囊数据落在当前工作区 `.dsh/sop-capsules/`（manifest + `groups/<group-id>.yaml`），Host 读写、Client 展示与维护；改 yaml 即生效，无需重装插件

v1 目标：
- 不改 vendor/，不改 packages/client 源码；树外双面插件（Host + Client）+ bundle 扩展
- Client：会话头入口；`shell.overlay` 内分组切换 + 胶囊列表（可搜索）；点击胶囊 → `conversation.input.dock` 注入 draft（replace / append）
- Host：对工作区 `.dsh/sop-capsules/` 的 list / read / save / delete（RPC）；未选工作区时明确提示
- 维护态：分组 CRUD、胶囊 CRUD、拖拽排序；支持导入/导出单个分组 yaml
- 视觉对齐 DSH 原生（`--dsw-alias-*` token）；面板不遮挡 composer
- 分发：仓内 `--patch` 开发 → `dsh.bundle` → `dsh plugin add` 装进 web profile；定制记入 CUSTOM.md，方便合并 upstream

请一步步拷问我，把 v1 范围、slot 选择、Host RPC 契约、yaml schema、replace/append 规则、编辑态 UX、测试验收方式和术语都落地清楚。
```

**确认后，自然语言（在 Cursor 里说）：**

```
提交并push
```



#### 2.2.4 沉淀需求 — `/to-prd`

对齐后，**自然语言（在 Cursor 里说）：**

```
/to-prd

整理成 PRD
```

智能体会在项目根目录下的docs/prd生成 PRD，本地审核后提交至 GitHub Issue。

**自然语言（在 Cursor 里说）：**

```
发布到 GitHub Issue 
```



#### 2.2.5 拆任务 — `/to-issues`

**自然语言（在 Cursor 里说）**：

```
/to-issues

按垂直切片拆 v1 PRD
```

拆完后：

```
确认拆分合理，创建issue
```



#### 2.2.6 写代码 — 分支 + `/tdd` + PR

从 **Issue #2** 开始（Issue #1 一般为 PRD），**每个 Issue 走一遍「拉分支 → TDD → push → CI → PR → 合并」**。

**自然语言（在 Cursor 里说）**：

```
/tdd 从最新 custom/main 创建新分支，实现 Issue #[num]
```

**接入 CI（首次）：**

```
【首次设置即可】设置任意分支 push 和 PR 时都要（不要）跑 CI
```

**push、等 CI、开 PR、合并：**

```
提交并开 PR。然后合并该 PR 到 main，不要删除该分支，并确认该 Issue 已关闭
```



#### 2.2.7 出问题时 — `/diagnose`

**自然语言（在 Cursor 里说）**：

```
/diagnose

[描述你的具体问题]
```



#### 2.2.8 v1 跑通后的维护 — `/improve-codebase-architecture`

```
/improve-codebase-architecture

看看有没有可以把模块“加深”、接口收窄的地方。
```

---



## 三、上游有版本更新时：如何合并进当前仓库

二次开发不是「克隆一次就结束」。官方会修 bug、发安全补丁、加功能；你的私有库在 `custom/main` 上持续改品牌与业务。两边都会前进，必须**定期把上游变更合进你的定制分支**，否则差距越大，冲突越难解。

本节回答：官方仓库有新版本 / 新提交时，如何安全地合并到你当前仓库（`custom/main`）。

### 3.1 先搞清三条线（心智模型）


| 名称            | 指向              | 谁在改      | 你平时写代码在哪         |
| ------------- | --------------- | -------- | ---------------- |
| `upstream`    | 官方仓库（如 QwenPaw） | 上游维护者    | 只读拉取，不直接往这推业务定制  |
| `origin`      | 你的私有仓库          | 你 / 你的团队 | `git push` 的目标   |
| `custom/main` | 你的定制主干          | 你        | **日常开发与合并上游的落点** |


合并的本质是：

```text
官方 main（或 release 标签）的新提交
        ↓  git fetch + git merge（或 PR）
你的 custom/main（保留定制，吸收官方变更）
        ↓  git push
你的 origin（私有库跟上）
```

> **不要**在合并时直接改 `upstream` 远程地址，也不要在脏工作区上硬合。先保证本地干净、分支正确。



### 3.2 合并前自检（做完再动手）

在项目根目录执行：

```bash
git status
git branch
git remote -v
```


| 检查项  | 期望结果                                                            |
| ---- | --------------------------------------------------------------- |
| 工作区  | `nothing to commit, working tree clean`（有未提交改动先 commit 或 stash） |
| 当前分支 | `* custom/main`（或你约定的定制主干）                                      |
| 远程   | 同时有 `origin`（你的）和 `upstream`（官方）                                |
| 定制记录 | 根目录有 `CUSTOM.md`，且「我改过的文件」大致最新                                  |


**自然语言（在 Cursor 里说）**：

```
合并上游前做一次自检：确认当前在 custom/main、工作区干净、origin/upstream 远程齐全，并摘要 CUSTOM.md 里「我改过的文件」清单
```



### 3.3 拉取上游，先看「更新了什么」

```bash
# 1）拉取官方最新引用（不改你本地文件）
git fetch upstream

# 2）看官方默认主干相对你这边多了哪些提交（官方多为 main）
git log --oneline HEAD..upstream/main

# 3）看会碰到哪些文件（合并预览）
git diff --stat HEAD...upstream/main
```

若官方用标签发版，可先列出再对准某个版本：

```bash
git fetch upstream --tags
git tag -l --sort=-v:refname | head
# 示例：核对某标签相对当前的差异
git log --oneline HEAD..v1.2.0
```

**怎么读结果：**

- `git log` 为空 → 你这边已经包含官方这些提交，**本次无需合并**。
- 有提交、且 `git diff --stat` 里出现你在 `CUSTOM.md` 改过的路径 → **高风险冲突区**，合并时重点盯这些文件。

**自然语言（在 Cursor 里说）**：

```
先切到 custom/main。fetch upstream，对比 custom/main 与 upstream/main：列出新增提交摘要、变更文件统计，并标出与 CUSTOM.md「我改过的文件」重叠的路径
```



### 3.4 推荐流程：单独开「同步分支」再合进定制主干

不建议在 `custom/main` 上直接瞎试。更稳的做法与日常 Issue 开发一致：**拉同步分支 → 合并上游 → 解决冲突 → 自测 → PR → 合回** `custom/main`。

#### 3.4.1 从最新定制主干拉同步分支

```bash
git checkout custom/main
git pull origin custom/main
git checkout -b sync/upstream-YYYYMMDD
```

把 `YYYYMMDD` 换成当天日期，或改成官方版本号，如 `sync/upstream-v1.2.0`。

#### 3.4.2 合并官方主干（或指定标签）

```bash
# 跟做默认：合官方 main
git merge upstream/main
```

若要对齐某个发版标签：

```bash
git merge v1.2.0
```

**自然语言（在 Cursor 里说）**：

```
从最新 custom/main 创建分支 sync/upstream-YYYYMMDD，
把 upstream/main 合并进来；
有冲突先停下来：只列出冲突文件与冲突原因，不要擅自丢弃我们的品牌定制与 CUSTOM.md 记录
```



#### 3.4.3 出现冲突时怎么处理

冲突 = 同一文件两边都改过。原则：

1. **先停**，看清冲突文件列表，对照 `CUSTOM.md`。
2. **品牌 / 文案 / Logo / 你故意删除的商用裁剪** → 优先保留你的定制，再手工把官方必要的逻辑补回来。
3. **官方 bugfix / 安全补丁 / 与你无关的核心逻辑** → 优先吸收官方，再把你的定制叠回去。
4. **不要**为了「能合过去」直接选一边全部覆盖；合完后应用能跑、品牌还在。

查看冲突文件：

```bash
git status
# 或
git diff --name-only --diff-filter=U
```

解决每个文件后：

```bash
git add <已解决的文件>
# 全部解决后
git commit   # 若 merge 已自动生成提交信息，按提示完成即可
```

**自然语言（在 Cursor 里说）**：

```
/diagnose

合并 upstream/main 时出现冲突。请按 CUSTOM.md 区分「必须保留的定制」与「应吸收的官方修复」，
逐文件给出保留策略，改完后说明如何验证，不要 silently 丢掉定制
```

冲突面很大、一时理不清时：先把冲突文件清单记成 Issue，再逐个消化——**不要在半解决状态强行 push 当完成**。

### 3.5 合并后验收（比「能 commit」更重要）

按项目实际情况勾选（以 QwenPaw 类项目为例）：

1. **能安装 / 能启动**：按官方 README 或你项目文档把服务跑起来。
2. **品牌还在**：产品名、Logo、关键文案没有被官方默认值盖掉。
3. **定制能力仍在**：你在 `CUSTOM.md` 里记过的关键改动抽查一遍。
4. **测试 / CI**：本地测一遍；有 CI 则 push 后等 Actions 变绿。
5. **记一笔账**：更新 `CUSTOM.md` 的「合并官方记录」。

`CUSTOM.md` 示例追加一行：

```markdown
## 合并官方记录
| 日期 | 官方版本 | 有没有冲突 | 备注 |
|------|----------|------------|------|
| 2026-07-25 | upstream/main@abc1234 | 有：改了 README 品牌名 | 保留我方品牌，吸收官方依赖升级 |
```

```bash
git add CUSTOM.md
git commit -m "docs: 记录合并 upstream（YYYYMMDD）"
```



### 3.6 合回定制主干并推送到私有库

同步分支验收通过后，走 PR（推荐）或快进合并：

**方式 A：PR（推荐，可审查、可走 CI）**

**自然语言（在 Cursor 里说）**：

```
提交并 push 当前同步分支，创建 PR 合并进 custom/main；
PR 说明写清：上游范围、冲突文件与取舍、本地/CI 验收结果
```

CI 全绿、人工确认品牌与关键路径无误后：

```
合并该 PR 到 custom/main，不要删除该分支（或按团队习惯删除），并确认无残留冲突
```

**方式 B：本地直接合回（个人仓、改动很小时）**

```bash
git checkout custom/main
git merge sync/upstream-YYYYMMDD
git push origin custom/main
```



### 3.7 建议节奏与禁忌


| 建议      | 说明                                         |
| ------- | ------------------------------------------ |
| 定期合     | 官方活跃时每周或每发版合一次；拖越久，冲突越指数级变难                |
| 小步合     | 一次对齐一个上游区间（一段提交或一个 tag），不要攒半年再合            |
| 先记后合    | `CUSTOM.md` 越完整，冲突决策越快                     |
| 同步与业务分开 | 正在开发的 Issue 分支先合完或搁置；避免「业务半成品 + 上游大合并」搅在一起 |


**禁忌：**

- 在未 `fetch` 的情况下凭感觉改版本号「算同步完了」。  
- 冲突时一律 `git checkout --theirs/--ours` 整文件覆盖，却不看内容。  
- 合并后不启动、不看品牌、不更新 `CUSTOM.md`。  
- 把只属于你私有仓的提交 `push` 到 `upstream`（你通常没有写权限，也不该推）。



### 3.8 一页纸命令清单（可收藏）

```bash
# 自检
git status && git branch && git remote -v

# 拉上游并预览
git fetch upstream
git log --oneline HEAD..upstream/main
git diff --stat HEAD...upstream/main

# 同步分支上合并
git checkout custom/main && git pull origin custom/main
git checkout -b sync/upstream-YYYYMMDD
git merge upstream/main
# …解决冲突、自测、更新 CUSTOM.md…

# 推送并由 PR 合回 custom/main（或本地 merge 后）
git push -u origin HEAD
```

**到这里**：官方新版本已进入你的 `custom/main`，定制仍在，私有库与上游重新对齐。之后继续按第二节的 Issue → `/tdd` → PR 节奏做二次开发即可。

## 四、本地运行环境配置

确认本地运行环境（推荐：为本项目做隔离，别弄乱整机）


| 依赖             | 隔离方式（跟做推荐）                             | 作用                   |
| -------------- | -------------------------------------- | -------------------- |
| Node.js        | **nvm**（项目根放 `.nvmrc`）                 | 进目录用 22.19+ / 24     |
| pnpm           | **Corepack**                           | 钉死 `pnpm@11.7.0`     |
| API Key / 模型配置 | `~/.dsh/` 与仓库根 `.env`（gitignore）       | 密钥不进 Git             |
| 插件依赖           | `plugins/*/node_modules` 或 workspace 内 | 树外插件可单独 package.json |


> 本项目**不需要** MySQL / Redis / JDK。会话与设置落在 `$DSH_HOME`（默认 `~/.dsh`）。



#### 4.1 一次性装好「隔离工具」

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



#### 4.2 为本项目准备 Node（nvm）

```bash
nvm install 24.19.0
nvm use 24.19.0
echo "24.19.0" > .nvmrc
node -v
```



#### 4.3 为本项目准备密钥（不要提交）

Web UI：**设置 → 模型** → 填 DeepSeek API Key → 保存。

#### 4.4 跟做前自检

```bash
node -v
corepack enable
pnpm --version
git --version
```

在项目根：

```bash
pnpm install
pnpm run typecheck
```

