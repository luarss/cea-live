# Installation
.PHONY: install
install: install-backend install-frontend

.PHONY: install-backend
install-backend:
	@cd backend && npm install

.PHONY: install-frontend
install-frontend:
	@cd frontend && npm install

.PHONY: fetch-data
fetch-data:
	@echo "Downloading latest data release..."
	@mkdir -p data
	@curl -fsSL -o data/CEASalespersonsPropertyTransactionRecordsresidential.csv https://github.com/luarss/cea-live/releases/latest/download/CEASalespersonsPropertyTransactionRecordsresidential.csv

# Development
.PHONY: dev
dev:
	@cd frontend && npm run dev

.PHONY: build
build:
	@cd backend && npm install
	@cd backend && NODE_OPTIONS=--max-old-space-size=512 npm run build
	@cd frontend && npm install && npm run build

.PHONY: start
start:
	@cd backend && NODE_OPTIONS=--max-old-space-size=400 npm run server

.PHONY: download
download:
	@cd backend && npm run download
