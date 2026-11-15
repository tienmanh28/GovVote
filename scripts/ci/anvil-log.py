#!/usr/bin/env python3
"""Ghi log Anvil có timestamp, loại key/mnemonic trước khi ghi ra đĩa."""
import argparse
from datetime import datetime, timezone
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--log", type=Path, required=True)
parser.add_argument("--pid", type=Path, required=True)
args = parser.parse_args()
args.log.parent.mkdir(parents=True, exist_ok=True)
# Chỉ node local; không truyền signer/key vào tiến trình hoặc file log.
child = subprocess.Popen(
    ["anvil", "--host", "127.0.0.1", "--port", str(args.port), "--chain-id", "31337", "--color", "never"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
)
args.pid.write_text(str(child.pid) + "\n")
private_section = False
assert child.stdout is not None
with args.log.open("w", buffering=1) as output:
    for line in child.stdout:
        # Startup mặc định in key Anvil: lọc trong pipe, không ghi bản thô ở bất cứ đâu.
        if "Private Keys" in line:
            private_section = True
        elif line.strip() == "Wallet" or "Listening on" in line:
            private_section = False
        if private_section or re.search(r"private[\s_-]*keys?|mnemonic|seed\s*phrase", line, re.I):
            line = "[redacted startup secrets]\n"
        elif re.match(r"\s*\(\d+\)\s+0x[0-9a-fA-F]{64}\b", line):
            line = "[redacted startup key]\n"
        stamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
        output.write(f"{stamp} {line}")
raise SystemExit(child.wait())
