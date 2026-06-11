/** Branded Mesh HTML emails (matches marketing waitlist style). */

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphsHtml(text) {
  return String(text || '')
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-family:'DM Sans',-apple-system,sans-serif;font-size:17px;line-height:1.6;color:rgba(255,255,255,0.46)">${escHtml(p)}</p>`
    )
    .join('');
}

export function buildBroadcastEmail({ subject, headline, message, kicker, ctaLabel, ctaUrl }) {
  const mailSubject = subject?.trim() || headline?.trim() || 'Update from Mesh';
  const headerKicker = kicker?.trim() || 'WAITLIST · UPDATE';
  const cta =
    ctaLabel && ctaUrl
      ? `<a href="${escHtml(ctaUrl)}" style="display:inline-block;background:#ffffff;color:#000000;font-family:'Geist Mono',monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;padding:16px 28px;border-radius:4px;margin-top:2px">${escHtml(ctaLabel)} &rarr;</a>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>${escHtml(mailSubject)}</title>
  <style>
    :root { color-scheme: dark only; }
    body { margin:0;padding:0;background:#020406;font-family:'DM Sans',-apple-system,sans-serif;color:#fff; }
    .email-wrapper {
      width:100%;background:#020406;
      background-image:radial-gradient(circle at 10% 10%,rgba(0,212,232,0.08) 0%,transparent 40%),
        radial-gradient(circle at 90% 80%,rgba(0,212,232,0.05) 0%,transparent 40%);
      padding:64px 20px;
    }
    .container { max-width:760px;margin:0 auto; }
    .terminal {
      background:#060c12;border:1px solid rgba(255,255,255,0.05);border-radius:16px;
      overflow:hidden;margin-bottom:34px;
    }
    .terminal-bar {
      background:rgba(255,255,255,0.02);padding:14px 24px;border-bottom:1px solid rgba(255,255,255,0.03);
    }
    .terminal-title {
      font-family:'Geist Mono',monospace;font-size:9px;color:rgba(255,255,255,0.2);
      text-transform:uppercase;letter-spacing:0.2em;
    }
    .terminal-body {
      padding:36px;font-family:'Geist Mono',monospace;font-size:13px;line-height:1.8;color:rgba(255,255,255,0.55);
    }
    .ascii-logo {
      color:#00d4e8;
      font-family:'Courier New',Courier,monospace;
      font-size:11px;
      line-height:1.1;
      letter-spacing:0;
      white-space:pre;
      margin:0 0 24px 0;
      display:block;
      font-weight:bold;
    }
    .cyan { color:#00d4e8; }
    .muted { color:rgba(255,255,255,0.25); }
    .white { color:#ffffff; }
    .message-block {
      margin-top:26px;
      border-top:1px solid rgba(255,255,255,0.06);
      padding-top:24px;
    }
    .greeting {
      font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:900;
      font-size:52px;line-height:0.9;color:#fff;text-transform:uppercase;margin:0 0 16px;
    }
    .security-note {
      font-family:'Geist Mono',monospace;
      font-size:11px;
      letter-spacing:0.04em;
      text-transform:uppercase;
      color:rgba(255,255,255,0.46);
      margin:0 0 20px;
      line-height:1.6;
    }
    .footer {
      margin-top:0;text-align:center;padding-top:50px;border-top:1px solid rgba(255,255,255,0.03);
    }
    .footer-text {
      font-family:'Geist Mono',monospace;font-size:9px;color:rgba(255,255,255,0.2);
      text-transform:uppercase;letter-spacing:0.18em;
    }
    .footer-links { margin-top:16px; }
    .footer-links a {
      color:rgba(255,255,255,0.38);text-decoration:none;margin:0 12px;font-size:9px;
      font-family:'Geist Mono',monospace;text-transform:uppercase;letter-spacing:0.12em;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="terminal">
        <div class="terminal-bar"><div class="terminal-title">mesh/broadcast</div></div>
        <div class="terminal-body">
<pre class="ascii-logo">
███╗   ███╗███████╗███████╗██╗  ██╗
████╗ ████║██╔════╝██╔════╝██║  ██║
██╔████╔██║█████╗  ███████╗███████║
██║╚██╔╝██║██╔══╝  ╚════██║██╔══██║
██║ ╚═╝ ██║███████╗███████║██║  ██║
╚═╝     ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝</pre>
          <div><span class="cyan">campaign:</span> <span class="white">${escHtml(headerKicker)}</span></div>
          <div><span class="cyan">channel:</span> <span class="white">waitlist</span></div>
          <div><span class="cyan">status:</span> <span class="white">outbound</span></div>
          <div><span class="cyan">subject:</span> <span class="white">${escHtml(mailSubject)}</span></div>
          <div><span class="muted">----------------------------</span></div>
          <div><span class="muted">$</span> <span class="white">mesh broadcast --send</span></div>
          <div><span class="muted">rendering message payload...</span> <span class="cyan">DONE</span></div>
          <div><span class="muted">queuing outbound batch...</span> <span class="cyan">DONE</span></div>
          <div class="message-block">
            <h2 class="greeting">${escHtml(headline || mailSubject)}</h2>
            ${paragraphsHtml(message)}
            <p class="security-note">delivery mode: waitlist broadcast · source: admin console</p>
            ${cta}
          </div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">Mesh &copy; 2026 // Terminal AI Engineering Agent</div>
        <div class="footer-links">
          <a href="https://github.com/dreddi-edit/mesh">GitHub</a>
          <a href="https://www.npmjs.com/package/@trymesh/cli">npm</a>
          <a href="https://try-mesh.com/socials">socials</a>
          <a href="mailto:support@try-mesh.com">support</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject: mailSubject, html };
}
