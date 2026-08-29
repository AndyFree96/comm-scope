# comm-scope

A developer-focused traffic monitor for **Serial / TCP / UDP**. Watch, filter, record, replay and search byte-level communication in real time — as a CLI today, with a clean seam for a future GUI.

[中文说明](README.zh-CN.md)

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

## Table of contents

- [comm-scope](#comm-scope)
  - [Table of contents](#table-of-contents)
  - [Why comm-scope](#why-comm-scope)
  - [Features](#features)
  - [Installation](#installation)
    - [From npm (recommended)](#from-npm-recommended)
    - [From source](#from-source)
  - [Quick start](#quick-start)
  - [Usage](#usage)
    - [Transport spec](#transport-spec)
    - [Command overview](#command-overview)
    - [Option reference](#option-reference)
  - [Examples](#examples)
  - [Comparison with other tools](#comparison-with-other-tools)
  - [Recording format](#recording-format)
  - [Architecture](#architecture)
  - [Development](#development)
    - [Project layout](#project-layout)
    - [Adding a transport](#adding-a-transport)
    - [Conventions](#conventions)
  - [Roadmap \& limitations](#roadmap--limitations)
  - [Troubleshooting](#troubleshooting)
  - [License](#license)

## Why comm-scope

Debugging a device on a serial port or a service on a socket usually means reaching for a grab-bag of single-purpose tools (`socat`, `tio`, `nc`, `tcpdump`, …), none of which covers the full loop of _observe → capture → search → reproduce_. comm-scope brings that loop into one tool with a single spec syntax:

- One command line for Serial, TCP and UDP — `serial:COM3:115200`, `tcp-listen:9000`, `udp-listen:9999`.
- Direction-aware (`rx`/`tx`) with timestamps, so you can see _who said what when_.
- A full round-trip: `record` → `view` → `search` → `replay` on the exact same byte stream.
- Human-readable, greppable recordings (JSON Lines) instead of opaque pcap/binary dumps.
- A presentation-free core, so a GUI (Electron/Tauri) can be added later without touching the engine.

## Features

- **Three transports, one interface** — Serial, TCP (client/server) and UDP (send/listen) behind a single `Transport` abstraction.
- **Live monitor** — streaming colored hex+ASCII output (pipeable), or an interactive `--tui` dashboard.
- **Filtering** — by literal string, hex byte sequence, regex, or direction.
- **Recording** — headless capture to JSON Lines.
- **Offline replay** — play a recording back at the original timing (`--speed` to scale).
- **Online replay** — re-send recorded bytes to a Serial/TCP/UDP target to reproduce issues.
- **Search** — grep a recording with context, on the same criteria as live filtering.
- **Analysis** — per-direction byte/packet counters and rates.
- **Zero-config** — TCP/UDP use Node built-ins; only Serial pulls in the `serialport` native binding.

## Installation

Requires **Node.js ≥ 20**.

### From npm (recommended)

```bash
npm install -g comm-scope
comm-scope --help
```

### From source

```bash
git clone https://github.com/AndyFree96/comm-scope
cd comm-scope
npm install        # installs workspaces (incl. the serialport native binding)
npm run build      # builds core + cli
npm link           # links the local build as `comm-scope`
```

Or run the built CLI directly, without linking:

```bash
node packages/cli/dist/index.js --help
```

> **Windows note:** `serialport` ships prebuilt binaries for common platforms, so `npm install` should work out of the box. If you build for a platform without a prebuilt binary, you'll need the usual native toolchain (Visual Studio Build Tools + Python).

## Quick start

UDP loopback — no hardware required. Two terminals:

```bash
# terminal 1 — listen
comm-scope monitor udp-listen:9999
```

```bash
# terminal 2 — send a packet
node -e "const d=require('dgram').createSocket('udp4'); d.send(Buffer.from('hello'),9999,'127.0.0.1',()=>d.close())"
```

Terminal 1 immediately prints:

```
11:42:15.203  rx  [127.0.0.1:52114]  68 65 6c 6c 6f  | hello |
```

The full loop in five commands:

```bash
comm-scope record  serial:COM3:115200 --out session.jsonl   # 1. capture
comm-scope view    session.jsonl --speed 2                  # 2. replay offline
comm-scope search  session.jsonl --regex "AT\+" -C 2        # 3. find the interesting part
comm-scope replay  session.jsonl --to serial:COM3           # 4. reproduce on the device
comm-scope monitor serial:COM3 --tui                        # 5. watch live, interactively
```

## Usage

### Transport spec

`monitor` and `record` take a single spec string; `replay --to` reuses it:

| Spec                 | Meaning                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `serial:PORT[:BAUD]` | Serial port, e.g. `serial:COM3:115200` (baud defaults to 115200) |
| `tcp:HOST:PORT`      | Connect out as a client                                          |
| `tcp-listen:PORT`    | Listen and accept multiple clients                               |
| `udp:HOST:PORT`      | Send to a peer (and receive its replies)                         |
| `udp-listen:PORT`    | Bind locally and receive from anyone                             |

Listeners may also bind a specific address: `tcp-listen:127.0.0.1:9000`, `udp-listen:0.0.0.0:9999`. Bracketed IPv6 works: `tcp:[::1]:9000`.

### Command overview

| Command                      | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `monitor <spec>`             | Live monitoring (stream or `--tui`) |
| `record <spec> --out <file>` | Headless capture                    |
| `view <file>`                | Offline playback at original timing |
| `search <file>`              | Search a recording with context     |
| `replay <file> --to <spec>`  | Re-send recorded bytes to a target  |
| `list-serial`                | Enumerate serial ports              |

All commands support `--help` for their full option list.

### Option reference

**`monitor`**

| Option                       | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `--format <hex\|ascii\|raw>` | Output format (default `hex`)                        |
| `--no-timestamp`             | Omit timestamps                                      |
| `--no-color`                 | Disable ANSI colors                                  |
| `--string <s>`               | Only show events containing this UTF-8 substring     |
| `--hex <h>`                  | Only show events containing this hex byte sequence   |
| `--regex <re>`               | Only show events whose UTF-8 text matches this regex |
| `--dir <rx\|tx>`             | Only show one direction                              |
| `--record <file>`            | Also record traffic while monitoring                 |
| `--stats`                    | Print byte/packet/rate statistics on exit            |
| `--timeout <s>`              | Auto-stop after N seconds                            |
| `--tui`                      | Interactive dashboard (`q` to quit)                  |

**`record`**

| Option                                        | Description               |
| --------------------------------------------- | ------------------------- |
| `--out <file>`                                | Output file (required)    |
| `--string <s>` / `--hex <h>` / `--regex <re>` | Filter what gets recorded |
| `--dir <rx\|tx>`                              | Only record one direction |
| `--stats`                                     | Print statistics on exit  |

**`view`**

| Option                          | Description                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| `--speed <n>`                   | Replay speed multiplier (default `1`, `0` = as fast as possible) |
| `--format <hex\|ascii\|raw>`    | Output format                                                    |
| `--no-timestamp` / `--no-color` | Output controls                                                  |
| `--dir <rx\|tx>`                | Only show one direction                                          |
| `--tui`                         | Interactive dashboard                                            |

**`search`**

| Option                                        | Description                                    |
| --------------------------------------------- | ---------------------------------------------- |
| `--string <s>` / `--hex <h>` / `--regex <re>` | Match criteria (at least one required)         |
| `--dir <rx\|tx>`                              | Restrict to one direction                      |
| `-C, --context <n>`                           | Context events around each match (default `2`) |
| `--no-timestamp` / `--no-color`               | Output controls                                |

**`replay`**

| Option           | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `--to <spec>`    | Target transport (required)                             |
| `--speed <n>`    | Replay speed multiplier (default `1`, `0` = max)        |
| `--dir <rx\|tx>` | Only replay one direction (default: all, chronological) |
| `--loop`         | Re-send continuously until `Ctrl-C`                     |

## Examples

**Serial — watch a device boot**

```bash
comm-scope monitor serial:COM3:115200 --record boot.jsonl --stats
```

**TCP — sniff a REST API on the wire**

```bash
comm-scope monitor tcp-listen:9000 --string "HTTP/1.1" --format ascii
```

**Filter a noisy protocol to the frames you care about**

```bash
comm-scope monitor serial:COM3 --hex "aa bb cc"     # only frames with this header
comm-scope monitor udp-listen:9999 --dir tx          # only outgoing
```

**Capture a failure, then reproduce it**

```bash
comm-scope record  udp-listen:9999 --out issue.jsonl
comm-scope search  issue.jsonl --string "ERR" -C 5
comm-scope replay  issue.jsonl --to udp:10.0.0.5:9999 --speed 1
```

**Continuous load for stress testing**

```bash
comm-scope replay issue.jsonl --to serial:COM3 --loop
```

## Comparison with other tools

| Tool                          | Best at                      | How comm-scope differs                                                                                            |
| ----------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `socat`                       | Generic endpoint relaying    | comm-scope _observes_ traffic (timestamps + direction) rather than relaying it; adds record/replay/search         |
| `tio` / `picocom` / `minicom` | Interactive serial terminals | These are terminals with line editing; comm-scope is a passive monitor with hex+ASCII, timestamps and capture     |
| `tcpdump` / `ngrep`           | Packet-level network capture | pcap-based, packet-oriented; comm-scope works on byte _streams_ (Serial + TCP + UDP), no libpcap, no root needed  |
| `Wireshark` / `termshark`     | Deep protocol analysis       | Protocol dissectors and GUIs; comm-scope is a lightweight, scriptable CLI focused on capture → replay round-trips |
| `candump` / `slcan-utils`     | CAN bus                      | comm-scope does not target CAN                                                                                    |

comm-scope is not a substitute for packet dissectors; it is the "scope on the wire" — a byte-level, direction-aware monitor with a complete capture/replay workflow.

## Recording format

JSON Lines: the first line is a header, each following line is one event. Payloads are lowercase hex, so binary data round-trips losslessly and the file stays greppable.

```
{"comm-scope":1,"kind":"udp-listen","id":"udp-listen:9999","desc":"udp-listen:9999","started":1693300000000}
{"t":1693300000123,"dir":"rx","kind":"udp-listen","id":"127.0.0.1:50936","desc":"udp-listen:0.0.0.0:9999","enc":"hex","data":"68656c6c6f"}
```

**Header fields**

| Field         | Meaning                             |
| ------------- | ----------------------------------- |
| `comm-scope`  | Magic key + schema version          |
| `kind`        | Transport kind                      |
| `id` / `desc` | Transport identity / canonical spec |
| `started`     | Session start (epoch ms)            |

**Event fields**

| Field                  | Meaning                                     |
| ---------------------- | ------------------------------------------- |
| `t`                    | Event time (epoch ms)                       |
| `dir`                  | `rx` or `tx`                                |
| `kind` / `id` / `desc` | Transport metadata (per-peer for listeners) |
| `enc`                  | Payload encoding (currently `hex`)          |
| `data`                 | Hex-encoded payload                         |

## Architecture

An npm workspace with two packages:

- **`packages/core`** (`@anthonyfree96/core`) — presentation-free engine:
  - `transport/` — Serial/TCP/UDP transports (`Transport` interface + spec parsing)
  - `source/` — `DataSource` interface, shared by live transports and `FileSource` (offline playback)
  - `sink/` — renderer, recorder, analyzer, filter are all `Sink`s, freely composable
  - `replay/` — timing engine + online re-send
  - `format/` — hexdump and JSONL encode/decode
- **`packages/cli`** (`comm-scope`) — commander frontend, streaming renderer, neo-blessed TUI

```
DataSource ── TrafficEvent ──► [filter] ──► [Sink: stream renderer]
                                            [Sink: TUI dashboard]
                                            [Sink: JSONL recorder]
                                            [Sink: analyzer]
```

Because live transports and recordings implement the same `DataSource`, `view` behaves identically to `monitor`.

**GUI path:** a GUI only needs to depend on `@anthonyfree96/core` and implement a new `Sink` (e.g. an Electron/Tauri table view). The recording format, replay timing and transport abstractions are all reused unchanged.

## Development

```bash
npm install        # install deps
npm run build      # build core + cli (tsup)
npm test           # vitest
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit across packages
npm run dev -- <args>   # run the CLI via tsx (build core first)
```

### Project layout

```
packages/core/src/
  event/       # TrafficEvent / TransportMeta types, TrafficBus
  transport/   # Transport interface + tcp / udp / serial + factory (spec parsing)
  source/      # DataSource interface + FileSource (offline replay)
  sink/        # Sink interface + filter / analyzer / recorder
  replay/      # timing engine + online re-send
  format/      # hexdump + JSONL codec
  session.ts   # wires a DataSource to sinks
packages/cli/src/
  commands/    # monitor / record / view / search / replay / list-serial
  render/      # stream renderer, TUI, shared line formatting, stats
```

### Adding a transport

1. Implement the `Transport` interface — extend `TrafficBus` and implement `start()`, `stop()`, `send()`, emitting `data` events as `TrafficEvent`s.
2. Add a spec scheme and its parser in `transport/factory.ts` (`parseSpec` / `toDesc` / `createTransport`).
3. Export it from `core/src/index.ts`. Done — `monitor`/`record`/`replay` pick it up automatically.

### Conventions

- `core` has **no** presentation dependency — no terminal/color code. Rendering lives in `cli`.
- Pure functions (`hexdump`, JSONL codec, spec parsing) are unit-tested under `packages/core/test/`.

## Roadmap & limitations

**Known limitations (current)**

- Live filtering and `search` match **per event**; a pattern spanning two chunks (e.g. a frame split across serial reads) is not reassembled. Stream-level search is a planned enhancement.
- Timestamps are millisecond-resolution; sub-millisecond deltas (`dt`) are a possible future field.
- The TUI is a lightweight dashboard (scrolling log + stats); it does not yet have in-TUI search or filtering.
- `tcp-listen` replay sends to all connected clients (no per-peer targeting yet).

**Roadmap**

- Stream reassembly / cross-event pattern matching
- In-TUI search and filtering
- More recording codecs (base64, raw binary) and pcap export
- A GUI frontend (Electron/Tauri) built on `@anthonyfree96/core`

## Troubleshooting

**`bind EADDRINUSE`** — the port is already taken (often a previous run still alive). Pick another port, or free it first.

**Serial port not listed / `Access denied` (Windows)** — the port may be held by a terminal app or a driver. Use `comm-scope list-serial` to confirm, close other apps, and check the port name (COM ports above 9 need `\\.\COM10` — comm-scope passes the name through, so use the exact name `list-serial` reports).

**`serialport` fails to load after `npm install`** — no prebuilt binary for your platform. Install the native build toolchain and run `npm rebuild serialport`.

**Exit summary is missing when piping** — data goes to stdout, banners/stats to stderr. Redirect both if you want the whole transcript: `... > out.txt 2> err.txt`.

## License

[MIT](LICENSE) © 2026 comm-scope contributors
