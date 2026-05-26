#!/bin/bash
# ============================================================
#  Genera los íconos reales de la app a partir de logo_square.
#  logo_square.png hoy es un JPEG mal nombrado .png; sips
#  (incluido en macOS, sin instalar nada) lo convierte a PNG
#  real 1024x1024 sin transparencia — justo lo que pide Apple.
#
#  Uso:  bash scripts/make-icons.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."

SRC="assets/logo_square.png"
[ -f "$SRC" ] || { echo "No encuentro $SRC"; exit 1; }

echo "Convirtiendo $SRC -> PNG real 1024x1024…"

# Ícono principal (iOS lo usa). PNG, sin alpha, 1024x1024.
sips -s format png -z 1024 1024 "$SRC" --out assets/icon.png >/dev/null

# Ícono adaptable de Android (mismo arte, centrado).
sips -s format png -z 1024 1024 "$SRC" --out assets/adaptive-icon.png >/dev/null

echo "Listo:"
sips -g pixelWidth -g pixelHeight -g format assets/icon.png | tail -3
echo
echo "Ahora:  git add assets/icon.png assets/adaptive-icon.png && git commit -m 'fix: ícono real de la app'"
echo "Luego rebuild para TestFlight:  eas build -p ios --profile production"
