"""
Worker Manager
Coordinates worker profiles and concurrent translation jobs.
Workers are not locked to a single series; any series uses any worker with an open slot.
The series.workerId field is a preference hint, not a hard assignment.
"""

import threading
import uuid
from collections import defaultdict, deque
from datetime import datetime
from typing import Any, Dict, List, Optional

from .llm_client import LLMClient, get_model_display_name
from .storage.config import get_config
from .storage.series import get_all_series, get_series
from .translator import Translator


class WorkerManager:
    """Run translations concurrently. Workers may handle multiple jobs up to maxConcurrent."""

    def __init__(self, window_eval=None):
        self.window_eval = window_eval
        self._lock = threading.RLock()
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._worker_jobs: Dict[str, List[str]] = defaultdict(list)
        self._series_jobs: Dict[str, str] = {}
        self._logs = defaultdict(lambda: deque(maxlen=1000))
        self._series_logs = defaultdict(lambda: deque(maxlen=2000))

    def set_window_eval(self, window_eval):
        self.window_eval = window_eval

    def _get_workers(self) -> List[Dict[str, Any]]:
        return get_config().get("workers", [])

    def _get_worker(self, worker_id: str) -> Optional[Dict[str, Any]]:
        for worker in self._get_workers():
            if worker.get("id") == worker_id:
                return worker
        return None

    def _build_worker_config(self, worker: Dict[str, Any]) -> Dict[str, Any]:
        config = get_config()
        result = {**config}
        result["provider"] = worker.get("provider") or config.get("provider")
        result["model"] = worker.get("model") or config.get("model")
        result["workerLabel"] = worker.get("label", "")
        result["logCallback"] = lambda line, wid=worker.get("id", "unknown"): self.log(wid, line, already_prefixed=True)
        return result

    def log(self, worker_id: str, message: str, already_prefixed: bool = False, series_id: str = ""):
        worker = self._get_worker(worker_id) or {}
        label = worker.get("label", worker_id or "worker")
        timestamp = datetime.now().strftime("%H:%M:%S")
        line = message if already_prefixed else f"[{label}] {message}"
        if not already_prefixed:
            print(line)
        with self._lock:
            self._logs[worker_id].append(f"{timestamp} {line}")
            if series_id:
                self._series_logs[series_id].append(f"{timestamp} {line}")

    def get_logs(self, worker_id: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            if worker_id:
                return {"workerId": worker_id, "lines": list(self._logs.get(worker_id, []))}
            all_lines = []
            for lines in self._logs.values():
                all_lines.extend(lines)
        all_lines.sort()
        return {"workerId": "all", "lines": all_lines[-2000:]}

    def get_series_logs(self, series_id: str) -> Dict[str, Any]:
        with self._lock:
            return {"seriesId": series_id, "lines": list(self._series_logs.get(series_id, []))}

    def get_statuses(self) -> List[Dict[str, Any]]:
        with self._lock:
            worker_jobs_snapshot = {k: list(v) for k, v in self._worker_jobs.items()}
            jobs_snapshot = dict(self._jobs)

        assigned: Dict[str, List[str]] = {}
        for series in get_all_series():
            worker_id = series.get("workerId") or ""
            if worker_id:
                assigned.setdefault(worker_id, []).append(series.get("id", ""))

        statuses = []
        for worker in self._get_workers():
            wid = worker.get("id")
            job_ids = worker_jobs_snapshot.get(wid, [])
            active_jobs = [jobs_snapshot[jid] for jid in job_ids if jid in jobs_snapshot]
            max_c = int(worker.get("maxConcurrent") or 1)
            first_job = active_jobs[0] if active_jobs else None
            statuses.append({
                "id": wid,
                "label": worker.get("label", ""),
                "provider": worker.get("provider", ""),
                "model": worker.get("model", ""),
                "modelDisplay": get_model_display_name(worker.get("provider", ""), worker.get("model", "")),
                "active": bool(active_jobs),
                "activeCount": len(active_jobs),
                "maxConcurrent": max_c,
                "jobId": first_job.get("jobId") if first_job else None,
                "seriesId": first_job.get("seriesId") if first_job else None,
                "chapterId": first_job.get("chapterId") if first_job else None,
                "assignedSeriesIds": assigned.get(wid, []),
            })
        return statuses

    def _reserve(self, series_id: str, chapter_id: Optional[str], kind: str) -> Dict[str, Any]:
        workers = self._get_workers()
        if not workers:
            raise ValueError("Belum ada worker. Tambahkan worker di Settings.")

        with self._lock:
            if series_id in self._series_jobs:
                raise ValueError("Series ini sedang diproses. Satu series hanya bisa memakai satu worker aktif.")

            series = get_series(series_id)
            preferred_id = (series or {}).get("workerId") or ""

            def has_slot(w: Dict[str, Any]) -> bool:
                wid = w.get("id")
                max_c = int(w.get("maxConcurrent") or 1)
                return len(self._worker_jobs.get(wid, [])) < max_c

            chosen_worker = None
            if preferred_id:
                for w in workers:
                    if w.get("id") == preferred_id and has_slot(w):
                        chosen_worker = w
                        break
            if not chosen_worker:
                for w in workers:
                    if has_slot(w):
                        chosen_worker = w
                        break

            if not chosen_worker:
                raise ValueError("Semua worker sedang penuh. Tunggu hingga ada slot tersedia.")

            worker_id = chosen_worker.get("id")
            job_id = str(uuid.uuid4())
            job = {
                "jobId": job_id,
                "kind": kind,
                "workerId": worker_id,
                "workerLabel": chosen_worker.get("label", ""),
                "seriesId": series_id,
                "chapterId": chapter_id,
                "translator": None,
            }
            self._jobs[job_id] = job
            self._worker_jobs[worker_id].append(job_id)
            self._series_jobs[series_id] = job_id
            return job

    def _release(self, job_id: str):
        with self._lock:
            job = self._jobs.pop(job_id, None)
            if not job:
                return
            worker_id = job.get("workerId")
            if worker_id in self._worker_jobs:
                try:
                    self._worker_jobs[worker_id].remove(job_id)
                except ValueError:
                    pass
                if not self._worker_jobs[worker_id]:
                    del self._worker_jobs[worker_id]
            self._series_jobs.pop(job.get("seriesId"), None)

    def start_translation(
        self,
        series_id: str,
        chapter_id: str,
        archive_previous: bool = False,
    ) -> Dict[str, Any]:
        job = self._reserve(series_id, chapter_id, "single")
        worker = self._get_worker(job["workerId"])
        client = LLMClient(self._build_worker_config(worker))
        translator = Translator(
            client,
            window_eval=self.window_eval,
            job_id=job["jobId"],
            worker_id=job["workerId"],
            worker_label=job["workerLabel"],
            log_callback=lambda line, wid=job["workerId"], sid=series_id: self.log(wid, line, already_prefixed=True, series_id=sid),
        )
        translator._glossary_pre_filter = get_config().get("glossaryPreFilter", True)
        job["translator"] = translator
        self.log(job["workerId"], f"Starting single translation: series={series_id} chapter={chapter_id}", series_id=series_id)

        def run():
            try:
                translator._translate(series_id, chapter_id, archive_previous=archive_previous)
            finally:
                self.log(job["workerId"], f"Finished single translation: series={series_id} chapter={chapter_id}", series_id=series_id)
                self._release(job["jobId"])

        threading.Thread(target=run, daemon=True).start()
        return {"status": "started", "jobId": job["jobId"], "workerId": job["workerId"]}

    def start_batch_translation(
        self,
        series_id: str,
        chapter_ids: List[str],
        force: bool = False,
        archive_previous: bool = False,
    ) -> Dict[str, Any]:
        job = self._reserve(series_id, chapter_ids[0] if chapter_ids else None, "batch")
        worker = self._get_worker(job["workerId"])
        client = LLMClient(self._build_worker_config(worker))
        translator = Translator(
            client,
            window_eval=self.window_eval,
            job_id=job["jobId"],
            worker_id=job["workerId"],
            worker_label=job["workerLabel"],
            log_callback=lambda line, wid=job["workerId"], sid=series_id: self.log(wid, line, already_prefixed=True, series_id=sid),
        )
        translator._glossary_pre_filter = get_config().get("glossaryPreFilter", True)
        job["translator"] = translator
        self.log(job["workerId"], f"Starting batch translation: series={series_id} total={len(chapter_ids)}", series_id=series_id)

        def run():
            try:
                translator._cancelled = False
                translator._batch_active = True
                translator._batch_total = len(chapter_ids)
                translator._batch_completed = 0
                translator._batch_translate(
                    series_id,
                    chapter_ids,
                    force=force,
                    archive_previous=archive_previous,
                )
            finally:
                self.log(job["workerId"], f"Finished batch translation: series={series_id}", series_id=series_id)
                self._release(job["jobId"])

        threading.Thread(target=run, daemon=True).start()
        return {"status": "started", "total": len(chapter_ids), "jobId": job["jobId"], "workerId": job["workerId"]}

    def cancel(self, series_id: Optional[str] = None, worker_id: Optional[str] = None) -> bool:
        with self._lock:
            jobs = list(self._jobs.values())

        cancelled = False
        for job in jobs:
            if series_id and job.get("seriesId") != series_id:
                continue
            if worker_id and job.get("workerId") != worker_id:
                continue
            translator = job.get("translator")
            if translator:
                self.log(job.get("workerId", ""), f"Cancel requested: series={job.get('seriesId')}")
                translator.cancel()
                cancelled = True
        return cancelled

    def is_series_running(self, series_id: str) -> bool:
        with self._lock:
            return series_id in self._series_jobs
