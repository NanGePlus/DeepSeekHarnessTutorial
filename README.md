# 零基础上手 DeepSeek Harness：从安装到插件交付的全链路实战

## 本系列视频定位

本系列按 **安装上手 → 核心认知 → 源码部署 → 插件交付 → AI 辅助开发 → 可观测链路** 串起一条可走完的路径：

**安装上手** 通过 npx 一键安装 DeepSeek Harness，演示页面功能与社区插件安装（`01_一键安装与功能演示`）；

**核心认知** 系统介绍 DeepSeek Harness 的基础概念、核心架构、运行模式与可观测性概览（`02_基础概念与核心架构`）；

**源码部署** 从源码方式安装与运行 DeepSeek Harness，适合需要定制或插件开发的场景（`03_源码方式安装`）；

**插件交付** 以 `hello-tool` 树外插件为例，演示 `--patch` 开发迭代与 4 种正式交付方式（`04_插件交付4种方式`）；

**AI 辅助开发** 结合 AI 编程助手，在插件开发基线上完成插件定制开发与长期维护（`05_AI编程辅助插件开发`）；

**可观测链路** 接入 Trace / Metrics，看清 Agent 会话中模型、工具与 Token 的耗时与成本（`06_可观测链路跟踪`）。

### 仓库目录速览


| 目录              | 说明                                  |
| --------------- | ----------------------------------- |
| `01_一键安装与功能演示`  | npx 一键安装、页面功能演示、社区插件安装              |
| `02_基础概念与核心架构`  | 基础概念、Cordis 架构、运行模式、事件驱动与可观测性概览     |
| `03_源码方式安装`     | 源码克隆、pnpm 构建与本地运行                   |
| `04_插件交付4种方式`   | hello-tool 树外插件；`--patch` 与 4 种交付路径 |
| `05_AI编程辅助插件开发` | AI 编程协作工作流；插件定制开发全流程实践指南            |
| `06_可观测链路跟踪`    | OpenTelemetry 链路追踪、用量分析与审计面板接入      |




### 本系列仓库位置

以下仓库存储我在 YouTube 和 B 站频道关于「零基础上手 DeepSeek Harness 实战」相关分享的全部源文件，均开源免费。

- GitHub 地址: [https://github.com/NanGePlus/DeepSeekHarnessTutorial](https://github.com/NanGePlus/DeepSeekHarnessTutorial)
- Gitee 地址: [https://gitee.com/NanGePlus/DeepSeekHarnessTutorial](https://gitee.com/NanGePlus/DeepSeekHarnessTutorial)



### 我的个人信息

- YouTube 频道(@南哥AGI研习社)：[https://www.youtube.com/channel/UChKJGiX5ddrIpJG-rBNVZ5g](https://www.youtube.com/channel/UChKJGiX5ddrIpJG-rBNVZ5g)
- B站频道(@南哥AGI研习社)：[https://space.bilibili.com/509246474](https://space.bilibili.com/509246474)
- GitHub 地址：[https://github.com/NanGePlus](https://github.com/NanGePlus)
- Gitee 地址：[https://gitee.com/NanGePlus](https://gitee.com/NanGePlus)



### 其他开源分享推荐

- **零基础上手 LangChain V1.x 实战： 学最主流 Agent 开发框架**：  
B站视频链接：[https://www.bilibili.com/video/BV17c6mBbEHv/](https://www.bilibili.com/video/BV17c6mBbEHv/)  
YouTube 视频链接：[https://www.youtube.com/playlist?list=PL8zBXedQ0ufld2C7nB28fGw9U6nTbagp1](https://www.youtube.com/playlist?list=PL8zBXedQ0ufld2C7nB28fGw9U6nTbagp1)  
GitHub 地址：[https://github.com/NanGePlus/LangChain_V1_Test](https://github.com/NanGePlus/LangChain_V1_Test)  
Gitee 地址：[https://gitee.com/NanGePlus/LangChain_V1_Test](https://gitee.com/NanGePlus/LangChain_V1_Test)       
- **零基础上手 n8n v2.x 实战：打造 n8n 驱动的自动化生产线**：  
B站视频链接：[https://www.bilibili.com/video/BV1Aq1NBYELp/](https://www.bilibili.com/video/BV1Aq1NBYELp/)  
YouTube 视频链接：[https://www.youtube.com/playlist?list=PL8zBXedQ0uflhkZBwlQNAp7H57CJFgfgV](https://www.youtube.com/playlist?list=PL8zBXedQ0uflhkZBwlQNAp7H57CJFgfgV)  
GitHub 地址：[https://github.com/NanGePlus/N8NWorkflowsTest](https://github.com/NanGePlus/N8NWorkflowsTest)  
Gitee 地址：[https://gitee.com/NanGePlus/N8NWorkflowsTest](https://gitee.com/NanGePlus/N8NWorkflowsTest)        
- **零基础上手OpenClaw系列：从零打造智能体驱动的商业自动化闭环**  
B站视频链接：[https://www.bilibili.com/video/BV1svQGBBERQ/](https://www.bilibili.com/video/BV1svQGBBERQ/)  
YouTube视频链接：[https://www.youtube.com/playlist?list=PL8zBXedQ0ufmtUvaHsSxNqZMwgb3hxsJB](https://www.youtube.com/playlist?list=PL8zBXedQ0ufmtUvaHsSxNqZMwgb3hxsJB)  
GitHub地址：[https://github.com/NanGePlus/OpenClawTutorial](https://github.com/NanGePlus/OpenClawTutorial)  
Gitee地址：[https://gitee.com/NanGePlus/OpenClawTutorial](https://gitee.com/NanGePlus/OpenClawTutorial)                  
- **2026 AI 编程 Cursor：专为提升开发生产力而设计的一款 AI 提效工具**：  
B站视频链接：[https://www.bilibili.com/video/BV1HEABzvEdo/](https://www.bilibili.com/video/BV1HEABzvEdo/)  
YouTube 视频链接：[https://www.youtube.com/playlist?list=PL8zBXedQ0ufkcPJWHVKFTFzS8yNCkfM5b](https://www.youtube.com/playlist?list=PL8zBXedQ0ufkcPJWHVKFTFzS8yNCkfM5b)       
- **更多开源项目**  
GitHub 地址：[https://github.com/NanGePlus](https://github.com/NanGePlus)  
Gitee 地址：[https://gitee.com/NanGePlus](https://gitee.com/NanGePlus)

---



## 本系列视频链接地址速查

敬请期待……

---



## 适合的小伙伴

- 希望 **快速上手 DeepSeek Harness**，从 npx 一键安装到页面功能、社区插件都有直观感受的开发者。
- 需要 **理解 Harness 的核心架构与运行模式**，以便后续做定制或插件开发。
- 愿意 **亲手完成树外插件从开发到 4 种方式交付**，并探索 AI 编程助手如何加速这一过程。
- 关注 **Agent 会话的可观测性**，希望接入 Trace、用量分析与审计能力。

---



## 学习建议

1. **顺序尽量不打乱**：建议按 `01 → 02 → 03 → 04 → 05 → 06` 学。`01` 建立直观感受；`02` 补全概念；`03` 掌握源码部署；`04` 跑通插件开发与 4 种交付闭环；`05` 在已有基础上用 AI 提效并完成定制插件；`06` 接入可观测能力。
2. **先跑通再深入**：先把 npx 安装和页面功能跑通，再进入架构与源码；插件实战前确保对 Harness 运行模式有基本理解。
3. **密钥与合规**：涉及 API Key、模型调用、npm publish token 等配置时，不要把密钥写进仓库或提交到版本控制；使用环境变量或本地配置文件管理。
4. **把排错沉淀成资产**：安装、构建、插件调试过程中的问题，记录「现象 → 日志/错误码 → 根因 → 修复步骤」，便于后续复现与分享。

