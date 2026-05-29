/**
 * Transactional email via Resend HTTP API (no SDK).
 * Requires RESEND_API_KEY on the engine (Render).
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'Astradio <support@astradio.io>';
const ACCENT = '#00674f';

/**
 * @param {{ to: string; subject: string; html: string }} params
 * @returns {Promise<{ success: boolean; error?: string; id?: string }>}
 */
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    console.error('[email] RESEND_API_KEY is not set');
    return { success: false, error: 'email_not_configured' };
  }
  const recipient = String(to || '').trim();
  if (!recipient) {
    return { success: false, error: 'missing_recipient' };
  }
  try {
    const r = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${String(apiKey).trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [recipient],
        subject: String(subject || '').trim(),
        html: String(html || ''),
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        (data && (data.message || data.error)) ||
        `Resend HTTP ${r.status}`;
      console.error('[email] send failed', { to: recipient, status: r.status, msg });
      return { success: false, error: String(msg) };
    }
    return { success: true, id: data && data.id ? String(data.id) : undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] send error', { to: recipient, msg });
    return { success: false, error: msg };
  }
}

/**
 * @param {string} verifyUrl
 * @returns {{ subject: string; html: string }}
 */
function buildVerificationEmail(verifyUrl) {
  const url = String(verifyUrl || '').trim();
  const subject = 'Verify your Astradio account';
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8f7;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5ebe8;padding:32px 28px;">
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0;font-size:28px;font-weight:600;color:${ACCENT};letter-spacing:0.02em;">Astradio</p>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <p style="margin:0 0 12px;font-size:18px;line-height:1.5;color:#1a1a1a;">Welcome to Astradio — astrology you can hear.</p>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#444;">Confirm your email address to sign in and start exploring your chart.</p>
        </td></tr>
        <tr><td style="padding:8px 0 24px;">
          <a href="${url}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Verify my email</a>
        </td></tr>
        <tr><td style="padding-top:16px;border-top:1px solid #e5ebe8;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#777;">This link expires in 24 hours. If you did not create an Astradio account, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject, html };
}

module.exports = {
  sendEmail,
  buildVerificationEmail,
};
