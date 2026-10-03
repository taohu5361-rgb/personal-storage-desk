# 合成测试夹具与辅助脚本

从仓库根目录运行以下命令。测试使用此项目声明的 `playwright` 与 `postcss`，不依赖开发者电脑上的私有运行时。

## 前端静态检查与浏览器测试

```powershell
npm ci
npx playwright install chromium
npm run test
npm run test:theme
npm run dev -- --host 127.0.0.1 --port 1420
```

保持开发服务器运行，在另一终端逐项执行：

```powershell
node scripts/test-asset-text-ui.mjs
node scripts/test-outer-text-ui.mjs
node scripts/test-axis-drag-ui.mjs
node scripts/test-canvas-transforms-ui.mjs
node scripts/test-canvas-background.mjs
node scripts/test-middle-pan.mjs
node scripts/test-minimap.mjs
node scripts/test-drawer-ui.mjs
node scripts/test-drawer-scale-ui.mjs
```

`verify-*.html`、`verify-*.jsx`、`drawer-qa.*` 是合成图片、资产和文字夹具；浏览器模式使用模拟 IPC 或隔离的浏览器存储。它们不包含真实用户材料。浏览器测试默认使用 Playwright 下载的 Chromium；也可设置 `$env:PLAYWRIGHT_CHANNEL = 'msedge'` 使用本机 Edge。默认服务器是 `http://127.0.0.1:1420`，其他地址设置 `QA_BASE_URL`。各脚本第二个命令行参数可指定结果目录，默认 `.test-output/<脚本名>`。部分历史脚本还支持 `ASSET_TEXT_REPORT_DIR`、`OUTER_TEXT_REPORT_DIR`、`CANVAS_TRANSFORM_REPORT_DIR` 或 `DRAWER_QA_URL` 等专用覆盖参数。

## Windows 原生测试（可选）

原生测试要求 Windows、WebView2、运行中的 Vite 开发服务器和 **debug** 桌面可执行文件。先在仓库根目录构建 `cargo build --manifest-path src-tauri/Cargo.toml --locked`（保持默认开发协议，不添加 `tauri/custom-protocol`）。保留内部可执行文件名 `script-collection.exe` 是兼容选择；对外发布文件名为“个人收纳台.exe”。设置了 `CARGO_TARGET_DIR` 时，构建、复制与测试脚本均从对应 target 根目录取 debug/release 程序。

这些测试只能启动带 `CREATIVE_CLOTH_TEST_DATA_DIR` 调试隔离分支的 debug 程序。该环境变量在 release 程序中无效，**不要用生产程序执行本节测试**。辅助脚本检查 debug 程序中的隔离标记；连接 CDP 后先确认数据库位于本次合成测试目录，再执行验收动作。此检查用于避免误操作，不能作为脚本沙箱或安全加固声明。

`test-open-source-native.mjs` 是可独立运行的完整验收：每次在指定输出目录下新建 `run-<时间戳>` 合成数据目录，验证首次空启动和名称、任意扩展名的托管/引用导入及文件 SHA-256、标准与内画布共享文字/独立布局、外画布保存、关闭时草稿写入和真实进程重启恢复。它不需要 Python 或真实材料，使用专用 CDP 端口 9468。运行示例：

```powershell
node scripts/test-open-source-native.mjs .test-output/open-source-native
```

结果为每次运行目录内的 `result.json` 和合成场景截图，输出根目录的 `latest-result.json` 指向最近成功结果。可通过 `QA_BASE_URL` 指定调试程序编译时实际配置的开发地址（需与 `devUrl` 一致）。此脚本直接检查当前开发地址，不要求固定的 1420 端口；生产程序仍不能用于此测试。

```powershell
node scripts/test-canvas-background-native.mjs .test-output/native-background
node scripts/test-inner-background-native.mjs .test-output/native-inner
node scripts/test-middle-pan-native.mjs .test-output/native-pan
node scripts/test-minimap-native.mjs .test-output/native-minimap
node scripts/test-axis-drag-native.mjs .test-output/native-axis
node scripts/test-canvas-transforms-native.mjs .test-output/native-transforms
node scripts/test-drawer-scale-native.mjs .test-output/native-drawer-scale
node scripts/test-exit-lifecycle-native.mjs .test-output/native-exit
node scripts/test-asset-text-native.mjs .test-output/native-asset-text --launch
node scripts/test-outer-text-native.mjs .test-output/native-outer-text --launch
```

一次只运行一个原生测试；部分脚本共用 CDP 端口。使用新建的专用目录，避免旧合成记录影响测试。默认结果与测试 SQLite/WebView 缓存保存在 `.test-output` 内，不应提交。`CREATIVE_CLOTH_TEST_DATA_DIR` 可显式覆盖隔离目录；需保持所有连接/重启步骤一致。两个文字脚本的 `--restart` 分支仅用于与其首次启动相同的数据目录、CDP 端口和合成记录，重启后的程序仍必须是 debug。

`test-drawer-native.mjs` 是旧夹具的连接式验收：不会自行启动程序或创建旧版数据库。需手工准备隔离 debug 数据及四张合成抽屉记录，在对应 WebView 打开 `/scripts/drawer-qa.html?native=1` 后，以同一隔离目录运行 `node scripts/test-drawer-native.mjs <隔离目录> exercise`（第二阶段为 `reopened`）。CDP 默认端口为 9237，可用 `DRAWER_NATIVE_CDP` 覆盖。这一历史测试不能单独复现完整迁移过程；较新的 `test-drawer-scale-native.mjs` 自行准备旧表进行迁移验收。

## Python 辅助环境（可选）

部分原生测试通过 Python 标准库 `sqlite3` 构造锁竞争/旧表，或通过 Pillow 生成合成 PNG；`native-window-state.py` 使用 Windows ctypes 检查窗口/托盘状态。前端构建和 Node 单元测试不需要 Python。

```powershell
python -m pip install Pillow
# Python 不在 PATH 时，设置实际可执行文件：
$env:PYTHON_RUNTIME = '<Python executable path>'
```

原生脚本使用 `PYTHON_RUNTIME`，未设置则调用 PATH 中的 `python`。Python 和 Pillow 不随本应用分发。

## 发布文件复制

`npm run build:exe` 先调用 `build-desktop.mjs`，再调用 `copy-tauri-exe.mjs`，复制当前 Windows 主机的 release 内部程序为 `release/个人收纳台.exe`。输出目录为本地构建产物，不属于开源源码。复制脚本仅复制，不启动程序。

构建封装从脚本位置确定仓库根目录，通过项目内安装的 Tauri CLI 执行 `build --no-bundle`。它根据当前仓库路径、Cargo 用户目录（`CARGO_HOME` 或默认 `.cargo`）和系统用户目录添加 Rust `--remap-path-prefix`，以 `/project`、`/cargo`、`/user` 等通用前缀代替编译器输出中的本机源码路径。路径通过 `CARGO_ENCODED_RUSTFLAGS` 传递，含空格的路径不会被拆成多个参数。已存在的 encoded flags 保留；普通 `RUSTFLAGS` 只支持按空白分隔的简单参数，需要引号或内部空格的复杂参数请使用 encoded 形式。

该封装直接转发传给它的 CLI 参数；需要明确禁止 Cargo 更新锁文件时使用：

```powershell
node scripts/build-desktop.mjs -- --locked
node scripts/copy-tauri-exe.mjs
```

Tauri 的参数位于分隔符 `--` 前，Cargo 的参数位于其后。不要使用 `npm run build:exe -- <额外参数>` 传递构建选项：该 npm 命令包含两条 `&&` 串联命令，末尾附加参数会交给复制脚本。`CARGO_HOME` 和 `CARGO_TARGET_DIR` 建议设置为绝对路径；复制脚本只处理默认主机 release 输出，不负责自定义 target 三元组或 debug 产物的复制。

路径重映射属于编译器层面的尽力规范化，不承诺全部产物逐字节可复现，也不能替代发布文件检查。Rust 官方指出它按文本前缀匹配，Windows 混用 `/` 与 `\`、链接器写入的 PDB 路径以及外部工具生成内容都可能需要额外检查。参见 [Rust 源码路径重映射说明](https://doc.rust-lang.org/rustc/remap-source-paths.html)。
