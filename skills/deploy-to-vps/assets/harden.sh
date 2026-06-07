#!/usr/bin/env bash
# Baseline VPS hardening for Ubuntu. Run as root (or with sudo) on a FRESH box,
# BEFORE exposing services. Read it first; it changes SSH. DO NOT close your current
# SSH session until you've confirmed a NEW session works on the new port.
#
#   sudo SSH_PORT=49222 DEPLOY_USER=deploy bash harden.sh
#
# Edit the vars or pass them as env. Re-run is mostly idempotent.
set -euo pipefail

SSH_PORT="${SSH_PORT:-49222}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo ">>> 1. non-root sudo user: ${DEPLOY_USER}"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
fi
# copy the current authorized_keys so key auth works for the new user
if [ -f /root/.ssh/authorized_keys ]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

echo ">>> 2. sshd: key-only, no root, custom port ${SSH_PORT}"
install -d /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
Port ${SSH_PORT}
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
EOF
# Ubuntu 22.10+ socket activation: point the socket at the new port too.
if systemctl list-unit-files | grep -q '^ssh.socket'; then
  mkdir -p /etc/systemd/system/ssh.socket.d
  printf '[Socket]\nListenStream=\nListenStream=%s\n' "$SSH_PORT" > /etc/systemd/system/ssh.socket.d/port.conf
  systemctl daemon-reload
fi

echo ">>> 3. firewall (UFW): default-deny, allow SSH+web"
apt-get update -qq && apt-get install -y -qq ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ">>> 4. fail2ban"
apt-get install -y -qq fail2ban
cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
backend  = systemd
[sshd]
enabled = true
port    = ${SSH_PORT}
EOF
systemctl enable --now fail2ban

echo ">>> 5. unattended security updates"
apt-get install -y -qq unattended-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades

# Restart ssh LAST, after the firewall already allows the new port.
echo ">>> restarting ssh on port ${SSH_PORT}"
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
systemctl restart ssh.socket 2>/dev/null || true

cat <<EOF

DONE. Now, BEFORE closing this session, open a NEW terminal and confirm:
    ssh -p ${SSH_PORT} ${DEPLOY_USER}@<this-host>
Then update CI: set GitHub variable VPS_SSH_PORT=${SSH_PORT}, VPS_USER=${DEPLOY_USER}.

OPTIONAL (when behind Cloudflare proxy) - lock the origin to Cloudflare IPs:
    for ip in \$(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from \$ip to any port 443 proto tcp; ufw allow from \$ip to any port 80 proto tcp; done
    ufw deny 80/tcp; ufw deny 443/tcp
And restrict SSH to your IP if static:
    ufw allow from <YOUR_IP> to any port ${SSH_PORT} proto tcp && ufw delete allow ${SSH_PORT}/tcp
EOF
