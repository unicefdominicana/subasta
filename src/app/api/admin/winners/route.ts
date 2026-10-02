import { adminSupabase } from "@/lib/supabase";
import type { Winner } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { open: "Abierto", closed: "Cerrado", paused: "Pausado", draft: "Borrador" };

export async function GET() {
  try {
    const { data, error } = await adminSupabase().from("auction_winners").select("*").order("lot_number");
    if (error) return new Response(error.message, { status: 500 });

    const rows = (data ?? []) as unknown as Winner[];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["N.º de item", "Artículo", "Estado", "Monto", "Nombre", "Apellido", "Correo", "Teléfono", "Hora de la puja"];
    const lines = [
      header.map(esc).join(","),
      ...rows.map((r) =>
        [
          r.lot_number,
          r.title,
          STATUS[r.status] ?? r.status,
          r.amount,
          r.first_name,
          r.last_name,
          r.email,
          r.phone,
          new Date(r.bid_at).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" }),
        ]
          .map(esc)
          .join(","),
      ),
    ];

    return new Response("\uFEFF" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ganadores-subasta.csv"',
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
