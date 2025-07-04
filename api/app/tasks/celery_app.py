from celery import Celery
from app.settings import settings

celery_app = Celery(
    "doccelerate",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
)

# Automatically discover tasks in the app.tasks package
celery_app.autodiscover_tasks(["app.tasks"]) 