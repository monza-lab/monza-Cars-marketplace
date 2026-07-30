function shell(title: string, body: string, cta: string, href: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e8;color:#171512;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><p style="letter-spacing:2px;font-size:12px">MONZAHAUS</p><h1 style="font-size:28px">${title}</h1><p style="font-size:16px;line-height:1.6">${body}</p><p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#171512;color:#fff;padding:14px 20px;text-decoration:none;border-radius:6px">${cta}</a></p><p style="font-size:12px;color:#6b655e">Real pricing across US, EU, UK and Japan.</p></div></body></html>`
}

export function buildReportReadyEmail({ siteUrl, listingId, token }: { siteUrl: string; listingId: string; token: string }) {
  const href = `${siteUrl.replace(/\/$/, "")}/cars/porsche/${encodeURIComponent(listingId)}/report?access=${encodeURIComponent(token)}`
  return {
    subject: "Your Haus Report is ready",
    html: shell("Your Haus Report is ready", "Your selected car report is ready to view. This private link stays available across your devices.", "View Haus Report", href),
  }
}

export function buildClaimReminderEmail({ siteUrl, email }: { siteUrl: string; email: string }) {
  const href = `${siteUrl.replace(/\/$/, "")}/get-started?claim=${encodeURIComponent(email)}`
  return {
    subject: "Save your report and use your 2 free Haus Reports",
    html: shell("Two free reports remain", "Claim your MonzaHaus account to save your first report and generate Haus Reports for two more cars.", "Claim account", href),
  }
}
