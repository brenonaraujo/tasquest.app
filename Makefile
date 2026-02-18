.PHONY: help dev server expo install lint lint-fix

# Load env files if they exist (local.env takes precedence over .env)
-include .env
-include local.env
export

## help: Show this help message
help:
	@echo "TaskQuest - Comandos disponíveis:"
	@echo ""
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | column -t -s ':' | sed -e 's/^/  /'
	@echo ""

## dev: Rodar servidor Express e Expo simultaneamente (desenvolvimento local)
dev:
	@trap 'kill 0' SIGINT; \
	npm run server:dev & \
	EXPO_PUBLIC_DOMAIN=localhost:5000 npx expo start & \
	wait

## server: Rodar apenas o servidor Express (porta 5000)
server:
	npm run server:dev

## expo: Rodar apenas o Expo (conecta ao servidor em localhost:5000)
expo:
	EXPO_PUBLIC_DOMAIN=localhost:5000 npx expo start

## expo-tunnel: Rodar Expo com tunnel (útil para testar em dispositivo físico)
expo-tunnel:
	EXPO_PUBLIC_DOMAIN=localhost:5000 npx expo start --tunnel

## install: Instalar dependências
install:
	npm install

## lint: Verificar erros de lint
lint:
	npm run lint

## lint-fix: Corrigir erros de lint automaticamente
lint-fix:
	npm run lint:fix
