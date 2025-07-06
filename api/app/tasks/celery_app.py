from celery import Celery
from app.settings import settings
import sys

celery_app = Celery(
    "doccelerate",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json", "pickle"],  # Accept both JSON and pickle
    result_serializer="pickle",  # Use pickle for results to avoid Celery JSON bug
    result_expires=3600,  # Results expire after 1 hour
    task_track_started=True,  # Track when tasks start
    task_ignore_result=False,  # Don't ignore results
    result_extended=True,  # Store additional task metadata
    task_send_sent_event=True,  # Send task sent events
    task_always_eager=False,  # Don't execute tasks immediately
    worker_hijack_root_logger=False,  # Don't hijack root logger
    result_backend_always_retry=True,  # Always retry result backend
    result_backend_max_retries=10,  # Max retries for result backend
    task_acks_late=True,  # Acknowledge tasks after completion
    worker_prefetch_multiplier=1,  # Process one task at a time
    # Additional settings to handle exceptions better
    result_accept_content=["json", "pickle"],  # Accept JSON and pickle for results
    task_reject_on_worker_lost=True,  # Reject tasks when worker is lost
    # Settings to handle corruption better
    result_backend_transport_options={
        'retry_on_timeout': True,
        'retry_policy': {
            'timeout': 5.0
        }
    },
    # Ignore result errors and continue
    task_ignore_result_on_disconnect=True,
    # Don't try to decode corrupted results
    result_compression='gzip',  # Add compression to help with serialization
    task_compression='gzip',
)

# Automatically discover tasks in the app.tasks package
celery_app.autodiscover_tasks(["app.tasks"])

# ---------------------------------------------------------------------------
# Monkey-patch Celery's own LoggingProxy so that it behaves more like a real
# file-like object.  Some third-party libraries (GitPython, etc.) call
# ``fileno()`` on stdout/stderr to test for TTY capabilities.  Celery's proxy
# does not implement this method, which leads to AttributeError crashes when
# such libraries run inside a Celery worker.  The patch is safe (adds the
# method only if missing) and happens at module import time so it affects the
# worker before any tasks or libraries are imported.
# ---------------------------------------------------------------------------

try:
    from celery.utils.log import LoggingProxy  # type: ignore

    if not hasattr(LoggingProxy, "fileno"):

        def _fileno(self):  # type: ignore[return-value]
            """Return a usable file descriptor for stdout/stderr.

            GitPython and other libraries call ``sys.stdout.fileno()`` to
            detect TTY capabilities. Celery replaces ``sys.stdout`` with a
            ``LoggingProxy`` that lacks *fileno()* which breaks those
            libraries.  We can't forward the call because the proxy doesn't
            wrap a real stream, so we fall back to the descriptor of the real
            original *stdout* if available, else ``1`` which is the standard
            fd for *stdout*.
            """

            try:
                return sys.__stdout__.fileno()  # type: ignore[attr-defined]
            except Exception:
                return 1  # Fallback to classic STDOUT file descriptor

        LoggingProxy.fileno = _fileno  # type: ignore[attr-defined]
except Exception:  # pragma: no cover – best-effort patching only
    pass

# Older Celery/Kombu versions used ``kombu.utils.log.LoggingProxy`` – patch it
# too as a safety net.
try:
    from kombu.utils.log import LoggingProxy as _KombuLoggingProxy  # type: ignore

    if not hasattr(_KombuLoggingProxy, "fileno"):

        def _k_fileno(self):  # type: ignore[return-value]
            try:
                return sys.__stdout__.fileno()  # type: ignore[attr-defined]
            except Exception:
                return 1

        _KombuLoggingProxy.fileno = _k_fileno  # type: ignore[attr-defined]
except Exception:
    pass 