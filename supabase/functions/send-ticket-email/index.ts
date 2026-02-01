// Supabase Edge Function: send-ticket-email
// Trigger: Database Webhook (INSERT on orders) or direct invoke with { order_id }
// Replicates HMAC-SHA256 signing from Next.js API (Block 2) so QR in email matches screen.
// Sends HTML email with "Ver/Descargar entradas" link; logs to email_logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API = "https://api.resend.com/emails";

// --- HMAC-SHA256 signing (exact replica of lib/security/qr-signer.ts) ---
function base64UrlEncodeString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signTicket(uuid: string, type: string, secret: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${uuid}|${type}|${issuedAt}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const combined = `${payload}.${hex}`;
  return base64UrlEncodeString(combined);
}

// --- Payload types ---
interface DbWebhookPayload {
  type?: string;
  table?: string;
  record?: { id?: string };
}

interface OrderRow {
  id: string;
  user_email: string;
  status: string;
  inventory: {
    event: { name: string; date: string; venue: string };
    ticket_type: { name: string };
  };
}

function getOrderId(body: unknown): string | null {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.order_id === "string") return b.order_id;
    const record = (b as DbWebhookPayload).record;
    if (record && typeof record.id === "string") return record.id;
  }
  return null;
}

async function logEmail(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  status: "SENT" | "FAILED",
  errorMessage: string | null,
  toEmail: string | null,
  subject: string | null
) {
  await supabase.from("email_logs").insert({
    order_id: orderId,
    status,
    error_message: errorMessage ?? null,
    to_email: toEmail ?? null,
    subject: subject ?? null,
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const qrSecret = Deno.env.get("QR_SIGNING_SECRET");
  const siteUrl = Deno.env.get("SITE_URL") ?? Deno.env.get("NEXT_PUBLIC_BASE_URL") ?? "https://www.festivalpucon.cl";

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not set" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const orderId = getOrderId(body);
  if (!orderId) {
    return new Response(
      JSON.stringify({ error: "Missing order_id or webhook record.id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, user_email, status, inventory:inventory_id ( event:event_id ( name, date, venue ), ticket_type:ticket_type_id ( name ) )"
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    try {
      await logEmail(supabase, orderId, "FAILED", orderError?.message ?? "Order not found", null, null);
    } catch (_) {}
    return new Response(
      JSON.stringify({ error: "Order not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const row = order as unknown as OrderRow;
  const event = row.inventory?.event;
  const ticketType = row.inventory?.ticket_type;
  if (!event || !ticketType) {
    try {
      await logEmail(supabase, orderId, "FAILED", "Order data incomplete (inventory/event/type)", row.user_email, null);
    } catch (_) {}
    return new Response(
      JSON.stringify({ error: "Order data incomplete" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const eventName = event.name ?? "Festival Pucón 2026";
  const ticketTypeName = ticketType.name ?? "Entrada";
  const eventDate = event.date ? new Date(event.date).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" }) : "";
  const venue = event.venue ?? "";
  const ticketsUrl = `${siteUrl.replace(/\/$/, "")}/checkout/success/${row.id}`;
  const subject = `🎫 Tu entrada para ${eventName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #1e40af;">¡Gracias por tu compra!</h1>
  <p>Tu pago ha sido confirmado. Resumen de tu entrada:</p>
  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 5px 0;"><strong>Evento:</strong> ${eventName}</p>
    <p style="margin: 5px 0;"><strong>Tipo:</strong> ${ticketTypeName}</p>
    <p style="margin: 5px 0;"><strong>Fecha:</strong> ${eventDate}</p>
    <p style="margin: 5px 0;"><strong>Lugar:</strong> ${venue}</p>
    <p style="margin: 5px 0;"><strong>Orden:</strong> ${row.id}</p>
  </div>
  <p>Para ver y descargar tu entrada con código QR (siempre actualizado), haz clic en el botón:</p>
  <p style="margin: 24px 0;">
    <a href="${ticketsUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">Ver / Descargar entradas</a>
  </p>
  <p style="color: #6b7280; font-size: 14px;">Si el botón no funciona, copia este enlace: ${ticketsUrl}</p>
  <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
    Festival Pucón 2026<br>
    <a href="${siteUrl}" style="color: #1e40af;">${siteUrl}</a>
  </p>
</body>
</html>
`;

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Festival Pucón <noreply@festivalpucon.cl>";

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [row.user_email],
      subject,
      html,
    }),
  });

  const resBody = await res.json().catch(() => ({})) as { id?: string; message?: string };

  if (!res.ok) {
    const errMsg = (resBody as { message?: string }).message ?? res.statusText;
    try {
      await logEmail(supabase, orderId, "FAILED", errMsg, row.user_email, subject);
    } catch (_) {}
    return new Response(
      JSON.stringify({ error: "Resend failed", details: errMsg }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    await logEmail(supabase, orderId, "SENT", null, row.user_email, subject);
  } catch (logErr) {
    console.error("email_logs insert failed:", logErr);
  }

  return new Response(
    JSON.stringify({ ok: true, order_id: orderId, email_id: resBody.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
