#!/bin/bash
set -e  # Прерывать выполнение при ошибке

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/vpn-server-api"

# Цветной вывод
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Проверка на root
if [[ $EUID -ne 0 ]]; then
    error "Этот скрипт должен запускаться от root (или через sudo)."
fi

# Приветствие
clear
info "Добро пожаловать в установщик XRay Reality"
info "Скрипт выполнит настройку SSH, установку XRay и генерацию конфигурации."
echo "--------------------------------------------------"

# --- 1. Сбор данных от пользователя ---
read -p "Введите новый порт для SSH (по умолчанию 2222): " ssh_port
ssh_port=${ssh_port:-2222}

read -p "Вставьте ваш публичный SSH-ключ (начинается с ssh-rsa, ssh-ed25519 и т.д.): " ssh_key
if [[ -z "$ssh_key" ]]; then
    error "Публичный ключ не может быть пустым."
fi

# Домен для подмены (можно изменить при необходимости)
reality_dest="www.bing.com:443"
reality_server_name="www.bing.com"

# --- 2. Обновление системы и установка пакетов ---
info "Обновление списка пакетов и установка необходимых утилит..."
apt update && apt upgrade -y
apt install -y curl wget unzip nano openssl ufw

# --- 3. Настройка SSH ---
info "Настройка SSH: порт $ssh_port, вход только по ключу..."

# Бэкап оригинального конфига
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak

# Изменяем порт
sed -i "s/^#Port 22/Port $ssh_port/" /etc/ssh/sshd_config
sed -i "s/^Port 22/Port $ssh_port/" /etc/ssh/sshd_config

# Включаем аутентификацию по ключу, отключаем по паролю
sed -i 's/^#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^PubkeyAuthentication no/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Добавляем ключ пользователя root (если нужно для другого пользователя, измените путь)
mkdir -p /root/.ssh
echo "$ssh_key" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# Перезапуск SSH
systemctl restart ssh
info "SSH перезапущен. Новый порт: $ssh_port. Не закрывайте текущую сессию, пока не проверите подключение в другом окне!"

# --- 4. Настройка BBR и sysctl ---
info "Включение TCP BBR и оптимизация параметров ядра..."
cat >> /etc/sysctl.conf <<EOF
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_fastopen = 3
fs.file-max = 65535000
EOF
sysctl -p

# --- 5. Установка XRay ---
info "Установка XRay-core..."
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# --- 6. Генерация ключей и UUID ---
info "Генерация ключей XRay..."
XRAY_BIN=$(command -v xray 2>/dev/null || echo "/usr/local/bin/xray")
[[ -x "$XRAY_BIN" ]] || error "Xray не найден. Установка могла завершиться с ошибкой."

# Xray выводит в stderr, поэтому перенаправляем 2>&1
uuid=$("$XRAY_BIN" uuid 2>&1 | tr -d '\r\n')
keys=$("$XRAY_BIN" x25519 2>&1)

# Поддержка двух форматов вывода:
# 1) Стандартный Xray: "Private key:" и "Public key:"
# 2) Альтернативный (некоторые форки): "PrivateKey:" и "Password:" (Password = public key)
private_key=$(echo "$keys" | grep -i "Private" | head -1 | sed 's/^[^:]*: *//' | tr -d '\r\n')
public_key=$(echo "$keys" | grep -i "Public" | sed 's/^[^:]*: *//' | tr -d '\r\n')
[[ -z "$public_key" ]] && public_key=$(echo "$keys" | grep -i "Password" | head -1 | sed 's/^[^:]*: *//' | tr -d '\r\n')

if [[ -z "$uuid" ]] || [[ -z "$private_key" ]] || [[ -z "$public_key" ]]; then
    error "Не удалось сгенерировать ключи XRay. Вывод uuid: '$uuid', keys: '$keys'"
fi

# --- 7. Создание конфигурации XRay ---
info "Создание конфигурационного файла /usr/local/etc/xray/config.json..."

cat > /usr/local/etc/xray/config.json <<EOF
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/xray/access.log",
    "error": "/var/log/xray/error.log"
  },
  "dns": {
    "servers": [
      "https+local://1.1.1.1/dns-query",
      "localhost"
    ]
  },
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      {
        "type": "field",
        "ip": ["geoip:private"],
        "outboundTag": "block"
      },
      {
        "type": "field",
        "ip": ["geoip:ru"],
        "outboundTag": "block"
      }
    ]
  },
  "inbounds": [
    {
      "port": 443,
      "protocol": "vless",
      "tag": "vless-reality",
      "settings": {
        "clients": [
          {
            "id": "$uuid",
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "$reality_dest",
          "serverNames": [
            "$reality_server_name"
          ],
          "privateKey": "$private_key",
          "shortIds": []
        }
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ]
}
EOF

# Устанавливаем владельца root и права 644 (или 600, но обычно 644 достаточно)
chown root:root /usr/local/etc/xray/config.json
chmod 644 /usr/local/etc/xray/config.json

# --- 8. Запуск XRay ---
info "Запуск XRay и добавление в автозагрузку..."
systemctl enable xray
systemctl restart xray

# Проверка статуса
if systemctl is-active --quiet xray; then
    info "XRay успешно запущен."
else
    error "XRay не запустился. Проверьте логи: journalctl -u xray"
fi

# --- 9. Установка vpn-server-api ---
IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "")
if [[ -d "$API_DIR" ]]; then
    info "Установка vpn-server-api..."

    # Node.js 18+
    if ! command -v node &>/dev/null || [[ $(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1) -lt 18 ]]; then
        info "Установка Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    else
        info "Node.js $(node -v) уже установлен."
    fi

    cd "$API_DIR"
    npm install --omit=dev

    # Генерация токена и создание .env
    api_token=$(openssl rand -hex 32)
    cat > .env <<ENVEOF
PORT=3000
TOKEN=$api_token
XRAY_CONFIG_PATH=/usr/local/etc/xray/config.json
SERVER_IP=$IP
SERVER_PORT=443
REALITY_PUBLIC_KEY=$public_key
REALITY_SERVER_NAME=$reality_server_name
SERVER_NAME=MainServer
ENVEOF

    # Создание systemd-службы
    SERVICE_NAME="vpn-server-api"
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    NODE_PATH=$(which node)

    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=VPN Server API - HTTP API for managing xray (VLESS + XTLS Vision + Reality) keys
After=network.target xray.service

[Service]
Type=simple
User=root
WorkingDirectory=$API_DIR
EnvironmentFile=$API_DIR/.env
ExecStart=$NODE_PATH index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    systemctl start "$SERVICE_NAME"

    if systemctl is-active --quiet "$SERVICE_NAME"; then
        info "vpn-server-api успешно запущен."
    else
        warn "vpn-server-api не запустился. Проверьте: journalctl -u $SERVICE_NAME"
    fi

    # Сохраняем для вывода (IP ещё не определён в этом месте, определим ниже)
    API_TOKEN_OUT="$api_token"
else
    warn "Папка vpn-server-api не найдена ($API_DIR). Пропуск установки API."
    API_TOKEN_OUT=""
fi

# --- 10. Вывод информации для клиента ---
[[ -z "$IP" ]] && IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "ВАШ_IP")
info "========== ДАННЫЕ ДЛЯ ПОДКЛЮЧЕНИЯ =========="
echo -e "${GREEN}Адрес сервера (IP):${NC} $IP"
echo -e "${GREEN}Порт:${NC} 443"
echo -e "${GREEN}UUID:${NC} $uuid"
echo -e "${GREEN}Публичный ключ (publicKey):${NC} $public_key"
echo -e "${GREEN}Серверное имя (serverName):${NC} $reality_server_name"
echo ""
echo "Ключи (VLESS-ссылки) выдаются через Telegram-бота при генерации."
echo ""
if [[ -n "$API_TOKEN_OUT" ]]; then
    echo -e "${GREEN}API для бота:${NC}"
    echo -e "  URL:  http://$IP:3000"
    echo -e "  TOKEN: $API_TOKEN_OUT"
    echo ""
    echo "Добавьте сервер в Telegram-бота командой /add_server"
    echo ""
fi
warn "Не забудьте открыть порты 443 и 3000 (TCP) в файерволе вашего хостера и в системе."
warn "Если вы используете ufw, выполните: ufw allow 443/tcp && ufw allow 3000/tcp"
warn "SSH теперь работает на порту $ssh_port. Перед закрытием текущей сессии проверьте подключение в новом окне!"
info "=============================================="