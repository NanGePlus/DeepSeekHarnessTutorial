# 06 创造模式插件开发

本章用 **创造模式** 会话和自然语言，在工作区里做出一个 **标准 Cordis 树外插件**。插件本身与端无关：装到哪个 **profile**，就在哪个运行形态里生效——**Desktop、Web、源码、headless** 等共用同一套插件规范，只是**Desktop/Web等 profile 的装配清单相互独立**，需要在各自 profile 里安装。

---

## 开始前

任选 **一种** 你平时用的 Harness **图形客户端**（界面一致，创造模式入口相同）：

| 客户端      | 常见启动方式                               | 对应 profile（概念上） |
| -------- | ------------------------------------ | --------------- |
| Desktop  | 安装后打开                                | `desktop`       |
| Web（npm） | `npx @deepseek-ai/dsh web`，浏览器打开提示地址 | `web`           |
| Web（源码）  | 按 03_源码方式安装 后 `pnpm dsh web`         | `web`           |

在 **当前客户端** 内完成：

1. **设置 → 模型**：填好 API Key。
2. **选择工作区**：指向项目根（插件将落在工作区 `plugins/` 等目录）。
3. **新建会话**：Agent 预设 **创造模式**；权限 **工作区内修改** 或 **完全权限**（写文件、安装插件时需要）。

## 第 1 步：一次说清并完成插件

把下面整段发给创造模式会话（可按你的需求改文案）。Agent 应自行做运行时检查、在工作区生成插件、安装到 **当前 profile**，并说明如何验收：

```
我想在当前工作区做一个最小的 Harness 插件 demo，做成标准树外插件，以后也能装到 web、desktop 等 profile。

插件目录：plugins/dsh-hello

功能（必做）：
1. 给模型增加一个叫 hello 的工具。
2. 可选参数 name，返回一句问候。
3. 回复里带上插件名字。

验收：
- 在当前客户端新开标准模式会话，我说「请调用 hello，name 填 南哥AGI研习社」，要能收到带插件名字的回复。

请先简要说明实现与安装方式，再生成代码并安装到当前 profile；需要我授权时在界面批准。完成后告诉我创建了哪些文件、要不要重启客户端或新开会话，以及一句验收话术。
```

若 Agent 请求授权（改 profile、安装插件），在当前客户端里按提示批准。

## 第 2 步：验收

按 Agent 说明 **重启或新建标准模式会话**，发送它给的验收话术，或：

```
请调用 hello 工具，name 填 南哥AGI研习社
```

返回里能看出插件标识（如 `dsh-hello`）即表示 **在当前 profile / 当前端** 已生效。可在 **设置 → 插件** 查看状态。

## 第 3 步：失败时只修当前问题

```
插件还没在当前端验收通过。现象是：（粘贴报错、Agent 回复或插件列表状态）

请只解决这一个现象，不要加新功能。修完后告诉我：改了什么、要不要重启客户端、验收话术是否不变。
```

## 第 4 步：打包发布

当前 profile 验收通过后，三选一交付。示例目录为 `plugins/dsh-hello`，包名为 `@nangeagi/dsh-hello`，版本 `0.0.1`。

命令前缀：Web（npm）用 `npx @deepseek-ai/dsh`，源码仓用 `pnpm dsh`。`--profile`：Web 为 `web`，Desktop 为 `desktop`。

对方能运行 `dsh` 即可。装完重启对应客户端，用第 2 步的验收话术验证。卸载：

```sh
npx @deepseek-ai/dsh plugin --profile web remove @nangeagi/dsh-hello
```

### tarball

在创造模式发送：

```
dsh-hello 已在当前 profile 验收通过。请直接打成 tarball，使它可被 dsh plugin add 安装，不要加功能。

插件目录：plugins/dsh-hello

package.json（必做）：
1. name 写为 @nangeagi/dsh-hello，version 写为 0.0.1。
2. private 保持 true。
3. dsh.bundle.patch 指向 ./cordis.patch.yml。
4. files 包含构建产物和 cordis.patch.yml；有页面时含 Client 产物。
5. peerDependencies 改为 semver，去掉 workspace:^。

cordis.patch.yml（必做）：
1. 入口指向 lib 里的 js，不指向 src/。

打包（必做）：
1. 在插件目录执行 build，确认产物存在。
2. 包内不含密钥和 .npmrc。
3. 在插件目录执行 npm pack，生成 tarball。

验收：
- 告诉我包名、版本，以及 tarball 的实际路径和文件名。

请直接改文件、build，并执行 npm pack。
```

Agent 会在插件目录生成 tarball。接着在本机复验：

```sh
npx @deepseek-ai/dsh plugin --profile web remove @nangeagi/dsh-hello
npx @deepseek-ai/dsh plugin --profile web add ./plugins/dsh-hello/nangeagi-dsh-hello-0.0.1.tgz
```

重启当前端，新建标准模式会话，再发第 2 步的验收话术。**设置 → 插件** 为已启用即通过。

要装到另一个端，把 `--profile` 换成 `desktop`（或 `headless`），add 同一个 tarball，只启动那个端再验一次。

`npm pack` 会生成 `nangeagi-dsh-hello-0.0.1.tgz`。把这个文件发给对方，在文件所在目录执行：

```sh
npx @deepseek-ai/dsh plugin --profile web add ./nangeagi-dsh-hello-0.0.1.tgz
```

### npm

在创造模式发送：

```
dsh-hello 已在当前 profile 验收通过。请只做 npm 发布准备，把它改成可用包名 dsh plugin add 安装的包，不要加功能。

插件目录：plugins/dsh-hello

package.json（必做）：
1. name 写为 @nangeagi/dsh-hello，并用 npm view 确认未被占用。
2. version：未发布过用 0.0.1，已发布则递增。
3. private 改为 false。
4. dsh.bundle.patch 指向 ./cordis.patch.yml。
5. files 包含构建产物和 cordis.patch.yml；有页面时含 Client 产物。
6. peerDependencies 改为 semver，去掉 workspace:^。

cordis.patch.yml（必做）：
1. 入口指向 lib 里的 js，不指向 src/。

构建（必做）：
1. 执行 build，确认产物存在。
2. 包内不含密钥，不要把 npm token 写进仓库。

验收：
- 告诉我最终包名、版本，以及对方的安装命令。

请直接改文件并 build。不要执行 npm publish。
```

Agent 改完后，在 [npmjs.com](https://www.npmjs.com) 生成 Publish 权限的 Access Token，写入用户主目录的 `~/.npmrc`（macOS 即 `/Users/你的用户名/.npmrc`）。不要放在插件目录里，也不要提交到 git。在插件目录执行 `npm publish` 时会自动读到这份配置：

```
//registry.npmjs.org/:_authToken=你的token
```

```sh
cd plugins/dsh-hello
npm publish --access public
```

对方安装：

```sh
npx @deepseek-ai/dsh plugin --profile web add @nangeagi/dsh-hello
```

### GitHub

在创造模式发送：

```
dsh-hello 已在当前 profile 验收通过。请只做 GitHub 发布准备，把它改成可用 github:用户名/仓库 安装的包，不要加功能。

插件目录：plugins/dsh-hello

package.json（必做）：
1. name 写为 @nangeagi/dsh-hello，version 写为 0.0.1。
2. private 保持 true。
3. dsh.bundle.patch 指向 ./cordis.patch.yml。
4. files 包含构建产物和 cordis.patch.yml；有页面时含 Client 产物。
5. peerDependencies 改为 semver，去掉 workspace:^。

cordis.patch.yml（必做）：
1. 入口指向 lib 里的 js，不指向 src/。

构建（必做）：
1. 执行 build，确认产物存在。
2. 包内不含密钥和 .npmrc。

仓库（必做）：
1. 列出仓库根目录要提交的文件：package.json、cordis.patch.yml、已构建的 lib/；有页面时含 Client 产物。
2. 不要包含密钥，也不要把整个工作区或 Harness 仓推上去。

验收：
- 告诉我文件清单，以及对方的安装命令。

请直接改文件并 build。不要执行 git push，也不要 npm publish。
```

Agent 改完后，在 GitHub 新建空仓库（例如 `dsh-hello`），根目录放入上面的文件并推送，或自然语言：

```sh
将该插件 dsh-hello 进行推送：git@github.com:NanGePlus/dsh-hello.git
```

对方安装：

```sh
npx @deepseek-ai/dsh plugin --profile web add github:你的用户名/dsh-hello
```

---

**进阶示例**（可视化小工具）：[抽签](./实现抽签.md) · [番茄钟](./实现番茄钟.md) · [今日一句](./实现今日一句.md) · [配色灵感](./实现配色灵感.md) · [片段库](./实现快捷片段库.md) · [开售提醒](./实现明星周边情报雷达.md)
