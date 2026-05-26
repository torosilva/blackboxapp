import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface PrivacyPactInput {
  userId: string;
  userEmail: string;
  userName: string;
  issueDate?: Date;
}

export function generateCertId(userId: string, issueDate: Date): string {
  const datePart = issueDate.toISOString().slice(0, 10).replace(/-/g, '');
  const userPart = userId.slice(0, 8).toUpperCase();
  return `BBM-${userPart}-${datePart}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: PrivacyPactInput): string {
  const issueDate = input.issueDate ?? new Date();
  const certId = generateCertId(input.userId, issueDate);
  const formattedDate = issueDate.toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Certificado de Privacidad — BlackBoxMind.ai</title>
    <style>
      @page { margin: 40px; }
      body {
        font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #1e293b;
        padding: 0;
        margin: 0;
      }
      .header {
        border-bottom: 3px solid #6366f1;
        padding-bottom: 16px;
        margin-bottom: 32px;
      }
      .brand {
        font-size: 13px;
        letter-spacing: 4px;
        color: #6366f1;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; }
      .subtitle { font-size: 13px; color: #64748b; margin-top: 6px; }
      .meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #64748b;
        margin: 24px 0;
        padding: 12px 0;
        border-top: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
      }
      .recipient {
        margin: 28px 0;
        padding: 16px;
        background: #f8fafc;
        border-left: 3px solid #6366f1;
      }
      .recipient-label { font-size: 10px; letter-spacing: 2px; color: #6366f1; font-weight: 700; }
      .recipient-name { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 4px; }
      .recipient-email { font-size: 12px; color: #64748b; margin-top: 2px; }
      .body-intro { font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
      .commitment {
        margin: 16px 0;
        padding-left: 16px;
        border-left: 2px solid #c7d2fe;
      }
      .commitment-title { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
      .commitment-body { font-size: 12px; color: #334155; line-height: 1.5; }
      .signature {
        margin-top: 48px;
        padding-top: 24px;
        border-top: 1px solid #e2e8f0;
      }
      .sig-name { font-size: 13px; font-weight: 700; color: #0f172a; }
      .sig-title { font-size: 11px; color: #64748b; }
      .sig-company { font-size: 11px; color: #64748b; margin-top: 4px; }
      .footer {
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        font-size: 10px;
        color: #94a3b8;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">BLACKBOXMIND.AI</div>
      <h1 class="title">Certificado de Privacidad Personal</h1>
      <div class="subtitle">Compromisos vigentes sobre el tratamiento de tu información</div>
    </div>

    <div class="meta">
      <div><strong>ID del Certificado:</strong> ${certId}</div>
      <div><strong>Emitido:</strong> ${formattedDate}</div>
    </div>

    <div class="recipient">
      <div class="recipient-label">EMITIDO A NOMBRE DE</div>
      <div class="recipient-name">${escapeHtml(input.userName || 'Usuario')}</div>
      <div class="recipient-email">${escapeHtml(input.userEmail)}</div>
    </div>

    <p class="body-intro">
      Este documento certifica los compromisos específicos que BlackBoxMind.ai (operado por Macarena Group PS Mexico) sostiene respecto al tratamiento, almacenamiento y procesamiento de la información personal generada en tu uso del producto.
    </p>

    <div class="commitment">
      <div class="commitment-title">1. Acceso restringido al contenido</div>
      <div class="commitment-body">Ningún miembro del equipo de BlackBoxMind.ai accede al contenido de tus capturas, reflejos o memorias personales. Disponemos de un dashboard interno de costos y uso que únicamente expone métricas agregadas (volumen de eventos, costo de cómputo por usuario); nunca expone el contenido de tus registros. Las políticas de Row-Level Security en la base de datos garantizan que solo tu sesión autenticada puede leer tu contenido.</div>
    </div>

    <div class="commitment">
      <div class="commitment-title">2. Cifrado en reposo</div>
      <div class="commitment-body">Tu información se almacena cifrada en reposo bajo estándar AES-256 en infraestructura de Supabase. Los respaldos automatizados se mantienen igualmente cifrados y se rotan periódicamente.</div>
    </div>

    <div class="commitment">
      <div class="commitment-title">3. Procesamiento de IA bajo Zero Data Retention</div>
      <div class="commitment-body">Las solicitudes de análisis se procesan a través de Anthropic (Claude). Bajo el acuerdo Zero Data Retention, Anthropic procesa la solicitud, devuelve el resultado, y no almacena tu contenido. Tu información no se utiliza para entrenar ni mejorar modelos de IA de terceros.</div>
    </div>

    <div class="commitment">
      <div class="commitment-title">4. Sin venta ni intercambio con terceros</div>
      <div class="commitment-body">BlackBoxMind.ai no vende, renta, intercambia ni comparte tu información personal identificable con anunciantes, partners de marketing ni intermediarios de datos. Tu suscripción es el modelo de negocio; tu data no.</div>
    </div>

    <div class="commitment">
      <div class="commitment-title">5. Derecho de portabilidad y eliminación</div>
      <div class="commitment-body">Puedes descargar tu data completa en formato JSON desde Settings en cualquier momento. Al solicitar la eliminación de tu cuenta, toda tu información (entries, embeddings, reflejos, patrones detectados) se elimina permanentemente en un plazo máximo de 30 días.</div>
    </div>

    <div class="commitment">
      <div class="commitment-title">6. Compromiso de notificación</div>
      <div class="commitment-body">Si en algún momento estos compromisos sufrieran un cambio material, te notificaremos por correo electrónico con al menos 30 días de anticipación, dándote opción de ejercer tu derecho de portabilidad o eliminación antes de que el cambio entre en vigor.</div>
    </div>

    <div class="signature">
      <div class="sig-name">Mario Toro Silva</div>
      <div class="sig-title">Fundador y Director General</div>
      <div class="sig-company">Macarena Group PS Mexico — BlackBoxMind.ai</div>
    </div>

    <div class="footer">
      Este certificado es un documento de compromiso comercial. No sustituye el Aviso de Privacidad legal disponible en la aplicación bajo la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México.
      <br/><br/>
      Documento ID: ${certId} · Generado el ${formattedDate}
    </div>
  </body>
  </html>
  `;
}

export async function generateAndSharePrivacyPact(input: PrivacyPactInput): Promise<void> {
  const html = buildHtml(input);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Certificado de Privacidad BlackBoxMind.ai',
      UTI: 'com.adobe.pdf',
    });
  }
}
