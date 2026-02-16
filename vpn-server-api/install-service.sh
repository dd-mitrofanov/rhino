#!/bin/bash
# Установка vpn-server-api как systemd-службы

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="vpn-server-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Проверка прав root
if [[ $EUID -ne 0 ]]; then
   echo "Запустите скрипт с sudo: sudo ./install-service.sh"
   exit 1
fi

# Проверка наличия .env
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
   echo "Ошибка: файл .env не найден в $SCRIPT_DIR"
   echo "Скопируйте .env.example в .env и заполните TOKEN и другие переменные"
   exit 1
fi

echo "Создание службы $SERVICE_NAME..."

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=VPN Server API - HTTP API for managing xray (VLESS + XTLS Vision + Reality) keys
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$SCRIPT_DIR
EnvironmentFile=$SCRIPT_DIR/.env
ExecStart=$(which node) index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Служба создана: $SERVICE_FILE"
echo "Перезагрузка systemd..."
systemctl daemon-reload
echo "Включение автозапуска..."
systemctl enable "$SERVICE_NAME"
echo "Запуск службы..."
systemctl start "$SERVICE_NAME"
echo ""
echo "Готово! Служба $SERVICE_NAME запущена."
echo ""
echo "Полезные команды:"
echo "  sudo systemctl status $SERVICE_NAME   — статус"
echo "  sudo systemctl stop $SERVICE_NAME     — остановить"
echo "  sudo systemctl start $SERVICE_NAME    — запустить"
echo "  sudo journalctl -u $SERVICE_NAME -f   — логи в реальном времени"
