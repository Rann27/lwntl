"""
Crash- and race-safe JSON files.

Writing with open(path, "w") truncates the file first, so a reader arriving
mid-write (the UI polling chapters while a translation checkpoints, worse on a
busy disk) sees an empty file and the chapter briefly vanishes. Here the data
goes to a temp file in the same folder and replaces the target in one step:
readers see either the old or the new file, never a half-written one.
"""

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

_RETRIES = 40          # ~2 s in total for os.replace on Windows
_RETRY_DELAY = 0.05
_READ_RETRIES = 4


def write_json(path, data: Any, indent: int = 2) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=indent, ensure_ascii=False)
        for attempt in range(_RETRIES):
            try:
                os.replace(tmp, path)
                return
            except PermissionError:
                # Windows refuses to replace a file another handle has open
                # (a reader, an antivirus scan); it is released in milliseconds.
                if attempt == _RETRIES - 1:
                    raise
                time.sleep(_RETRY_DELAY)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def read_json(path) -> Any:
    """json.load with a short retry, for files a non-atomic writer may still touch."""
    path = Path(path)
    for attempt in range(_READ_RETRIES):
        try:
            # Read and close before parsing: an open handle blocks os.replace on
            # Windows, so a long parse would stall the writer.
            return json.loads(path.read_bytes().decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError, PermissionError):
            if attempt == _READ_RETRIES - 1:
                raise
            time.sleep(_RETRY_DELAY * (attempt + 1))
