# Installation
.PHONY: install
install: install-backend install-frontend

.PHONY: install-backend
install-backend:
	@cd backend && npm install

.PHONY: install-frontend
install-frontend:
	@cd frontend && npm install

# Development
.PHONY: dev
dev:
	@cd frontend && npm run dev

.PHONY: build
build:
	@cd backend && npm install
	@cd backend && npm run build
	@cd frontend && npm install && npm run build

.PHONY: start
start:
	@cd backend && npm run server

.PHONY: download
download:
	@cd backend && npm run download
