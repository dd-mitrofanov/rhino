# VPN Server API

HTTP API для управления ключами xray (VLESS + XTLS Vision + Reality).

## Требования

- Node.js 18+
- xray с настроенным VLESS inbound (Reality)
- Доступ к `systemctl` для перезапуска xray

## Установка

```bash
npm install
cp .env.example .env
# Отредактируйте .env
```

## Запуск

```bash
npm start
```

Или через pm2:

```bash
pm2 start index.js --name vpn-server-api
```

Или через systemd (создайте unit-файл по необходимости).

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| PORT | Порт API | 3000 |
| TOKEN | Токен для заголовка `Authorization: Bearer <token>` | — |
| XRAY_CONFIG_PATH | Путь к config.json xray | /usr/local/etc/xray/config.json |
| SERVER_IP | Публичный IP сервера | — |
| SERVER_PORT | Порт входящего xray | 443 |
| REALITY_PUBLIC_KEY | Публичный ключ Reality | — |
| REALITY_SERVER_NAME | SNI (например, yahoo.com) | — |
| SERVER_NAME | Имя сервера для ключей (например, MainServer) | MainServer |

## API

- **GET /health-check** — статус xray (без авторизации).
- **POST /generate-key** — тело `{ "userId": "123456789" }`, создаёт ключ и возвращает VLESS-ссылку.
- **DELETE /reject-key/:keyId** — отзывает ключ.
- **GET /keys-of?userId=123456789** — список ключей пользователя.

Все эндпоинты кроме `/health-check` требуют заголовок: `Authorization: Bearer <TOKEN>`.

## База данных

SQLite-файл `keys.db` создаётся автоматически при первом запуске. Перед изменением конфига xray создаётся резервная копия `config.json.backup`.
