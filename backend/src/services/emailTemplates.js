// Emails are sent as plain text plus simple, table-based HTML that renders in Gmail, Outlook and
// Apple Mail. Every value placed in the HTML is escaped.

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout({ preheader, heading, body, button, footer }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f2f1;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f1;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Helvetica,Arial,sans-serif;color:#1d1a19;">
<tr><td style="padding:28px 32px 0;font-size:20px;font-weight:700;letter-spacing:0.5px;">FIT<span style="color:#e0241a;">FORGE</span></td></tr>
<tr><td style="padding:20px 32px 0;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#45403e;">${body}</td></tr>
<tr><td style="padding:24px 32px;">
<a href="${escapeHtml(button.href)}" style="display:inline-block;background:#e0241a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(button.label)}</a>
</td></tr>
<tr><td style="padding:0 32px 28px;font-size:13px;line-height:1.6;color:#7a7370;">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function passwordResetEmail({ name, link, minutes }) {
  const firstName = String(name).trim().split(/\s+/)[0] || 'there';
  return {
    subject: 'Reset your FitForge password',
    text: `Hi ${firstName},\n\nSomeone asked to reset your FitForge password. If it was you, open this link within ${minutes} minutes:\n\n${link}\n\nIf it wasn't you, you can ignore this email; your password stays the same.`,
    html: layout({
      preheader: `Choose a new password within ${minutes} minutes.`,
      heading: 'Reset your password',
      body: `Hi ${escapeHtml(firstName)},<br><br>Someone asked to reset your FitForge password. If it was you, choose a new one within ${minutes} minutes.`,
      button: { href: link, label: 'Choose a new password' },
      footer: `If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(link)}" style="color:#7a7370;word-break:break-all;">${escapeHtml(link)}</a><br><br>If it wasn't you, ignore this email; your password stays the same.`,
    }),
  };
}

module.exports = { passwordResetEmail, escapeHtml };
