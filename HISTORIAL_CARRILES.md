# Historial — Feature "Carriles" (HOY / RONDANDO / REGRESAN)

> Registro de una sesión previa donde se diseñó e inició la construcción
> del diferenciador "motor de evasión + 3 carriles". Lo guardo para no
> perder el contexto entre sesiones.
>
> **Fecha del trabajo original:** ~mayo 2026 (la migración propuesta era
> `20260519_loop_lanes.sql`).

---

## Estado actual en este repo (verificado el 2026-05-20)

**Nada de este feature está en el repo que yo veo.** Concretamente, en
`master` y en `claude/fix-analyze-patterns-empty-Duyxi`:

- No existe el commit `775b723` que la sesión anterior dijo haber pusheado.
- No existe el archivo `supabase/migrations/20260519_loop_lanes.sql`.
- No hay una sola referencia en código a `avoidance_reason`,
  `connected_theme`, `recurrence_count`, `loop_lanes`, `'regresa'` ni
  `'rondando'`.

Conclusión: el trabajo de Fase 1+2 que describe la sesión vive
exclusivamente **en la Mac local del usuario** (probablemente en stash o
en una rama no pusheada), o se perdió. Antes de seguir, hay que
recuperarlo o reconstruirlo desde este documento.

---

## La idea entera — plan de 4 fases

Diferenciador: **nombrar la evasión**. No es UI bonita, es un diagnóstico
que la IA emite por cada loop que regresa, cruzando los otros loops
reales del usuario.

### Fase 1 — Datos (servidor, sin rebuild de app)

Migración `supabase/migrations/20260519_loop_lanes.sql` que agrega a
`action_items`:

- `status` → enum lógico: `hoy` | `rondando` | `regresa` | `hecha`
- `recurrence_count` → cuántas veces ese loop ha reaparecido
- `connected_theme` → tema/dominio que conecta este loop con otros
- `avoidance_reason` → **el diferenciador**: frase afilada de por qué el
  usuario lo evita

### Fase 2 — Motor de evasión (EL diferenciador, servidor, sin rebuild)

Extender la Edge Function `analyze-patterns` (ya recibe entradas + loops
abiertos + perfil estratégico + sesgos). Por cada loop que regresa,
debe emitir:

1. `connected_theme` — qué tema conecta este loop con otros del usuario.
2. `avoidance_reason` — una frase afilada cruzando con sus otros loops
   reales. Ejemplo objetivo:
   > "no cierras el de proveedores porque te obliga a confrontar a tu
   > socio — el mismo patrón del loop de contratación".

Reglas de calibración (heredadas de la pasada anti-drama / anti-inventar):

- **Sin drama**: prohibido "loop terminal", "crisis", "petición de
  rescate", etc.
- **Sin números inventados**: prohibido fabricar "entrada 74",
  "sentimiento -0.60", "se convertirán en 300+ en 7 días". Solo
  números que vengan de los datos reales del usuario.

### Fase 3 — UI: las 3 carriles (app, requiere rebuild)

Tres pantallas/columnas tipo kanban: **HOY / RONDANDO / REGRESAN**.

- **REGRESAN** es la estrella. Cada tarjeta muestra **grande** el
  `avoidance_reason`, debajo el único siguiente movimiento, y un ✓ para
  cerrar.
- Mover entre carriles a mano.
- Esta fase **NO se construye hasta validar que el diagnóstico de Fase 2
  está afilado** (ver "Cómo validamos" abajo).

### Fase 4 — Auto-ruteo

- `analyze-entry` etiqueta loops nuevos como `hoy` o `rondando` al
  crearlos.
- `analyze-patterns` los promueve a `regresa` cuando detecta recurrencia.

---

## Secuencia acordada (importante)

> "Estar MUY seguros que atacamos esto" tiene una implicación de
> secuencia. El diferenciador es **invisible** (vive en la IA, no en la
> pantalla). Si construyo primero las 3 pantallas bonitas y la IA
> diagnostica mal la evasión, gastamos días en UI sobre un cimiento
> flojo.

Orden correcto:

1. Construir Fase 1 (migración) + Fase 2 (motor en `analyze-patterns`).
   Servidor. Se prueba sin TestFlight.
2. **Validar** la calidad de `avoidance_reason` con datos reales por SQL.
3. **Solo cuando esté afilado**, construir Fase 3 (UI carriles).
4. Después, Fase 4 (auto-ruteo en `analyze-entry`).

---

## Cómo validar el diagnóstico (gate antes de Fase 3)

Una vez que `analyze-patterns` corrió con el código nuevo y hay loops
abiertos, en el SQL Editor de Supabase:

```sql
SELECT task, connected_theme, avoidance_reason,
       recurrence_count, last_surfaced_at
FROM public.action_items
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'torosilva@gmail.com')
  AND status = 'regresa'
ORDER BY last_surfaced_at DESC;
```

La pregunta clave: ¿`avoidance_reason` suena afilado, cruzado, verdad
incómoda — o suena genérico/inventado?

- Afilado → construir Fase 3 con confianza.
- Flojo o inventa → apretar el prompt de `analyze-patterns` server-side
  y re-validar. **No construir UI sobre un cimiento flojo.**

Consulta de estado general (útil cuando "no sale nada"):

```sql
SELECT
  count(*)                                            AS total_loops,
  count(*) FILTER (WHERE is_completed = false)         AS abiertos,
  count(*) FILTER (WHERE status = 'hoy')               AS en_hoy,
  count(*) FILTER (WHERE status = 'regresa')           AS regresan,
  count(*) FILTER (WHERE avoidance_reason IS NOT NULL) AS con_diagnostico
FROM public.action_items
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'torosilva@gmail.com');
```

Interpretación:

- `total_loops = 0` → no hay loops guardados. Revisar por qué las tareas
  de las fichas no llegan a `action_items`.
- `abiertos = 0` con total > 0 → todos cerrados, nada que regrese.
- `abiertos > 0` pero `regresan = 0` y `con_diagnostico = 0` →
  **`analyze-patterns` no corrió con el código nuevo, o no se desplegó**.

---

## Cómo se dispara `analyze-patterns`

Desde la app, vía `triggerPatternAnalysis()`. Se llama automáticamente:

1. Cada vez que el usuario hace un brain-dump nuevo (post `analyze-entry`).
2. Al abrir el Dashboard.

Además, en esta sesión (2026-05-20) se agregó un **botón "RE-ANALIZAR"
siempre visible** en el header de "PATRONES DETECTADOS" del Dashboard
(`src/screens/DashboardScreen.tsx`), que dispara el mismo flujo.

**Crítico:** la Edge Function vive en el servidor. La app que ya está
instalada gatilla el código que esté desplegado en Supabase. Sin
`supabase functions deploy`, sigue corriendo la versión vieja por más
veces que el botón se presione.

---

## Despliegue (lo que faltaba en la sesión anterior)

Las funciones se despliegan por separado. La sesión anterior pusheó el
código a git pero nunca confirmó el deploy a Supabase. El comando que
deja las dos funciones críticas al día:

```bash
cd /Users/torosilva/Documents/blackboxmind/blackboxapp
git stash && git pull && npm install
supabase functions deploy analyze-entry analyze-patterns
```

Migración (una de dos):

- Pegar `supabase/migrations/20260519_loop_lanes.sql` en el SQL Editor.
- O `supabase db push`.

---

## El bug paralelo que apareció

La sesión anterior detectó que la ficha de `analyze-entry` seguía
mostrando lenguaje prohibido ("loop terminal", "petición de rescate") y
números inventados ("entrada 74", "-0.60", "300+ en 7 días"). Diagnóstico:
el prompt recalibrado anti-drama / anti-inventar estaba pusheado a git
pero **`analyze-entry` nunca se redesplegó a Supabase**. Mismo problema
de raíz que el del carril `regresa` vacío: el código nuevo nunca llegó al
servidor.

Solución: el mismo `supabase functions deploy analyze-entry analyze-patterns`
de arriba.

---

## Estado al cerrar la sesión anterior

El usuario reportó "sigue saliendo en cero" después de correr el SELECT
de `regresa`. La última pregunta que quedó abierta y sin responder:

1. ¿Cuáles son los 5 números del `GROUP BY status` (consulta de estado
   general arriba)?
2. ¿Cuál es el output exacto de
   `supabase functions deploy analyze-entry analyze-patterns`?

Sin esos dos datos no se puede saber si el problema es:

- Las funciones nunca se desplegaron (muy probable).
- No hay `action_items` abiertos para diagnosticar.
- El motor corrió pero el modelo no produjo `avoidance_reason`.

---

## TODO para retomar este feature

- [ ] Localizar el commit `775b723` y la migración `20260519_loop_lanes.sql`
      en la Mac local del usuario (probablemente en stash o rama no
      pusheada). Si no aparecen, **reconstruir desde este documento**.
- [ ] Pushear ese trabajo a `origin` para que esté visible aquí.
- [ ] Correr `supabase functions deploy analyze-entry analyze-patterns`.
- [ ] Aplicar la migración (`supabase db push` o SQL Editor).
- [ ] Hacer 2-3 brain-dumps con tareas accionables y dejarlas sin cerrar.
- [ ] Disparar `analyze-patterns` (botón RE-ANALIZAR del Dashboard, ya
      construido en `f86e36f`).
- [ ] Correr la consulta de validación de `avoidance_reason` y juzgar
      calidad.
- [ ] Si afilado → construir Fase 3 (UI carriles). Si flojo → apretar
      prompt y re-validar.
- [ ] Fase 4 al final.
