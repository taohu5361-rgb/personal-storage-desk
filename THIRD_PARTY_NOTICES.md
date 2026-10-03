# 第三方软件声明

个人收纳台自身代码和新图标使用 MIT（2026 Plume）；第三方组件保留各自许可证，不能统称为 MIT。

## 范围和版本

本清单覆盖 `package-lock.json` 与 `src-tauri/Cargo.lock` 的锁定注册表依赖，包含开发工具、测试工具和跨平台可选依赖。它比 Windows 成品实际包含的组件更广。还保留 Lightning CSS 1.33.0 官方源码 `Cargo.lock` 的组件声明，涵盖其预编译 npm 模块的上游依赖；该上游清单同样包括可选和开发依赖，并非实际二进制链接清单。

机器可读版本是 [dependency-licenses.json](third_party/dependency-licenses.json) 和 [lightningcss-embedded-licenses.json](third_party/lightningcss-embedded-licenses.json)。版权、许可证和 NOTICE 原文位于 `third_party/licenses/`；未随 crate 发布的许可证按原包 `.cargo_vcs_info.json` 记录的上游提交取得，来源保留在对应 `PROVENANCE.md` 或清单 `notice_provenance`。`MIT/Apache-2.0` 等历史写法按上游原文保留；`OR` 表示可选许可，`AND` 表示累计义务。本交付保留包内提供的多份许可文本，不把选择性许可误写为必须同时适用。

部分上游原包只提供 manifest 许可标识、没有独立 LICENSE。对这类组件保留原始 manifest 并补充标准许可正文，具体来源及局限记录在对应 PROVENANCE.md；未虚构缺失的版权年份。difflib 的补充原文来自上游较新不可变提交，已明确标注。

依赖代码未作项目级修改。开发/测试工具（包括 Playwright、Tauri CLI、Vite 和 Lightning CSS）用于构建或测试，不等同于最终桌面程序包含的全部内容。Playwright 下载的浏览器以及 Windows WebView2、系统运行库不随本源码交付；如果以后另外分发浏览器或运行库，须随该分发补齐其原始条款和声明。

## MPL 源码获取

MPL 2.0 组件的覆盖代码保留原许可。相应 `.crate` 源码原包以及 Lightning CSS 官方 `v1.33.0` 完整源码归档随仓库放在 [third_party/sources](third_party/sources/)；版本、上游获取链接与 SHA-256 位于 [source-archives.json](third_party/source-archives.json)。这些是供许可证履行与阅读的第三方源码，并非构建缓存，不参与项目编译。可用常规 tar/gzip 工具解包；`.crate` 也是 gzip 压缩 tar。接收方无需付费即可从本交付取得，也可按清单中的公开原包链接获取相同版本。未来修改覆盖文件或分发二进制时，必须同时提供对应版本的覆盖源码及这些声明，不能只保留一个失效的链接。

随桌面程序分发时，将本文件与整个 `third_party/` 一并提供（或提供包含它们且接收方可取得的同版源码包），保留各原始 NOTICE、版权及许可文本。本项目的 MIT 不会替代第三方的 MPL、Apache、Unicode、BSD、ISC 等条款。

许可要求核对依据：[Mozilla MPL 2.0 正文](https://www.mozilla.org/en-US/MPL/2.0/)、[Mozilla 官方 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)、[Apache 2.0 正文](https://www.apache.org/licenses/LICENSE-2.0)、[Unicode 官方许可](https://www.unicode.org/license.txt)、[SPDX 许可表达式说明](https://spdx.dev/learn/handling-license-info/)。具体组件以随附原包条款为准；例如 Unicode 版权年份保留组件原包版本，未替换成当前官网年份。

## 其他嵌入材料

`libsqlite3-sys` 的 Rust 绑定按其随包 MIT 文本声明；其 bundled SQLite 引擎为 SQLite 官方公有领域发布，见 [SQLite 官方版权说明](https://www.sqlite.org/copyright.html)。Windows WebView2 属于外部运行前提，不随本源码包重新分发。

## 锁定依赖清单

| 生态 | 包 | 版本 | 上游许可表达式 | 声明原文 |
|---|---|---|---|---|
| cargo | `adler2` | 2.0.1 | 0BSD OR MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/adler2-2.0.1/) |
| cargo | `ahash` | 0.8.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ahash-0.8.12/) |
| cargo | `aho-corasick` | 1.1.5 | Unlicense OR MIT | [目录](third_party/licenses/cargo/aho-corasick-1.1.5/) |
| cargo | `alloc-no-stdlib` | 2.0.4 | BSD-3-Clause | [目录](third_party/licenses/cargo/alloc-no-stdlib-2.0.4/) |
| cargo | `alloc-stdlib` | 0.2.4 | BSD-3-Clause | [目录](third_party/licenses/cargo/alloc-stdlib-0.2.4/) |
| cargo | `android_system_properties` | 0.1.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/android_system_properties-0.1.6/) |
| cargo | `anyhow` | 1.0.104 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/anyhow-1.0.104/) |
| cargo | `ashpd` | 0.11.1 | MIT | [目录](third_party/licenses/cargo/ashpd-0.11.1/) |
| cargo | `async-broadcast` | 0.7.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/async-broadcast-0.7.2/) |
| cargo | `async-channel` | 2.5.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-channel-2.5.0/) |
| cargo | `async-executor` | 1.14.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-executor-1.14.0/) |
| cargo | `async-fs` | 2.2.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-fs-2.2.0/) |
| cargo | `async-io` | 2.6.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-io-2.6.0/) |
| cargo | `async-lock` | 3.4.2 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-lock-3.4.2/) |
| cargo | `async-net` | 2.0.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-net-2.0.0/) |
| cargo | `async-process` | 2.5.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-process-2.5.0/) |
| cargo | `async-recursion` | 1.1.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/async-recursion-1.1.1/) |
| cargo | `async-signal` | 0.2.14 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-signal-0.2.14/) |
| cargo | `async-task` | 4.7.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/async-task-4.7.1/) |
| cargo | `async-trait` | 0.1.92 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/async-trait-0.1.92/) |
| cargo | `atk` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/atk-0.18.2/) |
| cargo | `atk-sys` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/atk-sys-0.18.2/) |
| cargo | `atomic-waker` | 1.1.2 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/atomic-waker-1.1.2/) |
| cargo | `autocfg` | 1.5.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/autocfg-1.5.1/) |
| cargo | `base64` | 0.21.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/base64-0.21.7/) |
| cargo | `base64` | 0.22.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/base64-0.22.1/) |
| cargo | `base64` | 0.23.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/base64-0.23.1/) |
| cargo | `bit-set` | 0.8.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/bit-set-0.8.0/) |
| cargo | `bit-vec` | 0.8.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/bit-vec-0.8.0/) |
| cargo | `bitflags` | 1.3.2 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/bitflags-1.3.2/) |
| cargo | `bitflags` | 2.13.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/bitflags-2.13.2/) |
| cargo | `block-buffer` | 0.10.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/block-buffer-0.10.4/) |
| cargo | `block2` | 0.6.2 | MIT | [目录](third_party/licenses/cargo/block2-0.6.2/) |
| cargo | `blocking` | 1.7.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/blocking-1.7.0/) |
| cargo | `brotli` | 8.0.4 | BSD-3-Clause AND MIT | [目录](third_party/licenses/cargo/brotli-8.0.4/) |
| cargo | `brotli-decompressor` | 5.0.3 | BSD-3-Clause/MIT | [目录](third_party/licenses/cargo/brotli-decompressor-5.0.3/) |
| cargo | `bs58` | 0.5.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/bs58-0.5.1/) |
| cargo | `bumpalo` | 3.20.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/bumpalo-3.20.3/) |
| cargo | `bytemuck` | 1.25.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/bytemuck-1.25.2/) |
| cargo | `byteorder` | 1.5.0 | Unlicense OR MIT | [目录](third_party/licenses/cargo/byteorder-1.5.0/) |
| cargo | `byteorder-lite` | 0.1.0 | Unlicense OR MIT | [目录](third_party/licenses/cargo/byteorder-lite-0.1.0/) |
| cargo | `bytes` | 1.12.1 | MIT | [目录](third_party/licenses/cargo/bytes-1.12.1/) |
| cargo | `cairo-rs` | 0.18.5 | MIT | [目录](third_party/licenses/cargo/cairo-rs-0.18.5/) |
| cargo | `cairo-sys-rs` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/cairo-sys-rs-0.18.2/) |
| cargo | `camino` | 1.2.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/camino-1.2.6/) |
| cargo | `cargo-platform` | 0.1.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cargo-platform-0.1.9/) |
| cargo | `cargo_metadata` | 0.19.2 | MIT | [目录](third_party/licenses/cargo/cargo_metadata-0.19.2/) |
| cargo | `cargo_toml` | 0.22.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/cargo_toml-0.22.3/) |
| cargo | `cc` | 1.4.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cc-1.4.7/) |
| cargo | `cesu8` | 1.1.0 | Apache-2.0/MIT | [目录](third_party/licenses/cargo/cesu8-1.1.0/) |
| cargo | `cfb` | 0.7.3 | MIT | [目录](third_party/licenses/cargo/cfb-0.7.3/) |
| cargo | `cfg-expr` | 0.15.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cfg-expr-0.15.8/) |
| cargo | `cfg-if` | 1.0.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cfg-if-1.0.5/) |
| cargo | `chrono` | 0.4.45 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/chrono-0.4.45/) |
| cargo | `color_quant` | 1.1.0 | MIT | [目录](third_party/licenses/cargo/color_quant-1.1.0/) |
| cargo | `combine` | 4.6.8 | MIT | [目录](third_party/licenses/cargo/combine-4.6.8/) |
| cargo | `concurrent-queue` | 2.5.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/concurrent-queue-2.5.0/) |
| cargo | `cookie` | 0.18.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cookie-0.18.2/) |
| cargo | `core-foundation` | 0.10.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/core-foundation-0.10.1/) |
| cargo | `core-foundation-sys` | 0.8.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/core-foundation-sys-0.8.7/) |
| cargo | `core-graphics` | 0.25.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/core-graphics-0.25.0/) |
| cargo | `core-graphics-types` | 0.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/core-graphics-types-0.2.0/) |
| cargo | `cpufeatures` | 0.2.17 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cpufeatures-0.2.17/) |
| cargo | `crc32fast` | 1.5.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crc32fast-1.5.2/) |
| cargo | `crossbeam-channel` | 0.5.17 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crossbeam-channel-0.5.17/) |
| cargo | `crossbeam-utils` | 0.8.23 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crossbeam-utils-0.8.23/) |
| cargo | `crunchy` | 0.2.4 | MIT | [目录](third_party/licenses/cargo/crunchy-0.2.4/) |
| cargo | `crypto-common` | 0.1.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crypto-common-0.1.7/) |
| cargo | `cssparser` | 0.36.0 | MPL-2.0 | [目录](third_party/licenses/cargo/cssparser-0.36.0/) |
| cargo | `cssparser-macros` | 0.6.1 | MPL-2.0 | [目录](third_party/licenses/cargo/cssparser-macros-0.6.1/) |
| cargo | `ctor` | 0.8.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/ctor-0.8.0/) |
| cargo | `ctor-proc-macro` | 0.0.7 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/ctor-proc-macro-0.0.7/) |
| cargo | `darling` | 0.24.1 | MIT | [目录](third_party/licenses/cargo/darling-0.24.1/) |
| cargo | `darling_core` | 0.24.1 | MIT | [目录](third_party/licenses/cargo/darling_core-0.24.1/) |
| cargo | `darling_macro` | 0.24.1 | MIT | [目录](third_party/licenses/cargo/darling_macro-0.24.1/) |
| cargo | `dbus` | 0.9.12 | Apache-2.0/MIT | [目录](third_party/licenses/cargo/dbus-0.9.12/) |
| cargo | `defmt` | 1.1.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/defmt-1.1.1/) |
| cargo | `defmt-macros` | 1.1.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/defmt-macros-1.1.1/) |
| cargo | `defmt-parser` | 1.0.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/defmt-parser-1.0.0/) |
| cargo | `deranged` | 0.5.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/deranged-0.5.8/) |
| cargo | `derive_more` | 2.1.1 | MIT | [目录](third_party/licenses/cargo/derive_more-2.1.1/) |
| cargo | `derive_more-impl` | 2.1.1 | MIT | [目录](third_party/licenses/cargo/derive_more-impl-2.1.1/) |
| cargo | `digest` | 0.10.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/digest-0.10.7/) |
| cargo | `dirs` | 6.0.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/dirs-6.0.0/) |
| cargo | `dirs-sys` | 0.5.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/dirs-sys-0.5.0/) |
| cargo | `dispatch2` | 0.3.1 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/dispatch2-0.3.1/) |
| cargo | `displaydoc` | 0.2.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/displaydoc-0.2.7/) |
| cargo | `dlib` | 0.5.3 | MIT | [目录](third_party/licenses/cargo/dlib-0.5.3/) |
| cargo | `dlopen2` | 0.8.2 | MIT | [目录](third_party/licenses/cargo/dlopen2-0.8.2/) |
| cargo | `dlopen2_derive` | 0.4.3 | MIT | [目录](third_party/licenses/cargo/dlopen2_derive-0.4.3/) |
| cargo | `dom_query` | 0.27.0 | MIT | [目录](third_party/licenses/cargo/dom_query-0.27.0/) |
| cargo | `downcast-rs` | 1.2.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/downcast-rs-1.2.1/) |
| cargo | `dpi` | 0.1.2 | Apache-2.0 AND MIT | [目录](third_party/licenses/cargo/dpi-0.1.2/) |
| cargo | `dtoa` | 1.0.11 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/dtoa-1.0.11/) |
| cargo | `dtoa-short` | 0.3.5 | MPL-2.0 | [目录](third_party/licenses/cargo/dtoa-short-0.3.5/) |
| cargo | `dtor` | 0.3.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/dtor-0.3.0/) |
| cargo | `dtor-proc-macro` | 0.0.6 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/dtor-proc-macro-0.0.6/) |
| cargo | `dunce` | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 | [目录](third_party/licenses/cargo/dunce-1.0.5/) |
| cargo | `dyn-clone` | 1.0.20 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/dyn-clone-1.0.20/) |
| cargo | `embed-resource` | 3.0.11 | MIT | [目录](third_party/licenses/cargo/embed-resource-3.0.11/) |
| cargo | `embed_plist` | 1.2.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/embed_plist-1.2.2/) |
| cargo | `endi` | 1.1.1 | MIT | [目录](third_party/licenses/cargo/endi-1.1.1/) |
| cargo | `enumflags2` | 0.7.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/enumflags2-0.7.12/) |
| cargo | `enumflags2_derive` | 0.7.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/enumflags2_derive-0.7.12/) |
| cargo | `equivalent` | 1.0.2 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/equivalent-1.0.2/) |
| cargo | `erased-serde` | 0.4.10 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/erased-serde-0.4.10/) |
| cargo | `errno` | 0.3.14 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/errno-0.3.14/) |
| cargo | `event-listener` | 5.4.2 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/event-listener-5.4.2/) |
| cargo | `event-listener-strategy` | 0.5.4 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/event-listener-strategy-0.5.4/) |
| cargo | `fallible-iterator` | 0.3.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/fallible-iterator-0.3.0/) |
| cargo | `fallible-streaming-iterator` | 0.1.9 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/fallible-streaming-iterator-0.1.9/) |
| cargo | `fastrand` | 2.5.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/fastrand-2.5.0/) |
| cargo | `fax` | 0.2.7 | MIT | [目录](third_party/licenses/cargo/fax-0.2.7/) |
| cargo | `fdeflate` | 0.3.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/fdeflate-0.3.7/) |
| cargo | `field-offset` | 0.3.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/field-offset-0.3.6/) |
| cargo | `find-msvc-tools` | 0.1.13 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/find-msvc-tools-0.1.13/) |
| cargo | `flate2` | 1.1.10 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/flate2-1.1.10/) |
| cargo | `fnv` | 1.0.7 | Apache-2.0 / MIT | [目录](third_party/licenses/cargo/fnv-1.0.7/) |
| cargo | `foldhash` | 0.2.0 | Zlib | [目录](third_party/licenses/cargo/foldhash-0.2.0/) |
| cargo | `foreign-types` | 0.5.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/foreign-types-0.5.0/) |
| cargo | `foreign-types-macros` | 0.2.4 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/foreign-types-macros-0.2.4/) |
| cargo | `foreign-types-shared` | 0.3.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/foreign-types-shared-0.3.1/) |
| cargo | `form_urlencoded` | 1.2.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/form_urlencoded-1.2.2/) |
| cargo | `futures-channel` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-channel-0.3.34/) |
| cargo | `futures-core` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-core-0.3.34/) |
| cargo | `futures-executor` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-executor-0.3.34/) |
| cargo | `futures-io` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-io-0.3.34/) |
| cargo | `futures-lite` | 2.6.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/futures-lite-2.6.1/) |
| cargo | `futures-macro` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-macro-0.3.34/) |
| cargo | `futures-sink` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-sink-0.3.34/) |
| cargo | `futures-task` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-task-0.3.34/) |
| cargo | `futures-util` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/futures-util-0.3.34/) |
| cargo | `gdk` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gdk-0.18.2/) |
| cargo | `gdk-pixbuf` | 0.18.5 | MIT | [目录](third_party/licenses/cargo/gdk-pixbuf-0.18.5/) |
| cargo | `gdk-pixbuf-sys` | 0.18.0 | MIT | [目录](third_party/licenses/cargo/gdk-pixbuf-sys-0.18.0/) |
| cargo | `gdk-sys` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gdk-sys-0.18.2/) |
| cargo | `gdkwayland-sys` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gdkwayland-sys-0.18.2/) |
| cargo | `gdkx11` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gdkx11-0.18.2/) |
| cargo | `gdkx11-sys` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gdkx11-sys-0.18.2/) |
| cargo | `generic-array` | 0.14.7 | MIT | [目录](third_party/licenses/cargo/generic-array-0.14.7/) |
| cargo | `getrandom` | 0.3.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/getrandom-0.3.4/) |
| cargo | `getrandom` | 0.4.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/getrandom-0.4.3/) |
| cargo | `gif` | 0.14.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/gif-0.14.2/) |
| cargo | `gio` | 0.18.4 | MIT | [目录](third_party/licenses/cargo/gio-0.18.4/) |
| cargo | `gio-sys` | 0.18.1 | MIT | [目录](third_party/licenses/cargo/gio-sys-0.18.1/) |
| cargo | `glib` | 0.18.5 | MIT | [目录](third_party/licenses/cargo/glib-0.18.5/) |
| cargo | `glib-macros` | 0.18.5 | MIT | [目录](third_party/licenses/cargo/glib-macros-0.18.5/) |
| cargo | `glib-sys` | 0.18.1 | MIT | [目录](third_party/licenses/cargo/glib-sys-0.18.1/) |
| cargo | `glob` | 0.3.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/glob-0.3.4/) |
| cargo | `gobject-sys` | 0.18.0 | MIT | [目录](third_party/licenses/cargo/gobject-sys-0.18.0/) |
| cargo | `gtk` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gtk-0.18.2/) |
| cargo | `gtk-sys` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gtk-sys-0.18.2/) |
| cargo | `gtk3-macros` | 0.18.2 | MIT | [目录](third_party/licenses/cargo/gtk3-macros-0.18.2/) |
| cargo | `half` | 2.7.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/half-2.7.1/) |
| cargo | `hashbrown` | 0.12.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashbrown-0.12.3/) |
| cargo | `hashbrown` | 0.14.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashbrown-0.14.5/) |
| cargo | `hashbrown` | 0.17.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashbrown-0.17.1/) |
| cargo | `hashlink` | 0.9.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashlink-0.9.1/) |
| cargo | `heck` | 0.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/heck-0.4.1/) |
| cargo | `heck` | 0.5.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/heck-0.5.0/) |
| cargo | `hermit-abi` | 0.5.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hermit-abi-0.5.3/) |
| cargo | `hex` | 0.4.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hex-0.4.3/) |
| cargo | `html5ever` | 0.38.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/html5ever-0.38.0/) |
| cargo | `http` | 1.5.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/http-1.5.0/) |
| cargo | `http-body` | 1.1.0 | MIT | [目录](third_party/licenses/cargo/http-body-1.1.0/) |
| cargo | `http-body-util` | 0.1.5 | MIT | [目录](third_party/licenses/cargo/http-body-util-0.1.5/) |
| cargo | `http-range` | 0.1.5 | MIT | [目录](third_party/licenses/cargo/http-range-0.1.5/) |
| cargo | `httparse` | 1.10.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/httparse-1.10.1/) |
| cargo | `hyper` | 1.11.1 | MIT | [目录](third_party/licenses/cargo/hyper-1.11.1/) |
| cargo | `hyper-util` | 0.1.20 | MIT | [目录](third_party/licenses/cargo/hyper-util-0.1.20/) |
| cargo | `iana-time-zone` | 0.1.65 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/iana-time-zone-0.1.65/) |
| cargo | `iana-time-zone-haiku` | 0.1.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/iana-time-zone-haiku-0.1.2/) |
| cargo | `ico` | 0.5.0 | MIT | [目录](third_party/licenses/cargo/ico-0.5.0/) |
| cargo | `icu_collections` | 2.3.0 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_collections-2.3.0/) |
| cargo | `icu_locale_core` | 2.3.0 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_locale_core-2.3.0/) |
| cargo | `icu_normalizer` | 2.3.0 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_normalizer-2.3.0/) |
| cargo | `icu_normalizer_data` | 2.3.0 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_normalizer_data-2.3.0/) |
| cargo | `icu_properties` | 2.3.0 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_properties-2.3.0/) |
| cargo | `icu_properties_data` | 2.3.0 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_properties_data-2.3.0/) |
| cargo | `icu_provider` | 2.3.1 | Unicode-3.0 | [目录](third_party/licenses/cargo/icu_provider-2.3.1/) |
| cargo | `ident_case` | 1.0.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/ident_case-1.0.1/) |
| cargo | `idna` | 1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/idna-1.1.0/) |
| cargo | `idna_adapter` | 1.2.2 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/idna_adapter-1.2.2/) |
| cargo | `image` | 0.25.10 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/image-0.25.10/) |
| cargo | `image-webp` | 0.2.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/image-webp-0.2.4/) |
| cargo | `indexmap` | 1.9.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/indexmap-1.9.3/) |
| cargo | `indexmap` | 2.14.2 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/indexmap-2.14.2/) |
| cargo | `infer` | 0.19.0 | MIT | [目录](third_party/licenses/cargo/infer-0.19.0/) |
| cargo | `ipnet` | 2.12.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ipnet-2.12.2/) |
| cargo | `itoa` | 1.0.18 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/itoa-1.0.18/) |
| cargo | `javascriptcore-rs` | 1.1.2 | MIT | [目录](third_party/licenses/cargo/javascriptcore-rs-1.1.2/) |
| cargo | `javascriptcore-rs-sys` | 1.1.1 | MIT | [目录](third_party/licenses/cargo/javascriptcore-rs-sys-1.1.1/) |
| cargo | `jiff` | 0.2.37 | Unlicense OR MIT | [目录](third_party/licenses/cargo/jiff-0.2.37/) |
| cargo | `jiff-core` | 0.1.1 | Unlicense OR MIT | [目录](third_party/licenses/cargo/jiff-core-0.1.1/) |
| cargo | `jiff-static` | 0.2.37 | Unlicense OR MIT | [目录](third_party/licenses/cargo/jiff-static-0.2.37/) |
| cargo | `jiff-tzdb` | 0.1.8 | Unlicense OR MIT | [目录](third_party/licenses/cargo/jiff-tzdb-0.1.8/) |
| cargo | `jiff-tzdb-platform` | 0.1.3 | Unlicense OR MIT | [目录](third_party/licenses/cargo/jiff-tzdb-platform-0.1.3/) |
| cargo | `jni` | 0.21.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/jni-0.21.1/) |
| cargo | `jni-sys` | 0.3.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/jni-sys-0.3.1/) |
| cargo | `jni-sys` | 0.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/jni-sys-0.4.1/) |
| cargo | `jni-sys-macros` | 0.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/jni-sys-macros-0.4.1/) |
| cargo | `js-sys` | 0.3.105 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/js-sys-0.3.105/) |
| cargo | `json-patch` | 3.0.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/json-patch-3.0.1/) |
| cargo | `jsonptr` | 0.6.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/jsonptr-0.6.3/) |
| cargo | `keyboard-types` | 0.7.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/keyboard-types-0.7.0/) |
| cargo | `libappindicator` | 0.9.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/libappindicator-0.9.0/) |
| cargo | `libappindicator-sys` | 0.9.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/libappindicator-sys-0.9.0/) |
| cargo | `libc` | 0.2.189 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/libc-0.2.189/) |
| cargo | `libdbus-sys` | 0.2.7 | Apache-2.0/MIT | [目录](third_party/licenses/cargo/libdbus-sys-0.2.7/) |
| cargo | `libloading` | 0.7.4 | ISC | [目录](third_party/licenses/cargo/libloading-0.7.4/) |
| cargo | `libredox` | 0.1.24 | MIT | [目录](third_party/licenses/cargo/libredox-0.1.24/) |
| cargo | `libsqlite3-sys` | 0.30.1 | MIT | [目录](third_party/licenses/cargo/libsqlite3-sys-0.30.1/) |
| cargo | `linux-raw-sys` | 0.12.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/linux-raw-sys-0.12.1/) |
| cargo | `litemap` | 0.8.3 | Unicode-3.0 | [目录](third_party/licenses/cargo/litemap-0.8.3/) |
| cargo | `lock_api` | 0.4.14 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/lock_api-0.4.14/) |
| cargo | `log` | 0.4.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/log-0.4.34/) |
| cargo | `markup5ever` | 0.38.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/markup5ever-0.38.0/) |
| cargo | `memchr` | 2.8.3 | Unlicense OR MIT | [目录](third_party/licenses/cargo/memchr-2.8.3/) |
| cargo | `memoffset` | 0.9.1 | MIT | [目录](third_party/licenses/cargo/memoffset-0.9.1/) |
| cargo | `mime` | 0.3.17 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/mime-0.3.17/) |
| cargo | `miniz_oxide` | 0.8.9 | MIT OR Zlib OR Apache-2.0 | [目录](third_party/licenses/cargo/miniz_oxide-0.8.9/) |
| cargo | `miniz_oxide` | 0.9.1 | MIT OR Zlib OR Apache-2.0 | [目录](third_party/licenses/cargo/miniz_oxide-0.9.1/) |
| cargo | `mio` | 1.2.3 | MIT | [目录](third_party/licenses/cargo/mio-1.2.3/) |
| cargo | `moxcms` | 0.8.1 | BSD-3-Clause OR Apache-2.0 | [目录](third_party/licenses/cargo/moxcms-0.8.1/) |
| cargo | `muda` | 0.19.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/muda-0.19.3/) |
| cargo | `ndk` | 0.9.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ndk-0.9.0/) |
| cargo | `ndk-sys` | 0.6.0+11769913 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ndk-sys-0.6.0+11769913/) |
| cargo | `new_debug_unreachable` | 1.0.6 | MIT | [目录](third_party/licenses/cargo/new_debug_unreachable-1.0.6/) |
| cargo | `num-conv` | 0.2.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/num-conv-0.2.2/) |
| cargo | `num-traits` | 0.2.19 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/num-traits-0.2.19/) |
| cargo | `num_enum` | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/num_enum-0.7.6/) |
| cargo | `num_enum_derive` | 0.7.6 | BSD-3-Clause OR MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/num_enum_derive-0.7.6/) |
| cargo | `objc2` | 0.6.4 | MIT | [目录](third_party/licenses/cargo/objc2-0.6.4/) |
| cargo | `objc2-app-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-app-kit-0.3.2/) |
| cargo | `objc2-cloud-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-cloud-kit-0.3.2/) |
| cargo | `objc2-core-data` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-core-data-0.3.2/) |
| cargo | `objc2-core-foundation` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-core-foundation-0.3.2/) |
| cargo | `objc2-core-graphics` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-core-graphics-0.3.2/) |
| cargo | `objc2-core-image` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-core-image-0.3.2/) |
| cargo | `objc2-core-location` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-core-location-0.3.2/) |
| cargo | `objc2-core-text` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-core-text-0.3.2/) |
| cargo | `objc2-encode` | 4.1.0 | MIT | [目录](third_party/licenses/cargo/objc2-encode-4.1.0/) |
| cargo | `objc2-exception-helper` | 0.1.1 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-exception-helper-0.1.1/) |
| cargo | `objc2-foundation` | 0.3.2 | MIT | [目录](third_party/licenses/cargo/objc2-foundation-0.3.2/) |
| cargo | `objc2-io-surface` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-io-surface-0.3.2/) |
| cargo | `objc2-quartz-core` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-quartz-core-0.3.2/) |
| cargo | `objc2-ui-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-ui-kit-0.3.2/) |
| cargo | `objc2-user-notifications` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-user-notifications-0.3.2/) |
| cargo | `objc2-web-kit` | 0.3.2 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/objc2-web-kit-0.3.2/) |
| cargo | `once_cell` | 1.21.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/once_cell-1.21.4/) |
| cargo | `option-ext` | 0.2.0 | MPL-2.0 | [目录](third_party/licenses/cargo/option-ext-0.2.0/) |
| cargo | `ordered-stream` | 0.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ordered-stream-0.2.0/) |
| cargo | `pango` | 0.18.3 | MIT | [目录](third_party/licenses/cargo/pango-0.18.3/) |
| cargo | `pango-sys` | 0.18.0 | MIT | [目录](third_party/licenses/cargo/pango-sys-0.18.0/) |
| cargo | `parking` | 2.2.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/parking-2.2.1/) |
| cargo | `parking_lot` | 0.12.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/parking_lot-0.12.5/) |
| cargo | `parking_lot_core` | 0.9.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/parking_lot_core-0.9.12/) |
| cargo | `percent-encoding` | 2.3.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/percent-encoding-2.3.2/) |
| cargo | `phf` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf-0.13.1/) |
| cargo | `phf_codegen` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_codegen-0.13.1/) |
| cargo | `phf_generator` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_generator-0.13.1/) |
| cargo | `phf_macros` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_macros-0.13.1/) |
| cargo | `phf_shared` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_shared-0.13.1/) |
| cargo | `pin-project-lite` | 0.2.17 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/pin-project-lite-0.2.17/) |
| cargo | `piper` | 0.2.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/piper-0.2.5/) |
| cargo | `pkg-config` | 0.3.34 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/pkg-config-0.3.34/) |
| cargo | `plist` | 1.10.1 | MIT | [目录](third_party/licenses/cargo/plist-1.10.1/) |
| cargo | `png` | 0.17.16 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/png-0.17.16/) |
| cargo | `png` | 0.18.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/png-0.18.1/) |
| cargo | `polling` | 3.11.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/polling-3.11.0/) |
| cargo | `pollster` | 0.4.0 | Apache-2.0/MIT | [目录](third_party/licenses/cargo/pollster-0.4.0/) |
| cargo | `portable-atomic` | 1.15.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/portable-atomic-1.15.0/) |
| cargo | `portable-atomic-util` | 0.2.8 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/portable-atomic-util-0.2.8/) |
| cargo | `potential_utf` | 0.1.6 | Unicode-3.0 | [目录](third_party/licenses/cargo/potential_utf-0.1.6/) |
| cargo | `powerfmt` | 0.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/powerfmt-0.2.0/) |
| cargo | `ppv-lite86` | 0.2.21 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ppv-lite86-0.2.21/) |
| cargo | `precomputed-hash` | 0.1.1 | MIT | [目录](third_party/licenses/cargo/precomputed-hash-0.1.1/) |
| cargo | `proc-macro-crate` | 1.3.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-crate-1.3.1/) |
| cargo | `proc-macro-crate` | 2.0.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-crate-2.0.2/) |
| cargo | `proc-macro-crate` | 3.5.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-crate-3.5.0/) |
| cargo | `proc-macro-error` | 1.0.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-error-1.0.4/) |
| cargo | `proc-macro-error-attr` | 1.0.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-error-attr-1.0.4/) |
| cargo | `proc-macro2` | 1.0.107 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro2-1.0.107/) |
| cargo | `pxfm` | 0.1.30 | BSD-3-Clause OR Apache-2.0 | [目录](third_party/licenses/cargo/pxfm-0.1.30/) |
| cargo | `quick-error` | 2.0.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/quick-error-2.0.1/) |
| cargo | `quick-xml` | 0.41.0 | MIT | [目录](third_party/licenses/cargo/quick-xml-0.41.0/) |
| cargo | `quick-xml` | 0.42.0 | MIT | [目录](third_party/licenses/cargo/quick-xml-0.42.0/) |
| cargo | `quote` | 1.0.47 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/quote-1.0.47/) |
| cargo | `r-efi` | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | [目录](third_party/licenses/cargo/r-efi-5.3.0/) |
| cargo | `r-efi` | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | [目录](third_party/licenses/cargo/r-efi-6.0.0/) |
| cargo | `rand` | 0.9.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rand-0.9.5/) |
| cargo | `rand_chacha` | 0.9.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rand_chacha-0.9.0/) |
| cargo | `rand_core` | 0.9.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rand_core-0.9.5/) |
| cargo | `raw-window-handle` | 0.6.2 | MIT OR Apache-2.0 OR Zlib | [目录](third_party/licenses/cargo/raw-window-handle-0.6.2/) |
| cargo | `redox_syscall` | 0.5.18 | MIT | [目录](third_party/licenses/cargo/redox_syscall-0.5.18/) |
| cargo | `redox_users` | 0.5.3 | MIT | [目录](third_party/licenses/cargo/redox_users-0.5.3/) |
| cargo | `ref-cast` | 1.0.27 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ref-cast-1.0.27/) |
| cargo | `ref-cast-impl` | 1.0.27 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ref-cast-impl-1.0.27/) |
| cargo | `regex` | 1.13.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/regex-1.13.1/) |
| cargo | `regex-automata` | 0.4.18 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/regex-automata-0.4.18/) |
| cargo | `regex-syntax` | 0.8.11 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/regex-syntax-0.8.11/) |
| cargo | `reqwest` | 0.13.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/reqwest-0.13.5/) |
| cargo | `rfd` | 0.15.4 | MIT | [目录](third_party/licenses/cargo/rfd-0.15.4/) |
| cargo | `rusqlite` | 0.32.1 | MIT | [目录](third_party/licenses/cargo/rusqlite-0.32.1/) |
| cargo | `rustc-hash` | 2.1.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/rustc-hash-2.1.3/) |
| cargo | `rustc_version` | 0.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rustc_version-0.4.1/) |
| cargo | `rustix` | 1.1.5 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/rustix-1.1.5/) |
| cargo | `rustversion` | 1.0.23 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rustversion-1.0.23/) |
| cargo | `same-file` | 1.0.6 | Unlicense/MIT | [目录](third_party/licenses/cargo/same-file-1.0.6/) |
| cargo | `schemars` | 0.8.22 | MIT | [目录](third_party/licenses/cargo/schemars-0.8.22/) |
| cargo | `schemars` | 0.9.0 | MIT | [目录](third_party/licenses/cargo/schemars-0.9.0/) |
| cargo | `schemars` | 1.2.2 | MIT | [目录](third_party/licenses/cargo/schemars-1.2.2/) |
| cargo | `schemars_derive` | 0.8.22 | MIT | [目录](third_party/licenses/cargo/schemars_derive-0.8.22/) |
| cargo | `scoped-tls` | 1.0.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/scoped-tls-1.0.1/) |
| cargo | `scopeguard` | 1.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/scopeguard-1.2.0/) |
| cargo | `selectors` | 0.36.1 | MPL-2.0 | [目录](third_party/licenses/cargo/selectors-0.36.1/) |
| cargo | `semver` | 1.0.28 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/semver-1.0.28/) |
| cargo | `serde` | 1.0.229 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde-1.0.229/) |
| cargo | `serde-untagged` | 0.1.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde-untagged-0.1.9/) |
| cargo | `serde_core` | 1.0.229 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_core-1.0.229/) |
| cargo | `serde_derive` | 1.0.229 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_derive-1.0.229/) |
| cargo | `serde_derive_internals` | 0.29.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_derive_internals-0.29.1/) |
| cargo | `serde_json` | 1.0.151 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_json-1.0.151/) |
| cargo | `serde_repr` | 0.1.21 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_repr-0.1.21/) |
| cargo | `serde_spanned` | 0.6.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_spanned-0.6.9/) |
| cargo | `serde_spanned` | 1.1.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_spanned-1.1.1/) |
| cargo | `serde_with` | 3.23.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_with-3.23.0/) |
| cargo | `serde_with_macros` | 3.23.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_with_macros-3.23.0/) |
| cargo | `serialize-to-javascript` | 0.1.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serialize-to-javascript-0.1.2/) |
| cargo | `serialize-to-javascript-impl` | 0.1.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serialize-to-javascript-impl-0.1.2/) |
| cargo | `servo_arc` | 0.4.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/servo_arc-0.4.3/) |
| cargo | `sha2` | 0.10.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/sha2-0.10.9/) |
| cargo | `shlex` | 2.0.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/shlex-2.0.1/) |
| cargo | `signal-hook-registry` | 1.4.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/signal-hook-registry-1.4.8/) |
| cargo | `simd-adler32` | 0.3.10 | MIT | [目录](third_party/licenses/cargo/simd-adler32-0.3.10/) |
| cargo | `siphasher` | 1.0.3 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/siphasher-1.0.3/) |
| cargo | `slab` | 0.4.12 | MIT | [目录](third_party/licenses/cargo/slab-0.4.12/) |
| cargo | `smallvec` | 1.16.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/smallvec-1.16.1/) |
| cargo | `socket2` | 0.6.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/socket2-0.6.5/) |
| cargo | `softbuffer` | 0.4.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/softbuffer-0.4.8/) |
| cargo | `soup3` | 0.5.0 | MIT | [目录](third_party/licenses/cargo/soup3-0.5.0/) |
| cargo | `soup3-sys` | 0.5.0 | MIT | [目录](third_party/licenses/cargo/soup3-sys-0.5.0/) |
| cargo | `stable_deref_trait` | 1.2.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/stable_deref_trait-1.2.1/) |
| cargo | `string_cache` | 0.9.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/string_cache-0.9.0/) |
| cargo | `string_cache_codegen` | 0.6.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/string_cache_codegen-0.6.1/) |
| cargo | `strsim` | 0.11.1 | MIT | [目录](third_party/licenses/cargo/strsim-0.11.1/) |
| cargo | `swift-rs` | 1.0.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/swift-rs-1.0.8/) |
| cargo | `syn` | 1.0.109 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/syn-1.0.109/) |
| cargo | `syn` | 2.0.119 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/syn-2.0.119/) |
| cargo | `syn` | 3.0.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/syn-3.0.6/) |
| cargo | `sync_wrapper` | 1.0.2 | Apache-2.0 | [目录](third_party/licenses/cargo/sync_wrapper-1.0.2/) |
| cargo | `synstructure` | 0.14.0 | MIT | [目录](third_party/licenses/cargo/synstructure-0.14.0/) |
| cargo | `system-deps` | 6.2.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/system-deps-6.2.2/) |
| cargo | `tao` | 0.35.3 | Apache-2.0 | [目录](third_party/licenses/cargo/tao-0.35.3/) |
| cargo | `tao-macros` | 0.1.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/tao-macros-0.1.4/) |
| cargo | `target-lexicon` | 0.12.16 | Apache-2.0 WITH LLVM-exception | [目录](third_party/licenses/cargo/target-lexicon-0.12.16/) |
| cargo | `tauri` | 2.11.6 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-2.11.6/) |
| cargo | `tauri-build` | 2.6.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-build-2.6.3/) |
| cargo | `tauri-codegen` | 2.6.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-codegen-2.6.3/) |
| cargo | `tauri-macros` | 2.6.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-macros-2.6.3/) |
| cargo | `tauri-runtime` | 2.11.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-runtime-2.11.3/) |
| cargo | `tauri-runtime-wry` | 2.11.4 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-runtime-wry-2.11.4/) |
| cargo | `tauri-utils` | 2.9.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tauri-utils-2.9.3/) |
| cargo | `tauri-winres` | 0.3.6 | MIT | [目录](third_party/licenses/cargo/tauri-winres-0.3.6/) |
| cargo | `tempfile` | 3.27.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/tempfile-3.27.0/) |
| cargo | `tendril` | 0.5.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/tendril-0.5.1/) |
| cargo | `thiserror` | 1.0.69 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/thiserror-1.0.69/) |
| cargo | `thiserror` | 2.0.20 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/thiserror-2.0.20/) |
| cargo | `thiserror-impl` | 1.0.69 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/thiserror-impl-1.0.69/) |
| cargo | `thiserror-impl` | 2.0.20 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/thiserror-impl-2.0.20/) |
| cargo | `tiff` | 0.11.3 | MIT | [目录](third_party/licenses/cargo/tiff-0.11.3/) |
| cargo | `time` | 0.3.55 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/time-0.3.55/) |
| cargo | `time-core` | 0.1.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/time-core-0.1.9/) |
| cargo | `time-macros` | 0.2.32 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/time-macros-0.2.32/) |
| cargo | `tinystr` | 0.8.4 | Unicode-3.0 | [目录](third_party/licenses/cargo/tinystr-0.8.4/) |
| cargo | `tinyvec` | 1.13.3 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tinyvec-1.13.3/) |
| cargo | `tokio` | 1.53.1 | MIT | [目录](third_party/licenses/cargo/tokio-1.53.1/) |
| cargo | `tokio-util` | 0.7.19 | MIT | [目录](third_party/licenses/cargo/tokio-util-0.7.19/) |
| cargo | `toml` | 0.8.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml-0.8.2/) |
| cargo | `toml` | 0.9.12+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml-0.9.12+spec-1.1.0/) |
| cargo | `toml` | 1.1.6+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml-1.1.6+spec-1.1.0/) |
| cargo | `toml_datetime` | 0.6.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_datetime-0.6.3/) |
| cargo | `toml_datetime` | 0.7.5+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_datetime-0.7.5+spec-1.1.0/) |
| cargo | `toml_datetime` | 1.1.1+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_datetime-1.1.1+spec-1.1.0/) |
| cargo | `toml_edit` | 0.19.15 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_edit-0.19.15/) |
| cargo | `toml_edit` | 0.20.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_edit-0.20.2/) |
| cargo | `toml_edit` | 0.25.15+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_edit-0.25.15+spec-1.1.0/) |
| cargo | `toml_parser` | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_parser-1.1.3+spec-1.1.0/) |
| cargo | `toml_writer` | 1.1.2+spec-1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/toml_writer-1.1.2+spec-1.1.0/) |
| cargo | `tower` | 0.5.3 | MIT | [目录](third_party/licenses/cargo/tower-0.5.3/) |
| cargo | `tower-http` | 0.6.11 | MIT | [目录](third_party/licenses/cargo/tower-http-0.6.11/) |
| cargo | `tower-layer` | 0.3.3 | MIT | [目录](third_party/licenses/cargo/tower-layer-0.3.3/) |
| cargo | `tower-service` | 0.3.3 | MIT | [目录](third_party/licenses/cargo/tower-service-0.3.3/) |
| cargo | `tracing` | 0.1.44 | MIT | [目录](third_party/licenses/cargo/tracing-0.1.44/) |
| cargo | `tracing-attributes` | 0.1.31 | MIT | [目录](third_party/licenses/cargo/tracing-attributes-0.1.31/) |
| cargo | `tracing-core` | 0.1.36 | MIT | [目录](third_party/licenses/cargo/tracing-core-0.1.36/) |
| cargo | `tray-icon` | 0.24.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/tray-icon-0.24.2/) |
| cargo | `try-lock` | 0.2.5 | MIT | [目录](third_party/licenses/cargo/try-lock-0.2.5/) |
| cargo | `typeid` | 1.0.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/typeid-1.0.3/) |
| cargo | `typenum` | 1.20.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/typenum-1.20.1/) |
| cargo | `uds_windows` | 1.2.1 | MIT | [目录](third_party/licenses/cargo/uds_windows-1.2.1/) |
| cargo | `unic-char-property` | 0.9.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/unic-char-property-0.9.0/) |
| cargo | `unic-char-range` | 0.9.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/unic-char-range-0.9.0/) |
| cargo | `unic-common` | 0.9.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/unic-common-0.9.0/) |
| cargo | `unic-ucd-ident` | 0.9.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/unic-ucd-ident-0.9.0/) |
| cargo | `unic-ucd-version` | 0.9.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/unic-ucd-version-0.9.0/) |
| cargo | `unicode-ident` | 1.0.26 | (MIT OR Apache-2.0) AND Unicode-3.0 | [目录](third_party/licenses/cargo/unicode-ident-1.0.26/) |
| cargo | `unicode-segmentation` | 1.13.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/unicode-segmentation-1.13.3/) |
| cargo | `url` | 2.5.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/url-2.5.8/) |
| cargo | `urlencoding` | 2.1.3 | MIT | [目录](third_party/licenses/cargo/urlencoding-2.1.3/) |
| cargo | `urlpattern` | 0.3.0 | MIT | [目录](third_party/licenses/cargo/urlpattern-0.3.0/) |
| cargo | `utf8_iter` | 1.0.4 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/utf8_iter-1.0.4/) |
| cargo | `uuid` | 1.26.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/uuid-1.26.1/) |
| cargo | `vcpkg` | 0.2.15 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/vcpkg-0.2.15/) |
| cargo | `version-compare` | 0.2.1 | MIT | [目录](third_party/licenses/cargo/version-compare-0.2.1/) |
| cargo | `version_check` | 0.9.5 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/version_check-0.9.5/) |
| cargo | `vswhom` | 0.1.0 | MIT | [目录](third_party/licenses/cargo/vswhom-0.1.0/) |
| cargo | `vswhom-sys` | 0.1.3 | MIT | [目录](third_party/licenses/cargo/vswhom-sys-0.1.3/) |
| cargo | `walkdir` | 2.5.0 | Unlicense/MIT | [目录](third_party/licenses/cargo/walkdir-2.5.0/) |
| cargo | `want` | 0.3.1 | MIT | [目录](third_party/licenses/cargo/want-0.3.1/) |
| cargo | `wasi` | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wasi-0.11.1+wasi-snapshot-preview1/) |
| cargo | `wasip2` | 1.0.4+wasi-0.2.12 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wasip2-1.0.4+wasi-0.2.12/) |
| cargo | `wasm-bindgen` | 0.2.128 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-0.2.128/) |
| cargo | `wasm-bindgen-futures` | 0.4.78 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-futures-0.4.78/) |
| cargo | `wasm-bindgen-macro` | 0.2.128 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-macro-0.2.128/) |
| cargo | `wasm-bindgen-macro-support` | 0.2.128 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-macro-support-0.2.128/) |
| cargo | `wasm-bindgen-shared` | 0.2.128 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-shared-0.2.128/) |
| cargo | `wasm-streams` | 0.5.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-streams-0.5.0/) |
| cargo | `wayland-backend` | 0.3.17 | MIT | [目录](third_party/licenses/cargo/wayland-backend-0.3.17/) |
| cargo | `wayland-client` | 0.31.15 | MIT | [目录](third_party/licenses/cargo/wayland-client-0.31.15/) |
| cargo | `wayland-protocols` | 0.32.13 | MIT | [目录](third_party/licenses/cargo/wayland-protocols-0.32.13/) |
| cargo | `wayland-scanner` | 0.31.11 | MIT | [目录](third_party/licenses/cargo/wayland-scanner-0.31.11/) |
| cargo | `wayland-sys` | 0.31.11 | MIT | [目录](third_party/licenses/cargo/wayland-sys-0.31.11/) |
| cargo | `web-sys` | 0.3.105 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/web-sys-0.3.105/) |
| cargo | `web_atoms` | 0.2.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/web_atoms-0.2.6/) |
| cargo | `webkit2gtk` | 2.0.2 | MIT | [目录](third_party/licenses/cargo/webkit2gtk-2.0.2/) |
| cargo | `webkit2gtk-sys` | 2.0.2 | MIT | [目录](third_party/licenses/cargo/webkit2gtk-sys-2.0.2/) |
| cargo | `webview2-com` | 0.38.2 | MIT | [目录](third_party/licenses/cargo/webview2-com-0.38.2/) |
| cargo | `webview2-com-macros` | 0.8.1 | MIT | [目录](third_party/licenses/cargo/webview2-com-macros-0.8.1/) |
| cargo | `webview2-com-sys` | 0.38.2 | MIT | [目录](third_party/licenses/cargo/webview2-com-sys-0.38.2/) |
| cargo | `weezl` | 0.1.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/weezl-0.1.12/) |
| cargo | `winapi` | 0.3.9 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/winapi-0.3.9/) |
| cargo | `winapi-i686-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/winapi-i686-pc-windows-gnu-0.4.0/) |
| cargo | `winapi-util` | 0.1.11 | Unlicense OR MIT | [目录](third_party/licenses/cargo/winapi-util-0.1.11/) |
| cargo | `winapi-x86_64-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/winapi-x86_64-pc-windows-gnu-0.4.0/) |
| cargo | `window-vibrancy` | 0.6.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/window-vibrancy-0.6.0/) |
| cargo | `windows` | 0.61.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-0.61.3/) |
| cargo | `windows-collections` | 0.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-collections-0.2.0/) |
| cargo | `windows-core` | 0.61.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-core-0.61.2/) |
| cargo | `windows-core` | 0.62.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-core-0.62.2/) |
| cargo | `windows-future` | 0.2.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-future-0.2.1/) |
| cargo | `windows-implement` | 0.60.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-implement-0.60.2/) |
| cargo | `windows-interface` | 0.59.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-interface-0.59.3/) |
| cargo | `windows-link` | 0.1.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-link-0.1.3/) |
| cargo | `windows-link` | 0.2.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-link-0.2.1/) |
| cargo | `windows-numerics` | 0.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-numerics-0.2.0/) |
| cargo | `windows-result` | 0.3.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-result-0.3.4/) |
| cargo | `windows-result` | 0.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-result-0.4.1/) |
| cargo | `windows-strings` | 0.4.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-strings-0.4.2/) |
| cargo | `windows-strings` | 0.5.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-strings-0.5.1/) |
| cargo | `windows-sys` | 0.45.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-sys-0.45.0/) |
| cargo | `windows-sys` | 0.59.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-sys-0.59.0/) |
| cargo | `windows-sys` | 0.61.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-sys-0.61.2/) |
| cargo | `windows-targets` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-targets-0.42.2/) |
| cargo | `windows-targets` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-targets-0.52.6/) |
| cargo | `windows-threading` | 0.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-threading-0.1.0/) |
| cargo | `windows-version` | 0.1.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-version-0.1.7/) |
| cargo | `windows_aarch64_gnullvm` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_aarch64_gnullvm-0.42.2/) |
| cargo | `windows_aarch64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_aarch64_gnullvm-0.52.6/) |
| cargo | `windows_aarch64_msvc` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_aarch64_msvc-0.42.2/) |
| cargo | `windows_aarch64_msvc` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_aarch64_msvc-0.52.6/) |
| cargo | `windows_i686_gnu` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_gnu-0.42.2/) |
| cargo | `windows_i686_gnu` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_gnu-0.52.6/) |
| cargo | `windows_i686_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_gnullvm-0.52.6/) |
| cargo | `windows_i686_msvc` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_msvc-0.42.2/) |
| cargo | `windows_i686_msvc` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_msvc-0.52.6/) |
| cargo | `windows_x86_64_gnu` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_gnu-0.42.2/) |
| cargo | `windows_x86_64_gnu` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_gnu-0.52.6/) |
| cargo | `windows_x86_64_gnullvm` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_gnullvm-0.42.2/) |
| cargo | `windows_x86_64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_gnullvm-0.52.6/) |
| cargo | `windows_x86_64_msvc` | 0.42.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_msvc-0.42.2/) |
| cargo | `windows_x86_64_msvc` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_msvc-0.52.6/) |
| cargo | `winnow` | 0.5.40 | MIT | [目录](third_party/licenses/cargo/winnow-0.5.40/) |
| cargo | `winnow` | 0.7.15 | MIT | [目录](third_party/licenses/cargo/winnow-0.7.15/) |
| cargo | `winnow` | 1.0.4 | MIT | [目录](third_party/licenses/cargo/winnow-1.0.4/) |
| cargo | `winreg` | 0.55.0 | MIT | [目录](third_party/licenses/cargo/winreg-0.55.0/) |
| cargo | `wit-bindgen` | 0.57.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wit-bindgen-0.57.1/) |
| cargo | `writeable` | 0.6.4 | Unicode-3.0 | [目录](third_party/licenses/cargo/writeable-0.6.4/) |
| cargo | `wry` | 0.55.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wry-0.55.1/) |
| cargo | `x11` | 2.21.0 | MIT | [目录](third_party/licenses/cargo/x11-2.21.0/) |
| cargo | `x11-dl` | 2.21.0 | MIT | [目录](third_party/licenses/cargo/x11-dl-2.21.0/) |
| cargo | `yoke` | 0.8.3 | Unicode-3.0 | [目录](third_party/licenses/cargo/yoke-0.8.3/) |
| cargo | `yoke-derive` | 0.8.3 | Unicode-3.0 | [目录](third_party/licenses/cargo/yoke-derive-0.8.3/) |
| cargo | `zbus` | 5.19.0 | MIT | [目录](third_party/licenses/cargo/zbus-5.19.0/) |
| cargo | `zbus_macros` | 5.19.0 | MIT | [目录](third_party/licenses/cargo/zbus_macros-5.19.0/) |
| cargo | `zbus_names` | 4.3.4 | MIT | [目录](third_party/licenses/cargo/zbus_names-4.3.4/) |
| cargo | `zcheapstr` | 1.1.0 | MIT | [目录](third_party/licenses/cargo/zcheapstr-1.1.0/) |
| cargo | `zerocopy` | 0.8.57 | BSD-2-Clause OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/zerocopy-0.8.57/) |
| cargo | `zerocopy-derive` | 0.8.57 | BSD-2-Clause OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/zerocopy-derive-0.8.57/) |
| cargo | `zerofrom` | 0.1.8 | Unicode-3.0 | [目录](third_party/licenses/cargo/zerofrom-0.1.8/) |
| cargo | `zerofrom-derive` | 0.1.8 | Unicode-3.0 | [目录](third_party/licenses/cargo/zerofrom-derive-0.1.8/) |
| cargo | `zerotrie` | 0.2.5 | Unicode-3.0 | [目录](third_party/licenses/cargo/zerotrie-0.2.5/) |
| cargo | `zerovec` | 0.11.8 | Unicode-3.0 | [目录](third_party/licenses/cargo/zerovec-0.11.8/) |
| cargo | `zerovec-derive` | 0.11.6 | Unicode-3.0 | [目录](third_party/licenses/cargo/zerovec-derive-0.11.6/) |
| cargo | `zlib-rs` | 0.6.8 | Zlib | [目录](third_party/licenses/cargo/zlib-rs-0.6.8/) |
| cargo | `zmij` | 1.0.23 | MIT | [目录](third_party/licenses/cargo/zmij-1.0.23/) |
| cargo | `zune-core` | 0.5.3 | MIT OR Apache-2.0 OR Zlib | [目录](third_party/licenses/cargo/zune-core-0.5.3/) |
| cargo | `zune-jpeg` | 0.5.15 | MIT OR Apache-2.0 OR Zlib | [目录](third_party/licenses/cargo/zune-jpeg-0.5.15/) |
| cargo | `zvariant` | 5.15.0 | MIT | [目录](third_party/licenses/cargo/zvariant-5.15.0/) |
| cargo | `zvariant_derive` | 5.15.0 | MIT | [目录](third_party/licenses/cargo/zvariant_derive-5.15.0/) |
| cargo | `zvariant_utils` | 4.2.0 | MIT | [目录](third_party/licenses/cargo/zvariant_utils-4.2.0/) |
| npm | `@oxc-project/types` | 0.150.0 | MIT | [目录](third_party/licenses/npm/_oxc-project_types-0.150.0/) |
| npm | `@rolldown/binding-android-arm-eabi` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-android-arm-eabi-1.2.9/) |
| npm | `@rolldown/binding-android-arm64` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-android-arm64-1.2.9/) |
| npm | `@rolldown/binding-darwin-arm64` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-darwin-arm64-1.2.9/) |
| npm | `@rolldown/binding-darwin-x64` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-darwin-x64-1.2.9/) |
| npm | `@rolldown/binding-freebsd-x64` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-freebsd-x64-1.2.9/) |
| npm | `@rolldown/binding-linux-arm-gnueabihf` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-arm-gnueabihf-1.2.9/) |
| npm | `@rolldown/binding-linux-arm64-gnu` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-arm64-gnu-1.2.9/) |
| npm | `@rolldown/binding-linux-arm64-musl` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-arm64-musl-1.2.9/) |
| npm | `@rolldown/binding-linux-ppc64-gnu` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-ppc64-gnu-1.2.9/) |
| npm | `@rolldown/binding-linux-s390x-gnu` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-s390x-gnu-1.2.9/) |
| npm | `@rolldown/binding-linux-x64-gnu` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-x64-gnu-1.2.9/) |
| npm | `@rolldown/binding-linux-x64-musl` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-linux-x64-musl-1.2.9/) |
| npm | `@rolldown/binding-openharmony-arm64` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-openharmony-arm64-1.2.9/) |
| npm | `@rolldown/binding-win32-arm64-msvc` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-win32-arm64-msvc-1.2.9/) |
| npm | `@rolldown/binding-win32-x64-msvc` | 1.2.9 | MIT | [目录](third_party/licenses/npm/_rolldown_binding-win32-x64-msvc-1.2.9/) |
| npm | `@rolldown/pluginutils` | 1.0.1 | MIT | [目录](third_party/licenses/npm/_rolldown_pluginutils-1.0.1/) |
| npm | `@tauri-apps/api` | 2.11.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_api-2.11.1/) |
| npm | `@tauri-apps/cli` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-2.11.5/) |
| npm | `@tauri-apps/cli-darwin-arm64` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-darwin-arm64-2.11.5/) |
| npm | `@tauri-apps/cli-darwin-x64` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-darwin-x64-2.11.5/) |
| npm | `@tauri-apps/cli-linux-arm-gnueabihf` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-linux-arm-gnueabihf-2.11.5/) |
| npm | `@tauri-apps/cli-linux-arm64-gnu` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-linux-arm64-gnu-2.11.5/) |
| npm | `@tauri-apps/cli-linux-arm64-musl` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-linux-arm64-musl-2.11.5/) |
| npm | `@tauri-apps/cli-linux-riscv64-gnu` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-linux-riscv64-gnu-2.11.5/) |
| npm | `@tauri-apps/cli-linux-x64-gnu` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-linux-x64-gnu-2.11.5/) |
| npm | `@tauri-apps/cli-linux-x64-musl` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-linux-x64-musl-2.11.5/) |
| npm | `@tauri-apps/cli-win32-arm64-msvc` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-win32-arm64-msvc-2.11.5/) |
| npm | `@tauri-apps/cli-win32-ia32-msvc` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-win32-ia32-msvc-2.11.5/) |
| npm | `@tauri-apps/cli-win32-x64-msvc` | 2.11.5 | Apache-2.0 OR MIT | [目录](third_party/licenses/npm/_tauri-apps_cli-win32-x64-msvc-2.11.5/) |
| npm | `@vitejs/plugin-react` | 6.1.1 | MIT | [目录](third_party/licenses/npm/_vitejs_plugin-react-6.1.1/) |
| npm | `detect-libc` | 2.1.2 | Apache-2.0 | [目录](third_party/licenses/npm/detect-libc-2.1.2/) |
| npm | `fdir` | 6.5.0 | MIT | [目录](third_party/licenses/npm/fdir-6.5.0/) |
| npm | `fsevents` | 2.3.2 | MIT | [目录](third_party/licenses/npm/fsevents-2.3.2/) |
| npm | `fsevents` | 2.3.3 | MIT | [目录](third_party/licenses/npm/fsevents-2.3.3/) |
| npm | `lightningcss` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-1.33.0/) |
| npm | `lightningcss-android-arm64` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-android-arm64-1.33.0/) |
| npm | `lightningcss-darwin-arm64` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-darwin-arm64-1.33.0/) |
| npm | `lightningcss-darwin-x64` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-darwin-x64-1.33.0/) |
| npm | `lightningcss-freebsd-x64` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-freebsd-x64-1.33.0/) |
| npm | `lightningcss-linux-arm-gnueabihf` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-linux-arm-gnueabihf-1.33.0/) |
| npm | `lightningcss-linux-arm64-gnu` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-linux-arm64-gnu-1.33.0/) |
| npm | `lightningcss-linux-arm64-musl` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-linux-arm64-musl-1.33.0/) |
| npm | `lightningcss-linux-x64-gnu` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-linux-x64-gnu-1.33.0/) |
| npm | `lightningcss-linux-x64-musl` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-linux-x64-musl-1.33.0/) |
| npm | `lightningcss-win32-arm64-msvc` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-win32-arm64-msvc-1.33.0/) |
| npm | `lightningcss-win32-x64-msvc` | 1.33.0 | MPL-2.0 | [目录](third_party/licenses/npm/lightningcss-win32-x64-msvc-1.33.0/) |
| npm | `lucide-react` | 1.47.0 | ISC | [目录](third_party/licenses/npm/lucide-react-1.47.0/) |
| npm | `nanoid` | 3.3.19 | MIT | [目录](third_party/licenses/npm/nanoid-3.3.19/) |
| npm | `picocolors` | 1.1.1 | ISC | [目录](third_party/licenses/npm/picocolors-1.1.1/) |
| npm | `picomatch` | 4.0.7 | MIT | [目录](third_party/licenses/npm/picomatch-4.0.7/) |
| npm | `playwright` | 1.62.1 | Apache-2.0 | [目录](third_party/licenses/npm/playwright-1.62.1/) |
| npm | `playwright-core` | 1.62.1 | Apache-2.0 | [目录](third_party/licenses/npm/playwright-core-1.62.1/) |
| npm | `postcss` | 8.5.28 | MIT | [目录](third_party/licenses/npm/postcss-8.5.28/) |
| npm | `react` | 19.3.0 | MIT | [目录](third_party/licenses/npm/react-19.3.0/) |
| npm | `react-dom` | 19.3.0 | MIT | [目录](third_party/licenses/npm/react-dom-19.3.0/) |
| npm | `rolldown` | 1.2.9 | MIT | [目录](third_party/licenses/npm/rolldown-1.2.9/) |
| npm | `scheduler` | 0.28.0 | MIT | [目录](third_party/licenses/npm/scheduler-0.28.0/) |
| npm | `source-map-js` | 1.2.1 | BSD-3-Clause | [目录](third_party/licenses/npm/source-map-js-1.2.1/) |
| npm | `tinyglobby` | 0.2.17 | MIT | [目录](third_party/licenses/npm/tinyglobby-0.2.17/) |
| npm | `vite` | 8.3.0 | MIT | [目录](third_party/licenses/npm/vite-8.3.0/) |

## Lightning CSS 原生模块上游锁定组件

| 包 | 版本 | 上游许可表达式 | 声明原文 |
|---|---|---|---|
| `ahash` | 0.7.8 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ahash-0.7.8/) |
| `ahash` | 0.8.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/ahash-0.8.12/) |
| `aho-corasick` | 1.1.3 | Unlicense OR MIT | [目录](third_party/licenses/cargo/aho-corasick-1.1.3/) |
| `android-tzdata` | 0.1.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/android-tzdata-0.1.1/) |
| `android_system_properties` | 0.1.5 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/android_system_properties-0.1.5/) |
| `anes` | 0.1.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/anes-0.1.6/) |
| `anstyle` | 1.0.10 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/anstyle-1.0.10/) |
| `anyhow` | 1.0.102 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/anyhow-1.0.102/) |
| `approx` | 0.5.1 | Apache-2.0 | [目录](third_party/licenses/cargo/approx-0.5.1/) |
| `assert_cmd` | 2.0.16 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/assert_cmd-2.0.16/) |
| `assert_fs` | 1.1.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/assert_fs-1.1.2/) |
| `atty` | 0.2.14 | MIT | [目录](third_party/licenses/cargo/atty-0.2.14/) |
| `autocfg` | 1.4.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/autocfg-1.4.0/) |
| `base64-simd` | 0.7.0 | MIT | [目录](third_party/licenses/cargo/base64-simd-0.7.0/) |
| `bitflags` | 1.3.2 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/bitflags-1.3.2/) |
| `bitflags` | 2.6.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/bitflags-2.6.0/) |
| `bitvec` | 1.0.1 | MIT | [目录](third_party/licenses/cargo/bitvec-1.0.1/) |
| `browserslist-data` | 0.1.1 | MIT | [目录](third_party/licenses/cargo/browserslist-data-0.1.1/) |
| `browserslist-rs` | 0.19.0 | MIT | [目录](third_party/licenses/cargo/browserslist-rs-0.19.0/) |
| `bstr` | 1.11.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/bstr-1.11.1/) |
| `bumpalo` | 3.16.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/bumpalo-3.16.0/) |
| `bytecheck` | 0.6.12 | MIT | [目录](third_party/licenses/cargo/bytecheck-0.6.12/) |
| `bytecheck_derive` | 0.6.12 | MIT | [目录](third_party/licenses/cargo/bytecheck_derive-0.6.12/) |
| `bytes` | 1.9.0 | MIT | [目录](third_party/licenses/cargo/bytes-1.9.0/) |
| `cast` | 0.3.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cast-0.3.0/) |
| `cbindgen` | 0.24.5 | MPL-2.0 | [目录](third_party/licenses/cargo/cbindgen-0.24.5/) |
| `cc` | 1.2.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/cc-1.2.5/) |
| `cfg-if` | 1.0.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/cfg-if-1.0.0/) |
| `cfg_aliases` | 0.2.1 | MIT | [目录](third_party/licenses/cargo/cfg_aliases-0.2.1/) |
| `chrono` | 0.4.39 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/chrono-0.4.39/) |
| `ciborium` | 0.2.2 | Apache-2.0 | [目录](third_party/licenses/cargo/ciborium-0.2.2/) |
| `ciborium-io` | 0.2.2 | Apache-2.0 | [目录](third_party/licenses/cargo/ciborium-io-0.2.2/) |
| `ciborium-ll` | 0.2.2 | Apache-2.0 | [目录](third_party/licenses/cargo/ciborium-ll-0.2.2/) |
| `clap` | 3.2.25 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/clap-3.2.25/) |
| `clap` | 4.5.60 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/clap-4.5.60/) |
| `clap_builder` | 4.5.60 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/clap_builder-4.5.60/) |
| `clap_derive` | 3.2.25 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/clap_derive-3.2.25/) |
| `clap_lex` | 0.2.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/clap_lex-0.2.4/) |
| `clap_lex` | 1.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/clap_lex-1.1.0/) |
| `codspeed` | 4.6.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/codspeed-4.6.0/) |
| `codspeed-criterion-compat` | 4.6.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/codspeed-criterion-compat-4.6.0/) |
| `codspeed-criterion-compat-walltime` | 4.6.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/codspeed-criterion-compat-walltime-4.6.0/) |
| `colored` | 2.2.0 | MPL-2.0 | [目录](third_party/licenses/cargo/colored-2.2.0/) |
| `const-str` | 1.1.0 | MIT | [目录](third_party/licenses/cargo/const-str-1.1.0/) |
| `convert_case` | 0.6.0 | MIT | [目录](third_party/licenses/cargo/convert_case-0.6.0/) |
| `core-foundation-sys` | 0.8.7 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/core-foundation-sys-0.8.7/) |
| `criterion-plot` | 0.5.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/criterion-plot-0.5.0/) |
| `crossbeam-channel` | 0.5.14 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crossbeam-channel-0.5.14/) |
| `crossbeam-deque` | 0.8.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crossbeam-deque-0.8.6/) |
| `crossbeam-epoch` | 0.9.18 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crossbeam-epoch-0.9.18/) |
| `crossbeam-utils` | 0.8.21 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/crossbeam-utils-0.8.21/) |
| `crunchy` | 0.2.4 | MIT | [目录](third_party/licenses/cargo/crunchy-0.2.4/) |
| `cssparser` | 0.37.0 | MPL-2.0 | [目录](third_party/licenses/cargo/cssparser-0.37.0/) |
| `cssparser-color` | 0.5.0 | MPL-2.0 | [目录](third_party/licenses/cargo/cssparser-color-0.5.0/) |
| `cssparser-macros` | 0.7.0 | MPL-2.0 | [目录](third_party/licenses/cargo/cssparser-macros-0.7.0/) |
| `ctor` | 0.2.9 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/ctor-0.2.9/) |
| `dashmap` | 5.5.3 | MIT | [目录](third_party/licenses/cargo/dashmap-5.5.3/) |
| `data-encoding` | 2.6.0 | MIT | [目录](third_party/licenses/cargo/data-encoding-2.6.0/) |
| `data-url` | 0.1.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/data-url-0.1.1/) |
| `diff` | 0.1.13 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/diff-0.1.13/) |
| `difflib` | 0.4.0 | MIT | [目录](third_party/licenses/cargo/difflib-0.4.0/) |
| `doc-comment` | 0.3.3 | MIT | [目录](third_party/licenses/cargo/doc-comment-0.3.3/) |
| `dtoa` | 1.0.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/dtoa-1.0.9/) |
| `dtoa-short` | 0.3.5 | MPL-2.0 | [目录](third_party/licenses/cargo/dtoa-short-0.3.5/) |
| `dyn-clone` | 1.0.17 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/dyn-clone-1.0.17/) |
| `either` | 1.13.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/either-1.13.0/) |
| `equivalent` | 1.0.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/equivalent-1.0.1/) |
| `errno` | 0.3.10 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/errno-0.3.10/) |
| `fastrand` | 2.3.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/fastrand-2.3.0/) |
| `float-cmp` | 0.9.0 | MIT | [目录](third_party/licenses/cargo/float-cmp-0.9.0/) |
| `fs_extra` | 1.3.0 | MIT | [目录](third_party/licenses/cargo/fs_extra-1.3.0/) |
| `funty` | 2.0.0 | MIT | [目录](third_party/licenses/cargo/funty-2.0.0/) |
| `getrandom` | 0.2.15 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/getrandom-0.2.15/) |
| `getrandom` | 0.3.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/getrandom-0.3.3/) |
| `glob` | 0.3.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/glob-0.3.3/) |
| `globset` | 0.4.15 | Unlicense OR MIT | [目录](third_party/licenses/cargo/globset-0.4.15/) |
| `globwalk` | 0.9.1 | MIT | [目录](third_party/licenses/cargo/globwalk-0.9.1/) |
| `half` | 2.7.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/half-2.7.1/) |
| `hashbrown` | 0.12.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashbrown-0.12.3/) |
| `hashbrown` | 0.14.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashbrown-0.14.5/) |
| `hashbrown` | 0.15.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hashbrown-0.15.2/) |
| `heck` | 0.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/heck-0.4.1/) |
| `hermit-abi` | 0.1.19 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/hermit-abi-0.1.19/) |
| `hermit-abi` | 0.5.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/hermit-abi-0.5.2/) |
| `iana-time-zone` | 0.1.61 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/iana-time-zone-0.1.61/) |
| `iana-time-zone-haiku` | 0.1.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/iana-time-zone-haiku-0.1.2/) |
| `ignore` | 0.4.23 | Unlicense OR MIT | [目录](third_party/licenses/cargo/ignore-0.4.23/) |
| `indexmap` | 1.9.3 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/indexmap-1.9.3/) |
| `indexmap` | 2.7.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/indexmap-2.7.0/) |
| `indoc` | 1.0.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/indoc-1.0.9/) |
| `is-terminal` | 0.4.17 | MIT | [目录](third_party/licenses/cargo/is-terminal-0.4.17/) |
| `itertools` | 0.10.5 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/itertools-0.10.5/) |
| `itertools` | 0.13.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/itertools-0.13.0/) |
| `itoa` | 1.0.14 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/itoa-1.0.14/) |
| `jemalloc-sys` | 0.3.2 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/jemalloc-sys-0.3.2/) |
| `jemallocator` | 0.3.2 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/jemallocator-0.3.2/) |
| `js-sys` | 0.3.76 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/js-sys-0.3.76/) |
| `lazy_static` | 1.5.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/lazy_static-1.5.0/) |
| `libc` | 0.2.186 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/libc-0.2.186/) |
| `libloading` | 0.8.6 | ISC | [目录](third_party/licenses/cargo/libloading-0.8.6/) |
| `linux-raw-sys` | 0.4.14 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/linux-raw-sys-0.4.14/) |
| `lock_api` | 0.4.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/lock_api-0.4.12/) |
| `log` | 0.4.22 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/log-0.4.22/) |
| `matches` | 0.1.10 | MIT | [目录](third_party/licenses/cargo/matches-0.1.10/) |
| `memchr` | 2.7.4 | Unlicense OR MIT | [目录](third_party/licenses/cargo/memchr-2.7.4/) |
| `minimal-lexical` | 0.2.1 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/minimal-lexical-0.2.1/) |
| `napi` | 2.16.13 | MIT | [目录](third_party/licenses/cargo/napi-2.16.13/) |
| `napi-build` | 1.2.1 | MIT | [目录](third_party/licenses/cargo/napi-build-1.2.1/) |
| `napi-derive` | 2.16.13 | MIT | [目录](third_party/licenses/cargo/napi-derive-2.16.13/) |
| `napi-derive-backend` | 1.0.75 | MIT | [目录](third_party/licenses/cargo/napi-derive-backend-1.0.75/) |
| `napi-sys` | 2.4.0 | MIT | [目录](third_party/licenses/cargo/napi-sys-2.4.0/) |
| `nix` | 0.31.3 | MIT | [目录](third_party/licenses/cargo/nix-0.31.3/) |
| `nom` | 7.1.3 | MIT | [目录](third_party/licenses/cargo/nom-7.1.3/) |
| `normalize-line-endings` | 0.3.0 | Apache-2.0 | [目录](third_party/licenses/cargo/normalize-line-endings-0.3.0/) |
| `num-traits` | 0.2.19 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/num-traits-0.2.19/) |
| `once_cell` | 1.20.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/once_cell-1.20.2/) |
| `oorandom` | 11.1.5 | MIT | [目录](third_party/licenses/cargo/oorandom-11.1.5/) |
| `os_str_bytes` | 6.6.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/os_str_bytes-6.6.1/) |
| `outref` | 0.1.0 | MIT | [目录](third_party/licenses/cargo/outref-0.1.0/) |
| `parcel_sourcemap` | 2.1.1 | MIT | [目录](third_party/licenses/cargo/parcel_sourcemap-2.1.1/) |
| `parking_lot_core` | 0.9.10 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/parking_lot_core-0.9.10/) |
| `pastey` | 0.1.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/pastey-0.1.0/) |
| `pathdiff` | 0.2.3 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/pathdiff-0.2.3/) |
| `phf` | 0.11.2 | MIT | [目录](third_party/licenses/cargo/phf-0.11.2/) |
| `phf` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf-0.13.1/) |
| `phf_codegen` | 0.11.2 | MIT | [目录](third_party/licenses/cargo/phf_codegen-0.11.2/) |
| `phf_generator` | 0.11.2 | MIT | [目录](third_party/licenses/cargo/phf_generator-0.11.2/) |
| `phf_generator` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_generator-0.13.1/) |
| `phf_macros` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_macros-0.13.1/) |
| `phf_shared` | 0.11.2 | MIT | [目录](third_party/licenses/cargo/phf_shared-0.11.2/) |
| `phf_shared` | 0.13.1 | MIT | [目录](third_party/licenses/cargo/phf_shared-0.13.1/) |
| `plotters` | 0.3.7 | MIT | [目录](third_party/licenses/cargo/plotters-0.3.7/) |
| `plotters-backend` | 0.3.7 | MIT | [目录](third_party/licenses/cargo/plotters-backend-0.3.7/) |
| `plotters-svg` | 0.3.7 | MIT | [目录](third_party/licenses/cargo/plotters-svg-0.3.7/) |
| `precomputed-hash` | 0.1.1 | MIT | [目录](third_party/licenses/cargo/precomputed-hash-0.1.1/) |
| `predicates` | 2.1.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/predicates-2.1.5/) |
| `predicates` | 3.1.3 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/predicates-3.1.3/) |
| `predicates-core` | 1.0.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/predicates-core-1.0.9/) |
| `predicates-tree` | 1.0.12 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/predicates-tree-1.0.12/) |
| `pretty_assertions` | 1.4.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/pretty_assertions-1.4.1/) |
| `proc-macro-error` | 1.0.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-error-1.0.4/) |
| `proc-macro-error-attr` | 1.0.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro-error-attr-1.0.4/) |
| `proc-macro2` | 1.0.106 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/proc-macro2-1.0.106/) |
| `ptr_meta` | 0.1.4 | MIT | [目录](third_party/licenses/cargo/ptr_meta-0.1.4/) |
| `ptr_meta_derive` | 0.1.4 | MIT | [目录](third_party/licenses/cargo/ptr_meta_derive-0.1.4/) |
| `quote` | 1.0.37 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/quote-1.0.37/) |
| `r-efi` | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later | [目录](third_party/licenses/cargo/r-efi-5.3.0/) |
| `radium` | 0.7.0 | MIT | [目录](third_party/licenses/cargo/radium-0.7.0/) |
| `rand` | 0.8.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rand-0.8.5/) |
| `rand_core` | 0.6.4 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rand_core-0.6.4/) |
| `rayon` | 1.10.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rayon-1.10.0/) |
| `rayon-core` | 1.12.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/rayon-core-1.12.1/) |
| `redox_syscall` | 0.5.8 | MIT | [目录](third_party/licenses/cargo/redox_syscall-0.5.8/) |
| `regex` | 1.11.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/regex-1.11.1/) |
| `regex-automata` | 0.4.9 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/regex-automata-0.4.9/) |
| `regex-syntax` | 0.8.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/regex-syntax-0.8.5/) |
| `rend` | 0.4.2 | MIT | [目录](third_party/licenses/cargo/rend-0.4.2/) |
| `rkyv` | 0.7.45 | MIT | [目录](third_party/licenses/cargo/rkyv-0.7.45/) |
| `rkyv_derive` | 0.7.45 | MIT | [目录](third_party/licenses/cargo/rkyv_derive-0.7.45/) |
| `rustc-hash` | 2.1.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/rustc-hash-2.1.0/) |
| `rustix` | 0.38.42 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/rustix-0.38.42/) |
| `same-file` | 1.0.6 | Unlicense/MIT | [目录](third_party/licenses/cargo/same-file-1.0.6/) |
| `schemars` | 0.8.21 | MIT | [目录](third_party/licenses/cargo/schemars-0.8.21/) |
| `schemars_derive` | 0.8.21 | MIT | [目录](third_party/licenses/cargo/schemars_derive-0.8.21/) |
| `scopeguard` | 1.2.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/scopeguard-1.2.0/) |
| `seahash` | 4.1.0 | MIT | [目录](third_party/licenses/cargo/seahash-4.1.0/) |
| `semver` | 1.0.24 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/semver-1.0.24/) |
| `serde` | 1.0.228 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde-1.0.228/) |
| `serde-content` | 0.1.2 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/serde-content-0.1.2/) |
| `serde-detach` | 0.0.1 | MPL-2.0 | [目录](third_party/licenses/cargo/serde-detach-0.0.1/) |
| `serde_bytes` | 0.11.15 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_bytes-0.11.15/) |
| `serde_core` | 1.0.228 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_core-1.0.228/) |
| `serde_derive` | 1.0.228 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_derive-1.0.228/) |
| `serde_derive_internals` | 0.29.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_derive_internals-0.29.1/) |
| `serde_json` | 1.0.149 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/serde_json-1.0.149/) |
| `shlex` | 1.3.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/shlex-1.3.0/) |
| `simd-abstraction` | 0.7.1 | MIT | [目录](third_party/licenses/cargo/simd-abstraction-0.7.1/) |
| `simdutf8` | 0.1.5 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/simdutf8-0.1.5/) |
| `siphasher` | 0.3.11 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/siphasher-0.3.11/) |
| `siphasher` | 1.0.2 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/siphasher-1.0.2/) |
| `smallvec` | 1.13.2 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/smallvec-1.13.2/) |
| `statrs` | 0.18.0 | MIT | [目录](third_party/licenses/cargo/statrs-0.18.0/) |
| `strsim` | 0.10.0 | MIT | [目录](third_party/licenses/cargo/strsim-0.10.0/) |
| `syn` | 1.0.109 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/syn-1.0.109/) |
| `syn` | 2.0.90 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/syn-2.0.90/) |
| `tap` | 1.0.1 | MIT | [目录](third_party/licenses/cargo/tap-1.0.1/) |
| `tempfile` | 3.14.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/tempfile-3.14.0/) |
| `termcolor` | 1.4.1 | Unlicense OR MIT | [目录](third_party/licenses/cargo/termcolor-1.4.1/) |
| `termtree` | 0.5.1 | MIT | [目录](third_party/licenses/cargo/termtree-0.5.1/) |
| `textwrap` | 0.16.1 | MIT | [目录](third_party/licenses/cargo/textwrap-0.16.1/) |
| `thiserror` | 1.0.69 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/thiserror-1.0.69/) |
| `thiserror-impl` | 1.0.69 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/thiserror-impl-1.0.69/) |
| `tinytemplate` | 1.2.1 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tinytemplate-1.2.1/) |
| `tinyvec` | 1.8.1 | Zlib OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/tinyvec-1.8.1/) |
| `tinyvec_macros` | 0.1.1 | MIT OR Apache-2.0 OR Zlib | [目录](third_party/licenses/cargo/tinyvec_macros-0.1.1/) |
| `toml` | 0.5.11 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/toml-0.5.11/) |
| `unicode-ident` | 1.0.14 | (MIT OR Apache-2.0) AND Unicode-3.0 | [目录](third_party/licenses/cargo/unicode-ident-1.0.14/) |
| `unicode-segmentation` | 1.12.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/unicode-segmentation-1.12.0/) |
| `uuid` | 1.11.0 | Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/uuid-1.11.0/) |
| `version_check` | 0.9.5 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/version_check-0.9.5/) |
| `vlq` | 0.5.1 | Apache-2.0/MIT | [目录](third_party/licenses/cargo/vlq-0.5.1/) |
| `wait-timeout` | 0.2.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/wait-timeout-0.2.0/) |
| `walkdir` | 2.5.0 | Unlicense/MIT | [目录](third_party/licenses/cargo/walkdir-2.5.0/) |
| `wasi` | 0.11.0+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wasi-0.11.0+wasi-snapshot-preview1/) |
| `wasi` | 0.14.2+wasi-0.2.4 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wasi-0.14.2+wasi-0.2.4/) |
| `wasm-bindgen` | 0.2.99 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-0.2.99/) |
| `wasm-bindgen-backend` | 0.2.99 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-backend-0.2.99/) |
| `wasm-bindgen-macro` | 0.2.99 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-macro-0.2.99/) |
| `wasm-bindgen-macro-support` | 0.2.99 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-macro-support-0.2.99/) |
| `wasm-bindgen-shared` | 0.2.99 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/wasm-bindgen-shared-0.2.99/) |
| `web-sys` | 0.3.76 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/web-sys-0.3.76/) |
| `winapi` | 0.3.9 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/winapi-0.3.9/) |
| `winapi-i686-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/winapi-i686-pc-windows-gnu-0.4.0/) |
| `winapi-util` | 0.1.9 | Unlicense OR MIT | [目录](third_party/licenses/cargo/winapi-util-0.1.9/) |
| `winapi-x86_64-pc-windows-gnu` | 0.4.0 | MIT/Apache-2.0 | [目录](third_party/licenses/cargo/winapi-x86_64-pc-windows-gnu-0.4.0/) |
| `windows-core` | 0.52.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-core-0.52.0/) |
| `windows-sys` | 0.59.0 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-sys-0.59.0/) |
| `windows-targets` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows-targets-0.52.6/) |
| `windows_aarch64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_aarch64_gnullvm-0.52.6/) |
| `windows_aarch64_msvc` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_aarch64_msvc-0.52.6/) |
| `windows_i686_gnu` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_gnu-0.52.6/) |
| `windows_i686_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_gnullvm-0.52.6/) |
| `windows_i686_msvc` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_i686_msvc-0.52.6/) |
| `windows_x86_64_gnu` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_gnu-0.52.6/) |
| `windows_x86_64_gnullvm` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_gnullvm-0.52.6/) |
| `windows_x86_64_msvc` | 0.52.6 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/windows_x86_64_msvc-0.52.6/) |
| `wit-bindgen-rt` | 0.39.0 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/wit-bindgen-rt-0.39.0/) |
| `wyz` | 0.2.0 | MIT | [目录](third_party/licenses/cargo/wyz-0.2.0/) |
| `wyz` | 0.5.1 | MIT | [目录](third_party/licenses/cargo/wyz-0.5.1/) |
| `yansi` | 1.0.1 | MIT OR Apache-2.0 | [目录](third_party/licenses/cargo/yansi-1.0.1/) |
| `zerocopy` | 0.8.26 | BSD-2-Clause OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/zerocopy-0.8.26/) |
| `zerocopy-derive` | 0.8.26 | BSD-2-Clause OR Apache-2.0 OR MIT | [目录](third_party/licenses/cargo/zerocopy-derive-0.8.26/) |
| `zmij` | 1.0.21 | MIT | [目录](third_party/licenses/cargo/zmij-1.0.21/) |
