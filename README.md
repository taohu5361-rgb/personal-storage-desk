# 个人收纳台

<img src="src-tauri/icons/128x128.png" alt="个人收纳台图标" width="96" height="96">

**公开开发版：v0.1.0-alpha.2（Pre-release）**

[下载 Windows EXE、程序包及查看版本说明](https://github.com/taohu5361-rgb/personal-storage-desk/releases/tag/v0.1.0-alpha.2) · [直接下载 Windows x64 EXE](https://github.com/taohu5361-rgb/personal-storage-desk/releases/download/v0.1.0-alpha.2/personal-storage-desk-v0.1.0-alpha.2-windows-x64.exe) · [所有版本](https://github.com/taohu5361-rgb/personal-storage-desk/releases)

点击 EXE 链接即可下载并运行；需要 WebView2 Runtime。完整 Windows 程序包 ZIP 附带第三方许可材料，源码 ZIP 与 SHA-256 校验文件也在版本页。程序仍处于早期开发，使用前请备份数据。

一个正在早期开发的 Windows 本地文件与创作材料可视化组织工作空间。把材料放进分类，在画布上排列文件卡片、文字和视觉分组，再进入资产详情整理样图、提示词与案例备注。

项目采用 React、Vite、Tauri 2 与 SQLite。它没有内置 AI 推理、生图引擎、模型解析，也不会自动读取 ComfyUI 参数。界面沿用的“模型”指工作空间容器（Workspace），可以用来整理任意主题的材料。

## 当前可以做什么

- 按 **工作空间（界面中的“模型”）→ 分类 → 资产** 组织材料。原文件可以是任意格式，并可单独选择封面；应用能够预览的格式受当前图片解码与界面实现限制。
- 通过托管模式保存原文件副本，或通过引用模式记录本机源文件路径。
- 在分类外画布中自由移动资产；可用连续坐标拖动、单图中心参考轴吸附、分组和小地图导航，并保存布局与视口。
- 在资产详情的标准视图与内画布之间切换。资产自由文字共享内容与样式，按视图分别保存布局；样图、提示词与案例备注引用同一份记录。
- 使用可浮动、停靠和收纳的备注卡片；备注可以吸附到其他资产，也可以作为独立备注。删除资产会保留其备注。资产内与外画布各有小地图；内画布背景可按资产单独设置。
- 在本机 SQLite 中保存记录，检查缺失引用，并通过设置中的数据库备份与恢复操作保存或恢复记录。

首页提供“排列模式”和“画布模式”两个入口。排列模式当前仍对应原有脚本模块，只有分类、登记与启动等实验骨架，主要功能尚未开展；脚本启动调用本机已有环境，应用不内置解释器，也不提供脚本沙箱。画布模式进入现有资产与画布模块。首页名称调整没有合并两套底层数据结构。

按单图中心十字轴排列和吸附已支持；多对象自动排列、等距和多选吸附仍属后续规划。

## 首次使用

新的数据目录会从空状态开始，不附带私人数据库、素材或示例材料。从首页进入画布模式后，可建立内容容器、分类并导入材料。

托管模式会复制文件，占用额外空间；引用模式保留原文件位置，移动或删除源文件后引用可能失效。改变托管目录设置不会自动迁移已有文件。数据库备份只包含记录与路径，**不包含原文件、样图或字体文件**，不能单独作为完整材料备份。使用前请阅读[数据与备份](docs/data-and-backup.md)。

## 开发与构建

主要验证平台为 Windows。桌面开发需要 Node.js 24、Rust MSVC 工具链、Visual Studio C++ Build Tools 与 Windows SDK，以及 WebView2 Runtime。依赖声明的最低 Rust 要求为 1.88，实际构建验证使用 Rust 1.98.1；工具版本与验证边界见[开发说明](docs/development.md)及版本发布说明。

```powershell
npm ci
npm run dev
```

上述命令只运行前端浏览器预览；原生文件对话框、SQLite、系统窗口及脚本启动依赖 Tauri 后端，浏览器预览不等同于完整桌面程序。

```powershell
npm run desktop
npm run build
npm run build:exe
```

`build` 生成前端静态文件；`build:exe` 构建 Windows release 可执行程序，并将程序复制到 `release/个人收纳台.exe`。该程序仍依赖系统的 WebView2 等运行条件，并非自带全部运行环境。

详见[开发说明](docs/development.md)、[项目结构](docs/architecture.md)和[已知限制](docs/limitations.md)。测试与运行数据不要提交到仓库。

## 数据身份与权限

为了兼容历史数据，内部 Cargo crate、Tauri identifier `local.script.collection`、数据库文件名 `script-collection.sqlite3` 和 legacy keys 保留原值。显示名称改为“个人收纳台”不会创建新的数据身份；同一 Windows 用户下的历史程序可能与此程序使用同一份应用数据。请先备份，再使用测试隔离方式验证。

当前配置保留较宽的本地资源访问范围：CSP 为 `null`、asset protocol 范围为 `**`，并启用开发工具功能。这些设置支持现有文件、图片与字体读取，但不是安全加固声明。只运行你信任的脚本与材料，不把应用当作隔离环境。

## 贡献与许可证

欢迎提交可复现的问题与范围清晰的改进，参见[贡献说明](CONTRIBUTING.md)。这是早期开发项目，功能与数据结构仍可能变化。

项目原创代码和新图标按 [MIT License](LICENSE) 发布，Copyright © 2026 Plume。第三方依赖采用各自许可证，包含 MIT 以外的许可；其声明、原文与源码获取方式见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [许可证材料](third_party/)。MIT 原文依据 [Open Source Initiative 的许可证文本](https://opensource.org/license/mit)。
