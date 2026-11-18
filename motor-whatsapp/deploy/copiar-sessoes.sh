#!/usr/bin/env bash
# Cópia diária das sessões do motor do WhatsApp (as sessões são as chaves do aparelho).
# Rodar como root pelo cron. Guarda 7 dias.
set -euo pipefail

PASTA_SESSOES="/opt/ipemaster-os/motor-whatsapp/sessoes"
PASTA_COPIAS="/var/backups/motor-whatsapp"
DIAS_GUARDAR=7

umask 077
mkdir -p "$PASTA_COPIAS"
chmod 700 "$PASTA_COPIAS"

PAI="$(dirname "$PASTA_SESSOES")"
NOME="$(basename "$PASTA_SESSOES")"
DESTINO="$PASTA_COPIAS/sessoes-$(date +%F).tar.gz"

tar -czf "$DESTINO" --exclude="$NOME/.motor.pid" -C "$PAI" "$NOME"
chmod 600 "$DESTINO"

find "$PASTA_COPIAS" -maxdepth 1 -name 'sessoes-*.tar.gz' -mtime +"$DIAS_GUARDAR" -delete
chmod 600 "$PASTA_COPIAS"/sessoes-*.tar.gz

echo "Cópia criada: $DESTINO"
