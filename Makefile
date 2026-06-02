be:
	cd agents && uv run uvicorn main:app --reload --port 8000

fe:
	cd frontend && npm run dev

mock:
	cd frontend && VITE_USE_MOCK=true npm run dev

test:
	cd frontend && npm test
	cd agents && uv run pytest -v

install:
	cd agents && uv sync
	cd frontend && npm install

verify:
	cd agents && uv run python main.py

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
