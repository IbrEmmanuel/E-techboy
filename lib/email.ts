import "server-only";

import { getEnv } from "@/lib/env";

export async function sendAlertEmail(to: string[], subject: string, text: string) {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.ALERT_FROM_EMAIL || to.length === 0) return { sent: false };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.ALERT_FROM_EMAIL,
      to,
      subject,
      text,
    }),
  });
  if (!response.ok) {
    console.error("Alert email provider rejected the request");
    return { sent: false };
  }
  return { sent: true };
}
