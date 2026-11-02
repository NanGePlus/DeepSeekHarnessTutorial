# DeepSeek **Super-agent** 原型项目部署、配置和测试

## 一、你需要提前准备什么

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

### 1.4 安装 nvm 与 pnpm

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

## 二、克隆 dsh-superagent-prototype

### 2.1 新建目录并克隆

```bash
mkdir dsh-superagent-prototype
cd dsh-superagent-prototype
cursor .
```

```bash
cd dsh-superagent-prototype

git clone https://github.com/deepseek-ai/dsh-superagent-prototype.git .

git branch
git remote -v
```

**说明**：

- 克隆下来的就是本章要部署的原型，目录名 `dsh-superagent-prototype`
- 远程 `origin` 指向 `https://github.com/deepseek-ai/dsh-superagent-prototype.git`

克隆完成后，项目根目录应能看到 `package.json`、`SETUP.md`、`docs/`、`scripts/`。

### 2.2 为本仓库准备 Node

```bash
nvm install 24.19.0
nvm use 24.19.0
echo "24.19.0" > .nvmrc
node -v
```

### 2.3 安装依赖

在原型仓库根目录：

```bash
nvm use
corepack enable
pnpm --version
```

## 三、用 Cursor 部署

在原型仓库根目录，把下面整段发给 Cursor。它只负责装好并启动，不填写仓库、账号、飞书、允许名单或执行目录。

```
请按 dsh-superagent-prototype 的 SETUP.md 部署。
所以配置项，安装部署完成后我统一在页面中进行配置。
```

## 四、确认已经部署好

浏览器打开 **http://127.0.0.1:3082**，侧边栏能进入 **Superagent**，即部署完成。

进程在跑，来源和账号还没填。这些在面板里进行具体配置。
