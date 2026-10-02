import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { adminSupabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";
import { BidConfirmation } from "@/emails/bid-confirmation";

export const dynamic = "force-dynamic";

const schema = z.object({
  itemId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 15;
    }),
  amount: z.coerce.number().int().positive().max(1_000_000_000),
  acceptedTerms: z.literal(true),
});

const ERRORS: Record<string, { status: number; message: string }> = {
  AUCTION_CLOSED: { status: 409, message: "La subasta no está abierta en este momento." },
  INVALID_AMOUNT: { status: 400, message: "Escribe un monto válido, en números enteros y mayor que cero." },
  AMOUNT_TOO_HIGH: { status: 400, message: "Ese monto es demasiado alto. Revisa la cantidad que escribiste." },
  ITEM_NOT_FOUND: { status: 404, message: "No encontramos este lote." },
  ITEM_NOT_OPEN: { status: 409, message: "Este lote ya no recibe pujas." },
  BID_TOO_LOW: {
    status: 409,
    message: "Tu oferta debe ser mayor que la puja actual. Ya actualizamos el precio: escribe un monto más alto.",
  },
};

type BidResult = {
  amount: number;
  bid_count: number;
  lot_number: number;
  title: string;
  currency: string;
};

export async function POST(req: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      {
        error:
          "Revisa tus datos: nombre, apellido, correo, teléfono (con código de área) y un monto en números enteros.",
      },
      { status: 400 },
    );
  }

  let db: ReturnType<typeof adminSupabase>;
  try {
    db = adminSupabase();
  } catch (e) {
    console.error("[bids] Supabase no configurado:", e);
    return NextResponse.json(
      { error: "El sistema de pujas no está conectado. Avisa al equipo organizador." },
      { status: 503 },
    );
  }

  const { data, error } = await db.rpc("place_bid", {
    p_item_id: body.itemId,
    p_first_name: body.firstName,
    p_last_name: body.lastName,
    p_email: body.email,
    p_phone: body.phone,
    p_amount: body.amount,
  });

  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (code) {
      return NextResponse.json({ error: ERRORS[code].message, code }, { status: ERRORS[code].status });
    }
    console.error("[bids] Error de Supabase:", error);
    return NextResponse.json({ error: "No fue posible registrar la puja. Intenta de nuevo." }, { status: 500 });
  }

  const result = data as BidResult;

  // Correo de confirmación opcional: solo si RESEND_API_KEY está configurada.
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const sent = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Subasta <onboarding@resend.dev>",
        to: body.email,
        subject: "Confirmación de tu puja",
        react: BidConfirmation({
          firstName: body.firstName,
          lotNumber: result.lot_number,
          itemTitle: result.title,
          amountLabel: formatMoney(Number(result.amount), result.currency),
        }),
      });
      if (sent.error) console.error("[bids] Error de correo:", sent.error);
    } catch (e) {
      console.error("[bids] Error de correo:", e);
    }
  }

  return NextResponse.json(result, { status: 201 });
}
