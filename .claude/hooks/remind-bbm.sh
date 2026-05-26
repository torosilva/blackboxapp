#!/usr/bin/env bash
# Stop hook: si Claude tocó archivos (o hizo commits) fuera de claudeBBM.md
# y NO actualizó claudeBBM.md, bloquea el stop e inyecta un recordatorio.
# Si claudeBBM.md está en los cambios, o si no hubo cambios, deja stop normal.
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || exit 0

# Archivos con cambios sin commit
dirty=$(git status --porcelain 2>/dev/null | awk '{print $NF}')

# Archivos tocados por commits en los últimos 15 minutos
recent=$(git log --since="15 minutes ago" --name-only --pretty=format: 2>/dev/null | sort -u)

touched=$(printf '%s\n%s\n' "$dirty" "$recent" | sort -u | sed '/^$/d')

# Nada que reportar → permite stop
[ -z "$touched" ] && exit 0

# Si claudeBBM.md ya fue tocado en este turno, permite stop
echo "$touched" | grep -qx 'claudeBBM.md' && exit 0

# Hubo trabajo y claudeBBM.md no se actualizó → bloquea con recordatorio
files_block=$(echo "$touched" | head -10 | sed 's/^/  - /')

reason=$(printf '%s' "Recordatorio (hook claudeBBM): tocaste archivos fuera de claudeBBM.md en este turno y no registraste nada en el log estratégico.

Archivos cambiados:
${files_block}

Antes de detenerte, agrega una entrada al final de claudeBBM.md (sección 11 'Historial de decisiones importantes', o una sección nueva si aplica) con:
- Fecha de hoy
- Resumen de 1-2 líneas de qué hiciste y por qué

Si los cambios no fueron sustantivos (solo exploración o ajuste trivial), agrega una línea mínima de todas formas — eso rompe el loop del hook y mantiene el log honesto. Una vez que claudeBBM.md tenga cambios en el working tree, este hook permitirá el stop.")

jq -nc --arg r "$reason" '{decision: "block", reason: $r}'
exit 0
