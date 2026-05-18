# Panel de consumo — integración

`UsagePanel.tsx` es el dashboard admin (costo por usuario y por componente).
Vive en el proyecto **blackbox-landing** (el de blackboxmind.ai), no en la app.

## 1. Aplicar la migración (una vez)

Desde el repo de la app (`blackboxapp`):

```bash
supabase db push
```

(o pega el contenido de `supabase/migrations/20260518_usage_events.sql` en el
SQL Editor de Supabase y ejecútalo).

## 2. Re-desplegar las edge functions (para que empiecen a medir)

```bash
supabase functions deploy ai-chat analyze-entry analyze-patterns \
  classify-thread transcribe-audio embed-entry search-entries
```

## 3. Hacerte admin

En el SQL Editor de Supabase:

```sql
UPDATE public.profiles SET is_admin = true WHERE email = 'TU-CORREO';
```

## 4. Montar el panel en blackbox-landing

1. Copia `UsagePanel.tsx` a `src/` del proyecto landing.
2. Renderízalo en una ruta que YA esté detrás de tu login, pasándole tu
   cliente Supabase autenticado (el mismo que ya usas para el login):

```tsx
import { supabase } from './supabaseClient';
import UsagePanel from './UsagePanel';

// dentro de tu ruta protegida:
<UsagePanel supabase={supabase} />
```

3. `npm run build && firebase deploy --only hosting`.

## Notas

- El panel no tiene dependencias extra (React puro + estilos en línea).
- Los costos se calculan al registrar cada llamada con la tabla de precios de
  `supabase/functions/_shared/usage.ts`. Si cambian precios, edítala ahí; los
  registros viejos conservan su costo histórico.
- Seguridad: la tabla `usage_events` no es legible por usuarios normales. El
  panel sólo funciona si tu sesión es admin (las funciones SQL rechazan a
  no-admins).
