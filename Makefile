# Installation
.PHONY: install
install: install-backend install-frontend

.PHONY: install-backend
install-backend:
	@cd backend && npm install

.PHONY: install-frontend
install-frontend:
	@cd frontend && npm install

.PHONY: install-lfs
install-lfs:
	@echo "Installing Git LFS..."
	@curl -L https://github.com/git-lfs/git-lfs/releases/download/v3.4.1/git-lfs-linux-amd64-v3.4.1.tar.gz | tar xz
	@mkdir -p ./bin
	@mv git-lfs-3.4.1/git-lfs ./bin/
	@rm -rf git-lfs-3.4.1
	@./bin/git-lfs install --force
	@./bin/git-lfs pull

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
