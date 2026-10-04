# 备注更换附属资产验收

备注标题显示附属资产名；点击可搜索当前分类资产，或选择“无（独立备注）”。从旧资产拖到新资产有效边并松手时，同时提交归属与吸附布局；仅拖到空白处保留原归属。

## 数据边界

- `asset_note_drawers.category_id` 固定记录所在分类，`asset_id` 可为空；独立备注只能使用 `floating`。
- 按分类读取包含独立备注，原按资产读取接口继续保留。
- 新归属通过 `transfer_asset_note_drawer` 校验预期旧归属、分类、锁定、数量和边布局，并在事务中写入。
- 同一备注的文字、布局及归属操作共享串行保存队列；响应和失败回滚必须比较归属、分类与布局，保留较新的正文。
- 每个资产最多三个备注，独立备注不占资产名额；资产改名即时更新标题，跨分类移动同步更新附属备注分类。
- 删除单资产前在同一事务中记录备注世界位置并解除归属；旋转资产使用包含标题区的旋转中心。删除整个模型沿用删除其分类及内容的行为。
- 旧表迁移前自动用 `VACUUM INTO` 生成包含 WAL 内容的完整备份，文件名包含 `before-note-attachment`。旧正文、ID、尺寸、缩放、状态、位置及创建时间保留。

## 自动验收

```powershell
node --test src/components/DrawerDragController.test.js src/components/DrawerLayoutEngine.test.js src/components/DrawerSaveState.test.js
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
npm run test:theme
```

浏览器 fixture 仅模拟 IPC，使用独立 localStorage；`scripts/test-drawer-attachment-ui.mjs <输出目录>` 覆盖标题搜索、键盘、编辑中转移、独立备注、空画布、真实鼠标跨图、取消、四边、旋转、满额、锁定及失败/延迟保存。

完整桌面端迁移验收需要额外的隔离 SQLite、WebView 环境和 debug EXE；本发行仓库不包含那套本机专用启动脚本。这里列出的 Rust 测试覆盖合成 SQLite 数据库中的迁移、归属和删除行为，浏览器 fixture 模拟 IPC，不代表已完成真实桌面 WebView 与用户数据库的启动验收。

原有 `test-drawer-ui.mjs` 和 `test-drawer-scale-ui.mjs` 使用拖拽点/正文选择，避免把新的标题选择器当作旧拖动区。其他画布 fixtures 同时接受按分类和按资产读取接口。

发布版的测试目录开关不生效；发布启动验收必须在旧程序正常退出后执行，先保留完整数据库备份，只读取并比较迁移前后记录，禁止向用户库写入测试资产或测试备注。
