# comm-scope

面向开发者的 **Serial / TCP / UDP** 流量监控器。实时查看、过滤、录制、回放与搜索字节级通信 —— 当前为 CLI 工具，并为将来的 GUI 预留了清晰的分层边界。

[English](README.md)

[![Node.js](https://img.shields.io/badge/node.js-%3E%3D20-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

```
$ comm-scope monitor tcp-listen:9000
# monitoring tcp-listen:9000

11:42:15.203  rx  [127.0.0.1:52114]  47 45 54 20 2f 20 48 54 54 50 2f 31 2e 31 0d 0a  | GET / HTTP/1.1\r\n |
11:42:15.204  tx  [127.0.0.1:52114]  48 54 54 50 2f 31 2e 31 20 32 30 30 20 4f 4b     | HTTP/1.1 200 OK    |
11:42:15.301  rx  [127.0.0.1:52114]  7b 22 6f 6b 22 3a 74 72 75 65 7d                 | {"ok":true}        |
```

## 目录

- [为什么需要 comm-scope](#为什么需要-comm-scope)
- [特性](#特性)
- [安装](#安装)
- [快速上手](#快速上手)
- [使用](#使用)
  - [传输描述符](#传输描述符)
  - [命令概览](#命令概览)
  - [选项参考](#选项参考)
- [示例](#示例)
- [与其他工具对比](#与其他工具对比)
- [录制格式](#录制格式)
- [架构](#架构)
- [开发](#开发)
- [路线图与限制](#路线图与限制)
- [常见问题](#常见问题)
- [许可证](#许可证)

## 为什么需要 comm-scope

调试串口设备或 socket 服务时，往往要拼凑一堆单一用途的工具（`socat`、`tio`、`nc`、`tcpdump`……），但没有任何一个能覆盖「观察 → 采集 → 搜索 → 复现」的完整闭环。comm-scope 用一套 spec 语法把这个闭环装进一个工具：

- Serial、TCP、UDP 一个命令行搞定 —— `serial:COM3:115200`、`tcp-listen:9000`、`udp-listen:9999`。
- 带方向（`rx`/`tx`）和时间戳，能看清「谁在什么时候说了什么」。
- 完整闭环：`record` → `view` → `search` → `replay` 作用于同一条字节流。
- 录制是可读、可 grep 的 JSON Lines，而不是晦涩的 pcap/二进制转储。
- 核心引擎零展示依赖，将来加 GUI（Electron/Tauri）无需改动引擎。

## 特性

- **三种传输、一套接口** —— Serial、TCP（客户端/服务端）、UDP（发送/监听）统一在一个 `Transport` 抽象下。
- **实时监控** —— 流式彩色 hex+ASCII 输出（可管道），或交互式 `--tui` 面板。
- **过滤** —— 按字面字符串、hex 字节序列、正则或方向过滤。
- **录制** —— 无头采集到 JSON Lines。
- **离线回看** —— 按原始时序重放录制（`--speed` 缩放）。
- **线上重放** —— 把录制的字节按原时序重发到 Serial/TCP/UDP 目标，复现问题。
- **搜索** —— 带上下文检索录制，条件与实时过滤一致。
- **分析** —— 分方向的字节数/包数与速率统计。
- **零配置** —— TCP/UDP 用 Node 内置模块；仅 Serial 依赖 `serialport` 原生二进制。

## 安装

需要 **Node.js ≥ 20**。

### 通过 npm（推荐）

```bash
npm install -g comm-scope
comm-scope --help
```

### 从源码安装

```bash
git clone https://github.com/<you>/comm-scope
cd comm-scope
npm install        # 安装 workspace 依赖（含 serialport 原生二进制）
npm run build      # 构建 core + cli
npm link           # 把本地构建注册为 `comm-scope`
```

不 link 也可直接运行构建产物：

```bash
node packages/cli/dist/index.js --help
```

> **Windows 注意：** `serialport` 为常见平台提供预编译二进制，`npm install` 通常开箱即用。若在无预编译二进制的平台上构建，需要常规原生工具链（Visual Studio Build Tools + Python）。

## 快速上手

UDP 回环 —— 无需硬件，开两个终端：

```bash
# 终端 1 —— 监听
comm-scope monitor udp-listen:9999
```

```bash
# 终端 2 —— 发一个包
node -e "const d=require('dgram').createSocket('udp4'); d.send(Buffer.from('hello'),9999,'127.0.0.1',()=>d.close())"
```

终端 1 立刻打印：

```
11:42:15.203  rx  [127.0.0.1:52114]  68 65 6c 6c 6f  | hello |
```

五条命令走完完整闭环：

```bash
comm-scope record  serial:COM3:115200 --out session.jsonl   # 1. 采集
comm-scope view    session.jsonl --speed 2                  # 2. 离线回看
comm-scope search  session.jsonl --regex "AT\+" -C 2        # 3. 找到关键片段
comm-scope replay  session.jsonl --to serial:COM3           # 4. 在设备上复现
comm-scope monitor serial:COM3 --tui                        # 5. 交互式实时观察
```

## 使用

### 传输描述符

`monitor` 和 `record` 用一个 spec 字符串描述传输，`replay --to` 亦复用：

| 形式 | 含义 |
|---|---|
| `serial:PORT[:BAUD]` | 串口，如 `serial:COM3:115200`（波特率默认 115200） |
| `tcp:HOST:PORT` | 作为客户端连接远端 |
| `tcp-listen:PORT` | 监听端口，接受多个客户端 |
| `udp:HOST:PORT` | 发往指定对端（并接收其回包） |
| `udp-listen:PORT` | 绑定本地端口，接收任意来源 |

监听类也可绑定指定地址：`tcp-listen:127.0.0.1:9000`、`udp-listen:0.0.0.0:9999`。支持方括号 IPv6：`tcp:[::1]:9000`。

### 命令概览

| 命令 | 用途 |
|---|---|
| `monitor <spec>` | 实时监控（流式或 `--tui`） |
| `record <spec> --out <file>` | 无头采集 |
| `view <file>` | 按原始时序离线回放 |
| `search <file>` | 带上下文检索录制 |
| `replay <file> --to <spec>` | 把录制字节重发到目标 |
| `list-serial` | 枚举串口 |

所有命令都支持 `--help` 查看完整选项。

### 选项参考

**`monitor`**

| 选项 | 说明 |
|---|---|
| `--format <hex\|ascii\|raw>` | 输出格式（默认 `hex`） |
| `--no-timestamp` | 省略时间戳 |
| `--no-color` | 关闭 ANSI 颜色 |
| `--string <s>` | 仅显示含该 UTF-8 子串的事件 |
| `--hex <h>` | 仅显示含该 hex 字节序列的事件 |
| `--regex <re>` | 仅显示 UTF-8 文本匹配该正则的事件 |
| `--dir <rx\|tx>` | 仅显示某一方向 |
| `--record <file>` | 监控的同时录制 |
| `--stats` | 退出时输出字节/包数/速率统计 |
| `--timeout <s>` | N 秒后自动停止 |
| `--tui` | 交互式面板（`q` 退出） |

**`record`**

| 选项 | 说明 |
|---|---|
| `--out <file>` | 输出文件（必填） |
| `--string <s>` / `--hex <h>` / `--regex <re>` | 过滤要录制的内容 |
| `--dir <rx\|tx>` | 仅录制某一方向 |
| `--stats` | 退出时输出统计 |

**`view`**

| 选项 | 说明 |
|---|---|
| `--speed <n>` | 回放速度倍率（默认 `1`，`0` = 最快） |
| `--format <hex\|ascii\|raw>` | 输出格式 |
| `--no-timestamp` / `--no-color` | 输出控制 |
| `--dir <rx\|tx>` | 仅显示某一方向 |
| `--tui` | 交互式面板 |

**`search`**

| 选项 | 说明 |
|---|---|
| `--string <s>` / `--hex <h>` / `--regex <re>` | 匹配条件（至少一个） |
| `--dir <rx\|tx>` | 限定某一方向 |
| `-C, --context <n>` | 命中前后的上下文事件数（默认 `2`） |
| `--no-timestamp` / `--no-color` | 输出控制 |

**`replay`**

| 选项 | 说明 |
|---|---|
| `--to <spec>` | 目标传输（必填） |
| `--speed <n>` | 回放速度倍率（默认 `1`，`0` = 最快） |
| `--dir <rx\|tx>` | 仅重放某一方向（默认：全部、按时间序） |
| `--loop` | 持续循环重发，直到 `Ctrl-C` |

## 示例

**串口 —— 观察设备上电过程**

```bash
comm-scope monitor serial:COM3:115200 --record boot.jsonl --stats
```

**TCP —— 抓取线上的 REST API**

```bash
comm-scope monitor tcp-listen:9000 --string "HTTP/1.1" --format ascii
```

**从嘈杂协议里过滤出关心的帧**

```bash
comm-scope monitor serial:COM3 --hex "aa bb cc"     # 只保留带该帧头的帧
comm-scope monitor udp-listen:9999 --dir tx          # 只看发送方向
```

**采集一次故障，然后复现它**

```bash
comm-scope record  udp-listen:9999 --out issue.jsonl
comm-scope search  issue.jsonl --string "ERR" -C 5
comm-scope replay  issue.jsonl --to udp:10.0.0.5:9999 --speed 1
```

**压测用的持续负载**

```bash
comm-scope replay issue.jsonl --to serial:COM3 --loop
```

## 与其他工具对比

| 工具 | 擅长 | comm-scope 的差异 |
|---|---|---|
| `socat` | 通用端点转发 | comm-scope 是*观察*流量（带时间戳与方向），而非转发；并增加录制/回放/搜索 |
| `tio` / `picocom` / `minicom` | 交互式串口终端 | 它们是带行编辑的终端；comm-scope 是被动监控，输出 hex+ASCII、时间戳与采集 |
| `tcpdump` / `ngrep` | 包级网络抓包 | 基于 pcap、面向数据包；comm-scope 面向字节*流*（Serial + TCP + UDP），无需 libpcap、无需 root |
| `Wireshark` / `termshark` | 深度协议分析 | 协议解析器与 GUI；comm-scope 是轻量、可脚本化的 CLI，聚焦采集→回放闭环 |
| `candump` / `slcan-utils` | CAN 总线 | comm-scope 不针对 CAN |

comm-scope 不是包解析器的替代品，而是「线上的示波器」—— 一个字节级、带方向的监控器，配有完整的采集/回放工作流。

## 录制格式

JSON Lines：首行是 header，之后每行一个事件。payload 为小写 hex，二进制数据无损往返，文件保持可 grep。

```
{"comm-scope":1,"kind":"udp-listen","id":"udp-listen:9999","desc":"udp-listen:9999","started":1693300000000}
{"t":1693300000123,"dir":"rx","kind":"udp-listen","id":"127.0.0.1:50936","desc":"udp-listen:0.0.0.0:9999","enc":"hex","data":"68656c6c6f"}
```

**Header 字段**

| 字段 | 含义 |
|---|---|
| `comm-scope` | 魔法键 + schema 版本 |
| `kind` | 传输类型 |
| `id` / `desc` | 传输标识 / 规范 spec |
| `started` | 会话开始时间（epoch ms） |

**事件字段**

| 字段 | 含义 |
|---|---|
| `t` | 事件时间（epoch ms） |
| `dir` | `rx` 或 `tx` |
| `kind` / `id` / `desc` | 传输元数据（监听类为对端） |
| `enc` | payload 编码（当前为 `hex`） |
| `data` | hex 编码的 payload |

## 架构

npm workspace，两层：

- **`packages/core`**（`@comm-scope/core`）—— 无任何展示依赖的引擎：
  - `transport/`：Serial/TCP/UDP 传输抽象（`Transport` 接口 + spec 解析）
  - `source/`：`DataSource` 接口（实时传输与 `FileSource` 回放共用）
  - `sink/`：渲染、录制、统计、过滤都是 `Sink`，可任意组合
  - `replay/`：时序引擎 + 线上重发
  - `format/`：hexdump、JSONL 编解码
- **`packages/cli`**（`@comm-scope/cli`）—— commander 前端 + 流式渲染器 + neo-blessed TUI

```
DataSource ── TrafficEvent ──► [filter] ──► [Sink: stream renderer]
                                            [Sink: TUI dashboard]
                                            [Sink: JSONL recorder]
                                            [Sink: analyzer]
```

实时传输与录制文件实现同一个 `DataSource`，因此 `view` 与 `monitor` 行为完全一致。

**GUI 扩展路径**：GUI 只需依赖 `@comm-scope/core`，用同一个 `DataSource`/`Sink` 接口实现新的 `Sink`（Electron/Tauri 表格视图），录制格式、回放时序、传输抽象全部复用，无需改动 core。

## 开发

```bash
npm install        # 安装依赖
npm run build      # 构建 core + cli（tsup）
npm test           # vitest
npm run test:watch # 监听模式
npm run typecheck  # tsc --noEmit 全包类型检查
npm run dev -- <args>   # 用 tsx 跑 CLI（需先构建 core）
```

### 目录结构

```
packages/core/src/
  event/       # TrafficEvent / TransportMeta 类型、TrafficBus
  transport/   # Transport 接口 + tcp / udp / serial + factory（spec 解析）
  source/      # DataSource 接口 + FileSource（离线回放）
  sink/        # Sink 接口 + filter / analyzer / recorder
  replay/      # 时序引擎 + 线上重发
  format/      # hexdump + JSONL 编解码
  session.ts   # 把 DataSource 接到 sinks
packages/cli/src/
  commands/    # monitor / record / view / search / replay / list-serial
  render/      # 流式渲染器、TUI、共享行格式化、统计
```

### 添加一种传输

1. 实现 `Transport` 接口 —— 继承 `TrafficBus`，实现 `start()`、`stop()`、`send()`，把字节以 `TrafficEvent` 的形式 `emit('data', ...)` 出去。
2. 在 `transport/factory.ts` 中新增一个 spec 方案及其解析（`parseSpec` / `toDesc` / `createTransport`）。
3. 在 `core/src/index.ts` 导出。完成 —— `monitor`/`record`/`replay` 会自动支持。

### 约定

- `core` **不包含**任何展示依赖 —— 没有终端/颜色代码，渲染都在 `cli`。
- 纯函数（`hexdump`、JSONL 编解码、spec 解析）在 `packages/core/test/` 下有单元测试覆盖。

## 路线图与限制

**当前已知限制**

- 实时过滤和 `search` 是**按事件**匹配；跨事件边界的模式（如被串口读拆成两段的帧）不会重组。流式搜索已列入计划。
- 时间戳为毫秒精度；子毫秒增量（`dt`）是可能的未来字段。
- TUI 是轻量面板（滚动日志 + 统计），暂无面板内搜索或过滤。
- `tcp-listen` 重放会发给所有已连接客户端（暂无按对端定向）。

**路线图**

- 流重组 / 跨事件模式匹配
- 面板内搜索与过滤
- 更多录制编码（base64、原始二进制）与 pcap 导出
- 基于 `@comm-scope/core` 的 GUI 前端（Electron/Tauri）

## 常见问题

**`bind EADDRINUSE`** —— 端口已被占用（常是上次运行的进程还活着）。换个端口，或先释放它。

**串口没列出 / `Access denied`（Windows）** —— 端口可能被终端软件或驱动占用。用 `comm-scope list-serial` 确认，关闭其它程序，并核对端口名（COM10 以上需 `\\.\COM10` —— comm-scope 会原样透传端口名，请使用 `list-serial` 报告的准确名称）。

**`npm install` 后 `serialport` 加载失败** —— 你的平台没有预编译二进制。安装原生构建工具链后运行 `npm rebuild serialport`。

**管道输出时退出摘要不见了** —— 数据走 stdout，横幅/统计走 stderr。想要完整记录请同时重定向两者：`... > out.txt 2> err.txt`。

## 许可证

[MIT](LICENSE) © 2026 comm-scope contributors
