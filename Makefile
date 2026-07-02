be:
	cd agents && uv run uvicorn main:app --reload --port 8000

be-langgraph:
	cd agents_langgraph && uv run uvicorn main:app --reload --port 8001

fe:
	cd frontend && npm run dev

mock:
	cd frontend && VITE_USE_MOCK=true npm run dev

test:
	cd frontend && npm test
	cd shared && uv run pytest -v
	cd agents && uv run pytest -v
	cd agents_langgraph && uv run pytest -v

install:
	uv sync --all-packages
	cd frontend && npm install

verify:
	cd agents && uv run python main.py

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
