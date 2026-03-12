// data/services/emailService.js — Email notifications via Resend
// Resend client is initialized lazily to avoid startup errors when API key is not configured
let _resend = null;

function getResendClient() {
  if (!_resend) {
    const { Resend } = require('resend');
    _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'Oscar Watchlist <noreply@oscarwatchlist.app>';

async function sendWelcomeEmail(to, { nick, firstName }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Skipped (RESEND_API_KEY not set): welcome email to ${to}`);
    return;
  }
  const displayName = firstName || nick;
  try {
    await getResendClient().emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Bem-vindo ao Oscar Watchlist! 🏆',
      html: buildWelcomeHtml({ nick, displayName }),
    });
  } catch (err) {
    console.error('[Email] Failed to send welcome email:', err.message);
  }
}

function buildWelcomeHtml({ nick, displayName }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao Oscar Watchlist</title>
</head>
<body style="margin:0;padding:0;background:#07070f;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07070f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:linear-gradient(170deg,#0e0e1c,#090913);border:1px solid rgba(212,175,55,0.16);border-radius:20px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#100a00,#1c1200,#100a00);padding:36px 40px 28px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.1);">
              <div style="font-size:52px;margin-bottom:14px;line-height:1;filter:drop-shadow(0 0 16px rgba(212,175,55,0.45));">🏆</div>
              <h1 style="margin:0;font-size:20px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#d4af37;">Oscar Watchlist</h1>
              <p style="margin:6px 0 0;font-size:11px;color:#5a4a22;letter-spacing:2px;text-transform:uppercase;">Acompanhe os indicados ao Oscar</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#e0e0f0;font-weight:600;">
                Olá, ${escapeHtml(displayName)}! 👋
              </h2>
              <p style="margin:0 0 20px;font-size:15px;color:#9090a8;line-height:1.7;">
                Você se cadastrou com sucesso no <strong style="color:#d4af37;">Oscar Watchlist</strong>.
                Agora você pode acompanhar os filmes indicados, registrar seus palpites e comparar com outros usuários.
              </p>

              <!-- Nick box -->
              <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.18);border-radius:12px;padding:20px 24px;margin:24px 0;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5a4a22;">Seu nick de acesso</p>
                <p style="margin:0;font-size:24px;font-weight:700;color:#d4af37;letter-spacing:1px;">@${escapeHtml(nick)}</p>
              </div>

              <!-- Feature list -->
              <p style="margin:0 0 10px;font-size:14px;color:#9090a8;font-weight:600;">O que você pode fazer:</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:5px 0;font-size:14px;color:#9090a8;line-height:1.6;">
                    🎬&nbsp;&nbsp;Marcar filmes como assistidos e dar notas
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-size:14px;color:#9090a8;line-height:1.6;">
                    🎯&nbsp;&nbsp;Registrar seus palpites para cada categoria
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-size:14px;color:#9090a8;line-height:1.6;">
                    📊&nbsp;&nbsp;Comparar seus palpites com outros usuários
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-size:14px;color:#9090a8;line-height:1.6;">
                    🌟&nbsp;&nbsp;Acompanhar seu aproveitamento na noite do Oscar
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#5a4a22;line-height:1.6;">
                Boa sorte nos seus palpites! 🎬✨
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(212,175,55,0.15),transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#2a2a38;letter-spacing:1px;text-transform:uppercase;">
                Oscar Watchlist &middot; Este é um email automático, não responda
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendWelcomeEmail };
