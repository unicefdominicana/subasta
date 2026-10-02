import { revalidatePath } from "next/cache";
import { adminSupabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";
import type { Winner } from "@/lib/types";
import { AutoRefresh, ConfirmSubmit } from "./controls";

export const dynamic = "force-dynamic";

type AdminItem = {
  id: string;
  lot_number: number;
  title: string;
  starting_price: number;
  current_bid: number;
  leader_name: string | null;
  bid_count: number;
  status: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  closed: "Cerrado",
  paused: "Pausado",
  draft: "Oculto",
};

async function setAuctionOpen(formData: FormData) {
  "use server";
  const isOpen = formData.get("open") === "true";
  const { error } = await adminSupabase()
    .from("auction_settings")
    .update({ is_open: isOpen, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) console.error("[admin] No se pudo cambiar el estado:", error);
  revalidatePath("/admin");
}

async function setItemStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["open", "closed", "draft"].includes(status)) return;
  const { error } = await adminSupabase()
    .from("auction_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[admin] No se pudo cambiar el lote:", error);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  let errorMessage = "";
  let items: AdminItem[] = [];
  let winners: Winner[] = [];
  let isOpen = false;
  let currency = "DOP";

  try {
    const db = adminSupabase();
    const [itemsRes, winnersRes, settingsRes] = await Promise.all([
      db
        .from("auction_items")
        .select("id,lot_number,title,starting_price,current_bid,leader_name,bid_count,status")
        .order("lot_number"),
      db.from("auction_winners").select("*").order("lot_number"),
      db.from("auction_settings").select("is_open,currency").eq("id", 1).maybeSingle(),
    ]);
    const firstError = itemsRes.error ?? winnersRes.error ?? settingsRes.error;
    if (firstError) errorMessage = firstError.message;
    items = (itemsRes.data ?? []) as unknown as AdminItem[];
    winners = (winnersRes.data ?? []) as unknown as Winner[];
    const settings = settingsRes.data as { is_open: boolean; currency: string } | null;
    isOpen = Boolean(settings?.is_open);
    currency = settings?.currency === "USD" ? "USD" : "DOP";
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Supabase no está configurado";
  }

  const money = (n: number) => formatMoney(Number(n), currency);
  const total = items.reduce((sum, i) => sum + (i.bid_count > 0 ? Number(i.current_bid) : 0), 0);

  return (
    <main className="min-h-screen bg-[#ECEBFF] p-4 md:p-8">
      <AutoRefresh seconds={10} />
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black text-[#17145B] md:text-4xl">Panel de la subasta</h1>
        <p className="mt-1 text-slate-600">Se actualiza solo cada 10 segundos.</p>

        {errorMessage && (
          <div className="mt-6 rounded-xl bg-amber-100 p-4 text-sm">
            <strong>Error de conexión:</strong> {errorMessage}
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="text-sm text-slate-500">Estado de la subasta</div>
            <div className={`mt-1 text-2xl font-black ${isOpen ? "text-green-700" : "text-red-700"}`}>
              {isOpen ? "ABIERTA" : "CERRADA"}
            </div>
            <form action={setAuctionOpen} className="mt-4">
              <input type="hidden" name="open" value={isOpen ? "false" : "true"} />
              <ConfirmSubmit
                message={
                  isOpen
                    ? "¿Cerrar la subasta? Nadie podrá pujar en ningún lote."
                    : "¿Abrir la subasta? Los invitados podrán pujar desde ahora."
                }
                className={`w-full rounded-xl px-4 py-3 font-bold text-white ${isOpen ? "bg-red-700" : "bg-green-700"}`}
              >
                {isOpen ? "Cerrar subasta" : "Abrir subasta"}
              </ConfirmSubmit>
            </form>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="text-sm text-slate-500">Total en pujas</div>
            <div className="mt-1 text-2xl font-black text-[#17145B]">{money(total)}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="text-sm text-slate-500">Pujas registradas</div>
            <div className="mt-1 text-2xl font-black text-[#17145B]">
              {items.reduce((s, i) => s + Number(i.bid_count), 0)}
            </div>
          </div>
        </section>

        <h2 className="mt-10 text-2xl font-black text-[#17145B]">Lotes</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#17145B] text-white">
              <tr>
                <th className="p-3">Lote</th>
                <th className="p-3">Artículo</th>
                <th className="p-3">Inicial</th>
                <th className="p-3">Actual</th>
                <th className="p-3">Va ganando</th>
                <th className="p-3">Pujas</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="p-3">{String(i.lot_number).padStart(2, "0")}</td>
                  <td className="p-3 font-bold">{i.title}</td>
                  <td className="p-3">{money(i.starting_price)}</td>
                  <td className="p-3 font-bold">{money(i.current_bid)}</td>
                  <td className="p-3">{i.leader_name ?? "—"}</td>
                  <td className="p-3">{i.bid_count}</td>
                  <td className="p-3">{STATUS_LABEL[i.status] ?? i.status}</td>
                  <td className="p-3">
                    <form action={setItemStatus}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="status" value={i.status === "open" ? "closed" : "open"} />
                      <ConfirmSubmit
                        message={
                          i.status === "open"
                            ? `¿Cerrar solo el lote ${i.lot_number}?`
                            : `¿Reabrir el lote ${i.lot_number}?`
                        }
                        className="rounded-lg border border-[#17145B] px-3 py-1.5 font-bold text-[#17145B]"
                      >
                        {i.status === "open" ? "Cerrar lote" : "Reabrir"}
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Todavía no hay lotes cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[#17145B]">Puja más alta por lote</h2>
            <p className="text-sm text-slate-600">Cuando cierres la subasta, estas personas son las ganadoras.</p>
          </div>
          <a href="/api/admin/winners" className="rounded-xl bg-[#F5A800] px-4 py-2.5 font-bold text-[#17145B]">
            Descargar CSV
          </a>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#17145B] text-white">
              <tr>
                <th className="p-3">Lote</th>
                <th className="p-3">Artículo</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Correo</th>
                <th className="p-3">Teléfono</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {winners.map((w) => (
                <tr key={w.lot_number} className="border-b">
                  <td className="p-3">{String(w.lot_number).padStart(2, "0")}</td>
                  <td className="p-3 font-bold">{w.title}</td>
                  <td className="p-3 font-bold">{money(w.amount)}</td>
                  <td className="p-3">
                    {w.first_name} {w.last_name}
                  </td>
                  <td className="p-3">{w.email}</td>
                  <td className="p-3">{w.phone ?? "—"}</td>
                  <td className="p-3">{STATUS_LABEL[w.status] ?? w.status}</td>
                </tr>
              ))}
              {winners.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Todavía no hay pujas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
