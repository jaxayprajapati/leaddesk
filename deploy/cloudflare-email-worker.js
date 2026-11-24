// LeadDesk email addresses: Cloudflare Email Routing hands every email for *@INBOUND_DOMAIN to this Worker,
// which posts the raw email to LeadDesk. Set LEADDESK_URL (the backend's public URL) and INBOUND_SECRET
// (same as backend/.env) as Worker variables, and add a catch-all routing rule that sends to this Worker.
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer()
    const res = await fetch(`${env.LEADDESK_URL}/inbound/email?to=${encodeURIComponent(message.to)}`, {
      method: "POST",
      headers: { "X-Inbound-Secret": env.INBOUND_SECRET, "Content-Type": "message/rfc822" },
      body: raw,
    })
    if (res.status === 404) message.setReject("No LeadDesk agency has this address")
    else if (!res.ok) throw new Error(`LeadDesk answered ${res.status}`) // fail visibly (Worker logs) rather than drop the email
  },
}
