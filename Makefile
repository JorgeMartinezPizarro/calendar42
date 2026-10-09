# Ciclo de vida de Calendar42 en Docker. Requiere Docker con Compose v2.
#
#   make start    construye la imagen si hay cambios y levanta el servicio
#   make stop     para y elimina el contenedor (las sesiones quedan en el volumen)
#   make logs     sigue los logs
#   make build    solo construye la imagen
#
# Variables opcionales (también en .env): PUBLIC_URL, PUBLIC_PORT.

COMPOSE ?= docker compose

.PHONY: help build start stop restart logs status shell clean

help: ## Lista los comandos disponibles
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN { FS = ":.*## " } { printf "  make %-8s %s\n", $$1, $$2 }'

build: ## Construye la imagen
	$(COMPOSE) build

start: ## Levanta el servicio (construye si hay cambios) en http://localhost:3000
	$(COMPOSE) up -d --build
	@echo "Calendar42 en http://localhost:$${PUBLIC_PORT:-3000}"

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
