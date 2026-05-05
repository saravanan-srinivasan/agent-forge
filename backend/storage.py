"""Workflow persistence — file-backed JSON store, thread-safe."""

from __future__ import annotations

import json
import threading
from pathlib import Path

from models import Workflow


class WorkflowStore:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._data: dict[str, Workflow] = {}

    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            with self.path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
            with self._lock:
                self._data = {k: Workflow(**v) for k, v in raw.items()}
        except (json.JSONDecodeError, ValueError):
            self._data = {}

    def save(self) -> None:
        with self._lock:
            serialised = {k: v.model_dump() for k, v in self._data.items()}
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(serialised, f, indent=2, default=str)

    def get(self, wid: str) -> Workflow | None:
        with self._lock:
            return self._data.get(wid)

    def put(self, wf: Workflow) -> None:
        with self._lock:
            self._data[wf.id] = wf
        self.save()

    def delete(self, wid: str) -> bool:
        with self._lock:
            if wid in self._data:
                del self._data[wid]
                changed = True
            else:
                changed = False
        if changed:
            self.save()
        return changed

    def list_all(self) -> list[Workflow]:
        with self._lock:
            return list(self._data.values())
