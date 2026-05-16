// Single source of truth for the welcome page.
// Used in-app (WebView) and mirrored to docs/bienvenida.html for sharing.
export const WELCOME_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Bienvenido a BLACKBOX MIND</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #020617; color: #e2e8f0; line-height: 1.55;
    padding: 28px 22px 56px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 680px; margin: 0 auto; }
  .badge { color: #818cf8; font-size: 12px; font-weight: 800; letter-spacing: 3px; }
  h1 {
    font-size: 30px; font-weight: 800; margin: 6px 0 10px;
    background: linear-gradient(90deg,#a855f7,#6366f1,#38bdf8);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .lede { color: #94a3b8; font-size: 15px; margin-bottom: 28px; }
  .steps {
    background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.22);
    border-radius: 18px; padding: 20px; margin-bottom: 30px;
  }
  .steps h2 { color: #818cf8; font-size: 12px; letter-spacing: 2px; margin-bottom: 14px; }
  .step { display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }
  .step:last-child { margin-bottom: 0; }
  .num {
    flex: 0 0 24px; width: 24px; height: 24px; border-radius: 12px;
    background: #6366f1; color: #fff; font-size: 13px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .step p { color: #cbd5e1; font-size: 14px; }
  .section { color: #6366f1; font-size: 12px; font-weight: 800; letter-spacing: 2px; margin: 8px 0 18px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 560px) { .grid { grid-template-columns: 1fr 1fr; } }
  .card {
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px; padding: 18px;
  }
  .card h3 { color: #fff; font-size: 15px; margin-bottom: 5px; }
  .card p { color: #64748b; font-size: 13px; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:4px; margin-right:8px; vertical-align: middle; }
  .rule {
    margin-top: 30px; padding: 18px; border-radius: 16px;
    background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.2);
    color: #cbd5e1; font-size: 14px; font-style: italic;
  }
  .foot { margin-top: 34px; color: #475569; font-size: 12px; text-align: center; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="badge">BIENVENIDO</div>
    <h1>BLACKBOX MIND</h1>
    <p class="lede">No es un diario ni un chatbot. Es tu caja negra estratégica:
      suelta el caos, recibe claridad. Mientras más la usas, mejor te conoce.</p>

    <div class="steps">
      <h2>EMPIEZA EN 3 PASOS</h2>
      <div class="step"><div class="num">1</div><p>Toca el micrófono o escribe lo que traes en la cabeza. Crudo, sin ordenarlo.</p></div>
      <div class="step"><div class="num">2</div><p>Conversa. BLACKBOX te responde directo y con criterio — ya te conoce.</p></div>
      <div class="step"><div class="num">3</div><p>Sal cuando quieras. Lo importante se guarda solo.</p></div>
    </div>

    <div class="section">QUÉ PUEDES HACER</div>
    <div class="grid">
      <div class="card"><h3><span class="dot" style="background:#6366f1"></span>Captura por voz, texto o imagen</h3><p>Suéltalo como te salga. Lo transcribe e interpreta por ti.</p></div>
      <div class="card"><h3><span class="dot" style="background:#a855f7"></span>Te conoce de verdad</h3><p>Usa tu historial, temas y pendientes. No le repites tu vida cada vez.</p></div>
      <div class="card"><h3><span class="dot" style="background:#facc15"></span>Active Loops</h3><p>Tus pendientes de alto impacto, los pocos que importan hoy. Ciérralos con un toque.</p></div>
      <div class="card"><h3><span class="dot" style="background:#10b981"></span>Memorias, metas y patrones</h3><p>Reflexiones por categoría, metas detectadas solas y tus sesgos recurrentes.</p></div>
      <div class="card"><h3><span class="dot" style="background:#38bdf8"></span>Busca por significado</h3><p>Encuentra por idea, no por palabra exacta. Reporte semanal exportable a PDF.</p></div>
      <div class="card"><h3><span class="dot" style="background:#f43f5e"></span>Una sola acción</h3><p>No te abruma con métricas: te dice qué hacer hoy. Lo demás está si lo quieres.</p></div>
    </div>

    <div class="rule">La única regla: no ordenes tus ideas antes de escribir. Ven con el caos.
      Si solo tienes 30 segundos y una frase, con eso basta.</div>

    <div class="foot">BLACKBOX MIND — tu caja negra estratégica</div>
  </div>
</body>
</html>`;
