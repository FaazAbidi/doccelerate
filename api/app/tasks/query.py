from .celery_app import celery_app

@celery_app.task(name="app.tasks.process_query")
def process_query(query: str) -> str:
    """Simple task to process a query string."""
    return f"Processed query: {query.upper()}" 