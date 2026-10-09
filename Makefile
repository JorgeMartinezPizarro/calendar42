# Ciclo de vida de Calendar42 en Docker. Requiere Docker con Compose v2.
#
#   make start    construye la imagen si hay cambios y levanta el servicio
#   make stop     para y elimina el contenedor (las sesiones quedan en el volumen)
#   make logs     sigue los logs
#   make build    solo construye la imagen
#   make doctor   puerto y URL efectivos, y quién ocupa el puerto del host
#
# Variables opcionales, en .env o en el entorno: PUBLIC_PORT, PUBLIC_URL.

COMPOSE ?= docker compose

# Lee .env (si existe) para conocer PUBLIC_PORT y PUBLIC_URL, igual que compose.
-include .env
PUBLIC_PORT ?= 3000
PUBLIC_URL ?= http://localhost:$(PUBLIC_PORT)
export PUBLIC_PORT PUBLIC_URL

.PHONY: help build start stop restart logs status shell clean doctor

help: ## Lista los comandos disponibles
	@grep -hE '^[a-z]+:.*## ' $(firstword $(MAKEFILE_LIST)) | awk 'BEGIN { FS = ":.*## " } { printf "  make %-8s %s\n", $$1, $$2 }'

build: ## Construye la imagen
	$(COMPOSE) build

start: ## Levanta el servicio (construye si hay cambios)
	$(COMPOSE) up -d --build
	@echo "Calendar42 en $(PUBLIC_URL) (puerto $(PUBLIC_PORT) del host -> 3000 del contenedor)"

stop: ## Para y elimina el contenedor
	$(COMPOSE) down

restart: stop start ## Reinicia el servicio

logs: ## Sigue los logs del servicio
	$(COMPOSE) logs -f --tail=100

status: ## Estado del contenedor
	$(COMPOSE) ps

shell: ## Abre una shell dentro del contenedor
	$(COMPOSE) exec calendar42 sh

clean: ## Para y borra también la imagen y el volumen de sesiones
	$(COMPOSE) down -v --rmi local

doctor: ## Puerto y URL efectivos, y quién ocupa el puerto del host
	@echo "Puerto del host: $(PUBLIC_PORT)   URL pública: $(PUBLIC_URL)"
	@echo "Lo que compose va a aplicar:"
	@$(COMPOSE) config 2>/dev/null | grep -E 'published:|target:|APP_URL:|FT_REDIRECT_URI:|PORT:' | sed 's/^ */  /'
	@echo "Contenedores que publican el puerto $(PUBLIC_PORT):"
	@docker ps --format '  {{.Names}}  {{.Ports}}' | grep -E '[:.]$(PUBLIC_PORT)->' || echo "  ninguno"
	@echo "Procesos del host escuchando en el puerto $(PUBLIC_PORT):"
	@(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':$(PUBLIC_PORT)( |$$)' || echo "  ninguno"
