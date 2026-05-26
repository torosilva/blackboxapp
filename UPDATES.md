# UPDATES — Briefing para próximas sesiones de Claude

> **Propósito:** que una sesión de Claude entrando fresca al repo se ponga al día en 2 minutos sin tener que reconstruir contexto desde el git log o desde el usuario.
>
> **Convención:** entradas latest-first. Cada entrega es una sección `## YYYY-MM-DD — Título`. Cuando cierres una entrega nueva, agrega la sección al tope, no al final.
>
> **Relación con `claudeBBM.md`:** ese archivo es el log estratégico del producto (decisiones de negocio, narrativa). `UPDATES.md` es operativo/técnico — qué se hizo en código, dónde, por qué, qué falta. Hay overlap pero el ángulo es distinto.

---

## Estado actual del repo

- **Branch de trabajo:** `claude/privacidad-nivel-1` (heredera de `claude/cool-cannon-xEEWq`/`claude/review-progress-1J4Ep` — son la misma rama, mismo HEAD)
- **HEAD:** `096feae` (Macarena Group PS Mexico signature fix)
- **master:** intencionalmente atrasado por 55+ commits. NO buildea EAS. Solo se mergea al llegar a v1.0 TestFlight con squash. Hasta entonces, master es ceremonial.
- **EAS:** buildea desde la rama de trabajo activa, no desde master.
- **Lo último deployable:** Privacidad Nivel 1 completa + fix de captura. Listo para que testers vean cambios.

---

## 2026-05-26 — Privacidad Nivel 1 + hook claudeBBM + fix de captura

### Contexto de negocio
5 testers reportaron preocupación de privacidad ("creen que el equipo va a ver su info"). Director de Grupo Walmart pidió específicamente un "certificado BlackBoxMind de cifrado". Esta entrega responde al **80% de la objeción** sin implementar E2EE técnico (eso es Nivel 2, futuro).

Filosofía: no es seguridad nueva — es **hacer visible** la seguridad que ya existe (RLS, opt-out de training en Anthropic, AES-256 at-rest de Supabase) + comunicarla en lenguaje humano + dar al usuario un PDF firmado que pueda mandarle a su equipo legal.

### Archivos tocados

| Archivo | Tipo | Qué |
|---|---|---|
| `src/screens/PrivacyScreen.tsx` | modificado | Card visual personalizado al tope (nombre, ID `BBM-<userId8>-<date>`, fecha, badge ACTIVO verde, botón "Descargar PDF oficial") + sección "TU PRIVACIDAD EN 60 SEGUNDOS" con 5 items humanos antes del aviso legal LFPDPPP. |
| `src/screens/SettingsScreen.tsx` | modificado | (1) Botón "Aviso de Privacidad" ahora navega a la pantalla in-app (antes abría URL web `blackboxmind.ai/privacy`). (2) Botón nuevo "Certificado de Privacidad" con icono Award morado — un-tap genera PDF directamente vía share sheet. Vive en sección "Privacidad y Datos" colapsable. |
| `src/utils/generatePrivacyPact.ts` | nuevo | Builder de PDF con `expo-print` (ya instalado, sin deps nuevas). Export `generateAndSharePrivacyPact(input)` y `generateCertId(userId, date)`. Genera HTML profesional con 6 compromisos numerados, ID único, firma corporativa. Comparte vía `expo-sharing`. |
| `src/screens/CaptureScreen.tsx` | modificado | Fix: `maxHeight: 240` en `styles.input` (línea 990). Antes el TextInput multiline crecía infinito y tapaba el botón de enviar con listas largas. |
| `.claude/hooks/remind-bbm.sh` | nuevo | Stop hook bash que detecta archivos tocados fuera de `claudeBBM.md` y bloquea el stop con recordatorio si Claude no actualizó el log. Sobrevive contenedores efímeros vía git. |
| `.claude/settings.json` | nuevo | Registra el hook arriba como hook tipo `Stop` con timeout 10s. |
| `claudeBBM.md` | apéndice continuo | Log estratégico del producto. Entradas nuevas en sección 11 cubriendo todo lo anterior. |

### Dos caminos al PDF en la app
1. **Settings → Privacidad y Datos → "Certificado de Privacidad"** → un tap, share sheet directo.
2. **Settings → Privacidad y Datos → "Aviso de Privacidad"** → abre PrivacyScreen → card morado al tope → "Descargar PDF oficial".

Coexisten intencionalmente. Camino 1 = rápido. Camino 2 = con preview visual (mejor para el caso "mostrar a tu Director").

### Correcciones que se hicieron mid-entrega (importante)

**a) ZDR overclaim corregido.** El copy original prometía "Zero Data Retention" con Anthropic. Mario validó en Anthropic Console que ZDR **no está activo** (es feature del tier Enterprise pagado). El copy se corrigió a la versión defendible: "logs temporales 30 días para abuse detection + opt-in de training deshabilitado + no participamos en Development Partner Program". Cambios en `generatePrivacyPact.ts` (compromiso #3) y `PrivacyScreen.tsx` (humanItem 02).

**Deuda residual:** `PrivacyScreen.tsx:110` (aviso legal LFPDPPP, sección 3 TRANSFERENCIAS DE DATOS) aún dice "acuerdos de cero retención de datos". Mario decidió dejarlo así por ahora. Próxima sesión: probablemente cerrar este gap o esperar a que activen ZDR Enterprise.

**b) Despersonalización de firma.** Mario fue explícito: "Mario Toro Silva" no debe aparecer en NINGÚN lado del PDF ni la UI. La firma corporativa es **"Macarena Group PS Mexico"**. Verificado con `grep -rn "Mario Toro\|Mario Silva" src/` que queda 0 ocurrencias en código de producto (sí queda en `claudeBBM.md` que es interno).

### Hook claudeBBM (meta-disciplina)

Es un Stop hook que fuerza a Claude a actualizar `claudeBBM.md` cuando hace trabajo sustantivo. **No se activa en la sesión que lo crea** — el watcher de Claude solo carga `.claude/` si existía al arrancar. Toma efecto en la sesión siguiente (contenedor nuevo con `git clone`) o cuando el usuario abre `/hooks` para recargar config.

Si entras a una sesión y ves un block del hook, no es bug — agrega entrada honesta al log y se desbloquea. Si los cambios fueron triviales, una línea mínima rompe el loop.

### Gotchas que aprendimos

- **Watcher de `.claude/` no carga mid-session.** Si creas hooks/settings durante una sesión, el usuario tiene que abrir `/hooks` o reiniciar para que surtan efecto.
- **Mario corre la app en su Mac, tú trabajas en contenedor remoto.** Para que vea tus cambios: `git pull` + `npx expo start -c` (la `-c` es crítica, Metro cachea agresivo) + reload en device. Si Mario reporta "no veo el cambio", primero pregunta en qué branch está localmente (típicamente está en una rama distinta a la tuya).
- **30 errores de `tsc --noEmit` son preexistentes.** Los típicos: `panel/*.tsx` no tiene deps web instaladas, `ActionItem.description` falta en core-types, `HomeScreen.tsx` navega a `'Loops'` que no está en el route stack. Ninguno introducido por trabajo reciente. Cuando termines un task, valida con `npx tsc --noEmit 2>&1 | grep -E "<tus_archivos>"` — si está vacío, estás bien.
- **`react-native` icons necesitan cast `as any`** en este codebase. Patrón establecido (`const Aw = Award as any;` etc). Síguelo o tendrás errores TS de `JSX.IntrinsicElements`.
- **`PrivacyScreen` tiene 3 puntos de entrada históricos**: SignUpScreen link, overlay obligatorio (`isMandatory={true}` cuando `!profile.accepted_privacy_at`), y ahora desde Settings → Aviso de Privacidad. El overlay es lo único que un usuario logueado normal no ve a menos que se borre `accepted_privacy_at` en DB. SQL para forzar: `UPDATE public.profiles SET accepted_privacy_at = NULL WHERE email = '<email>';`
- **`expo-print` y `expo-sharing` ya están instalados** (usados en WeeklyReportScreen). NO instales deps nuevas para PDF generation — reutiliza.
- **Convención del proyecto: nada de instalación de deps sin permiso explícito.**

### Commits relevantes (latest → oldest)

```
096feae fix(privacy): replace personal signature with corporate entity (Macarena Group PS Mexico)
783a768 fix(privacy): replace overclaim of Zero Data Retention with honest 30-day logs copy
e528ae0 fix(capture): cap TextInput maxHeight so send button stays visible on long lists
c719b07 docs(claudeBBM): log Privacy Nivel 1 completion + cert card visual
6879eee feat(privacy): personalized certificate card visible at top of PrivacyScreen
2c87f09 feat(settings): privacy button opens in-app PrivacyScreen instead of web URL
412d160 feat(privacy): human-readable privacy section + downloadable Privacy Pact certificate
93ecb62 chore(claude): Stop hook that nudges Claude to log to claudeBBM.md
```

### Lo que sigue (orden sugerido)

Según conversaciones con Mario, los bloques pendientes para v1.0 TestFlight beta:
1. **Onboarding Conversacional** (próximo bloque probable)
2. **RevenueCat keys** integradas
3. **Brecha #2 y #3** (Mario tiene contexto, no documentado aquí)
4. **Resolver deuda residual de ZDR** en aviso legal LFPDPPP línea 110 (o esperar a Enterprise tier)

Modelo de branch: cada bloque arranca como hijo de la rama de trabajo activa, no de master. Cuando termine y Mario valide, fast-forward merge a la rama padre. Master solo se actualiza en TestFlight v1.0 con `git merge --squash`.
