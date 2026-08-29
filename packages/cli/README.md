# comm-scope

Serial / TCP / UDP traffic monitor for developers — watch, filter, record, replay and search byte-level communication.

## Install

```bash
npm install -g comm-scope
```

## Quick start

```bash
comm-scope monitor udp-listen:9999      # live monitor
comm-scope record serial:COM3:115200 --out session.jsonl
comm-scope view session.jsonl           # offline replay
comm-scope search session.jsonl --string "error" -C 2
comm-scope replay session.jsonl --to serial:COM3
comm-scope list-serial
```

## Full documentation

See the [project README](https://github.com/<you>/comm-scope) for the complete option reference, transport spec syntax, examples, recording format and architecture.
