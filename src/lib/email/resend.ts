import "server-only"

export async function sendTransactionalEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY missing")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORT_EMAIL_FROM || "MonzaHaus <hello@monzahaus.com>",
      to: [to],
      subject,
      html,
    }),
  })
  if (!response.ok) throw new Error(`Resend delivery failed: ${response.status}`)
  return response.json() as Promise<{ id: string }>
}
