api:
	cd api && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web:
	cd web && npm run dev