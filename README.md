# VPN

Система управления VPN-ключами: Telegram-бот для пользователей и HTTP API для серверов xray (VLESS + XTLS Vision + Reality).

## Структура проекта

| Компонент | Описание |
|-----------|----------|
| [vpn-bot](./vpn-bot) | Telegram-бот для управления ключами (генерация, отзыв, инвайты, роли) |
| [vpn-server-api](./vpn-server-api) | HTTP API для xray — создание и отзыв ключей, интеграция с config.json |

## Как это работает

1. **vpn-server-api** — запускается на каждом VPN-сервере. Управляет config.json xray, создаёт и отзывает ключи.
2. **vpn-bot** — один бот может управлять несколькими серверами. Пользователи получают VLESS-ссылки через Telegram.

## Быстрый старт

### 1. VPN Server API (на каждом сервере)

**Вариант А** — автоматическая установка с нуля (Ubuntu/Debian):

```bash
sudo ./install-server.sh
```

**Вариант Б** — ручная установка:

```bash
cd vpn-server-api
npm install
cp .env.example .env
# Заполните TOKEN, SERVER_IP, REALITY_PUBLIC_KEY и др.
npm start
```

Подробнее: [vpn-server-api/README.md](./vpn-server-api/README.md)

### 2. VPN Bot

```bash
cd vpn-bot
npm install
cp .env.example .env
# Заполните BOT_TOKEN
npm start
```

Первый администратор создаётся вручную в БД:

```bash
sqlite3 vpn-bot/data/bot.db "INSERT INTO users (id, role) VALUES (ВАШ_TELEGRAM_ID, 'admin');"
```

Подробнее: [vpn-bot/README.md](./vpn-bot/README.md)

### 3. Добавление сервера в бота

Через бота (команда `/add_server` у администратора) укажите:
- Имя сервера
- IP и порт API (например `http://1.2.3.4:3000`)
- API-токен (значение `TOKEN` из .env на сервере)

## Установка сервера (install-server.sh)

Скрипт `install-server.sh` автоматизирует развёртывание VPN-сервера с нуля на Ubuntu/Debian:

1. **SSH** — смена порта, вход только по ключу
2. **Система** — BBR, оптимизация sysctl
3. **XRay** — установка и настройка VLESS + Reality
4. **vpn-server-api** — установка Node.js, npm install, создание .env, systemd-служба

Запуск (от root):

```bash
sudo ./install-server.sh
```

Скрипт запросит: порт SSH, публичный SSH-ключ, количество shortId. В конце выведет данные для подключения и (если в репозитории есть `vpn-server-api`) URL и токен API для добавления сервера в бота.

> Скрипт должен находиться в корне репозитория вместе с папкой `vpn-server-api`.

## Требования

- Node.js 18+
- xray с VLESS + Reality (для vpn-server-api)
- Токен бота от [@BotFather](https://t.me/BotFather)

## Лицензия

MIT
