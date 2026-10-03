# 开发说明

## 工具与环境

以 Windows 为主要开发与验证平台。基准环境为 Node.js 24.16.0、npm 和 Rust 1.98.1 MSVC 工具链；根据锁定依赖的 manifest，Rust 最低版本声明为 1.88；本次实际构建使用 1.98.1，未使用 1.88 编译验证。安装 Visual Studio C++ Build Tools、Windows SDK 和 WebView2 Runtime。其他系统尚未完成同等验证，不能据此假定跨平台功能完整。

JavaScript 直接依赖按交付锁文件版本固定；使用 `npm ci`，不要为了安装方便删除锁文件或把依赖改回 `latest`。Rust 保留 Cargo.lock，使用 `--locked`。默认使用标准公共包源；若网络环境需要国内镜像，可在自己的 Cargo 用户配置中添加替换规则，并保留标准源的回退方式，不把个人镜像配置提交为项目默认。

## 启动与构建

在仓库根目录执行：

```powershell
npm ci
npm run dev
```

这是前端预览。完整桌面开发使用：

```powershell
npm run desktop
```

桌面数据通常写入 Tauri 应用数据目录。独立测试时，先设置一个空的绝对路径，再运行 debug 桌面版本，例如：

```powershell
$env:CREATIVE_CLOTH_TEST_DATA_DIR = Join-Path $env:TEMP ('personal-desk-test-' + [guid]::NewGuid())
npm run desktop
```

`CREATIVE_CLOTH_TEST_DATA_DIR` 只在 Rust `debug_assertions` 构建中生效。release 程序忽略该变量，仍采用 `local.script.collection` 对应的数据目录。不要直接启动 release 程序来验证数据隔离，尤其是同账户已有历史数据时。

构建命令：

```powershell
npm run build
npm run build:exe
```

Windows release 输出复制到 `release/个人收纳台.exe`。Cargo 内部二进制名称仍为 `script-collection`。需要把构建缓存放在仓库外时，可以自行设置 `CARGO_TARGET_DIR`；这不会改变应用的数据目录。

`build:exe` 通过 `scripts/build-desktop.mjs` 调用项目内的 Tauri CLI。封装根据本次仓库、Cargo 用户目录和系统用户目录派生源码路径重映射，使用通用的 `/project`、`/cargo`、`/user` 前缀，减少 release 程序中编译器嵌入的本机开发路径。它使用 `CARGO_ENCODED_RUSTFLAGS` 保留含空格的路径和已有 encoded 参数；普通 `RUSTFLAGS` 仅支持简单的空白分隔参数。复杂参数应显式使用 encoded 形式，`CARGO_HOME` 与 `CARGO_TARGET_DIR` 建议使用绝对路径。

封装直接转发 CLI 参数。要明确约束 Cargo 使用锁文件，执行：

```powershell
node scripts/build-desktop.mjs -- --locked
node scripts/copy-tauri-exe.mjs
```

额外 Tauri 参数放在 `--` 前，Cargo 参数放在其后。当前 `npm run build:exe` 包含构建与复制两条串联命令，`npm run build:exe -- <参数>` 会把末尾参数附加给复制脚本；有额外构建参数时直接调用封装。复制脚本仅适用于当前 Windows 主机的默认 release 目录，自定义 target 或 debug 构建应按其实际输出目录另行取得程序。

路径重映射不等于所有编译产物逐字节相同。它是文本前缀替换；Windows 路径分隔符变体、MSVC 链接器生成的 PDB 路径、外部工具写入的字符串仍可能保留本机信息。发布前应检查最终待交付的 exe，排除本机构建缓存及调试文件，并记录实测结果。详见 [Rust 官方路径重映射说明](https://doc.rust-lang.org/rustc/remap-source-paths.html)。

## 验证

```powershell
npm test
npm run test:theme
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
npm run build
```

`npm test` 使用 Node.js 原生测试运行器；主题检查直接使用已声明的 PostCSS。交互测试使用项目中明确声明的 Playwright，需要先安装浏览器：

```powershell
npx playwright install chromium
```

`scripts/verify-*.html` 与相关 JSX 文件提供合成浏览器夹具。UI 脚本中的测试地址、输出目录和原生连接参数依各脚本配置；运行前检查脚本开头，先启动对应 Vite 服务。带 `native` 的脚本需要运行隔离 debug 桌面版本，并配置 WebView 调试连接；它们不是一次性执行所有桌面场景的通用验收命令。涉及窗口辅助操作的 Python 脚本是可选测试工具，需要本机 Python 与脚本列出的依赖。

至少验证首次空启动、托管与引用导入、文字编辑、视图切换、保存后关闭重启，以及窗口与托盘图标。使用新建合成文件；不读取真实用户数据库或素材。测试通过只支持对应版本与场景的结论，不能推导全部桌面输入法、触摸与跨平台行为都已验证。

## 发布前检查

检查源码是否包含所有 SQL 迁移、运行时引用与图标，检查第三方许可材料和锁文件是否一致。检查待公开清单是否包含数据库、文件路径、私人素材、密钥、浏览器缓存或测试输出。生产二进制构建成功与隔离 debug 实际运行验收应分开记录。

## 可选的 Cargo 镜像

标准源为默认。网络需要时，可仅在本次命令中指定镜像，不修改仓库配置：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked --config 'source.crates-io.replace-with="rsproxy-sparse"' --config 'source.rsproxy-sparse.registry="sparse+https://rsproxy.cn/index/"'
```

这只改变锁定包的获取位置，继续保留 Cargo.lock 与校验；能否在线取得标准源或镜像依赖取决于本机网络。
