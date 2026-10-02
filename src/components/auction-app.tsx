"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Gavel, Lock, ShieldCheck, TrendingUp, Trophy, X } from "lucide-react";
import { browserSupabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/format";
import type { AuctionItem, AuctionSettings, Guest } from "@/lib/types";

const GUEST_KEY = "subasta-atoh-invitado";
const MY_BIDS_KEY = "subasta-atoh-mis-ofertas";
const FALLBACK_IMAGE = "/images/header-atoh-subasta.png";
const ITEM_COLUMNS =
  "id,lot_number,title,description,category,image_url,starting_price,current_bid,bid_count,status,featured";
const EMPTY_GUEST: Guest = { firstName: "", lastName: "", email: "", phone: "" };

type Row = Record<string, unknown>;
/** Última oferta que hizo este teléfono en cada lote: { idDelLote: monto }. Nunca sale del dispositivo. */
type MyBids = Record<string, number>;
type BidState = "none" | "winning" | "outbid";
type Notice = { kind: "success" | "error"; text: string } | null;

function toItem(row: Row): AuctionItem {
  return {
    id: String(row.id),
    lot_number: Number(row.lot_number),
    title: String(row.title ?? ""),
    description: (row.description as string | null | undefined) ?? null,
    category: (row.category as string | null | undefined) ?? null,
    image_url: (row.image_url as string | null | undefined) ?? null,
    starting_price: Number(row.starting_price ?? 0),
    current_bid: Number(row.current_bid ?? 0),
    bid_count: Number(row.bid_count ?? 0),
    status: (row.status as AuctionItem["status"]) ?? "open",
    featured: Boolean(row.featured),
  };
}

function toSettings(row: Row): AuctionSettings {
  return {
    is_open: Boolean(row.is_open),
    currency: row.currency === "DOP" ? "DOP" : "USD",
  };
}

function definedOnly(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

function canOptimize(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return host.endsWith(".supabase.co") || host === "images.unsplash.com";
  } catch {
    return false;
  }
}

const fullName = (g: Guest) => `${g.firstName} ${g.lastName}`.trim();

export default function AuctionApp() {
  const supabase = useMemo(() => browserSupabase(), []);

  const [items, setItems] = useState<AuctionItem[]>([]);
  const [settings, setSettings] = useState<AuctionSettings>({ is_open: false, currency: "USD" });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [editingGuest, setEditingGuest] = useState(false);
  const [draft, setDraft] = useState<Guest>(EMPTY_GUEST);
  const [accepted, setAccepted] = useState(false);
  const [formError, setFormError] = useState("");
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [myBids, setMyBids] = useState<MyBids>({});

  const money = useCallback((n: number) => formatMoney(n, settings.currency), [settings.currency]);

  // ---- Carga de datos desde Supabase ---------------------------------
  const load = useCallback(async () => {
    if (!supabase) return;
    const [itemsRes, settingsRes] = await Promise.all([
      supabase.from("auction_items").select(ITEM_COLUMNS).neq("status", "draft").order("lot_number"),
      supabase.from("auction_settings").select("is_open,currency").eq("id", 1).maybeSingle(),
    ]);
    const error = itemsRes.error ?? settingsRes.error;
    if (error) {
      console.error("[subasta] Error al cargar:", error);
      setLoadError(error.message);
      setLoaded(true);
      return;
    }
    setItems((itemsRes.data ?? []).map((r) => toItem(r as Row)));
    if (settingsRes.data) setSettings(toSettings(settingsRes.data as Row));
    setLoadError(null);
    setLoaded(true);
  }, [supabase]);

  // ---- Tiempo real ----------------------------------------------------
  useEffect(() => {
    if (!supabase) return;
    void load();

    const channel = supabase
      .channel("subasta-en-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_items" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = String((payload.old as Row).id ?? "");
          setItems((prev) => prev.filter((i) => i.id !== oldId));
          return;
        }
        const row = definedOnly(payload.new as Row);
        setItems((prev) => {
          const id = String(row.id);
          const existing = prev.find((i) => i.id === id);
          const next = toItem({ ...(existing ?? {}), ...row });
          if (next.status === "draft") return prev.filter((i) => i.id !== id);
          const list = existing ? prev.map((i) => (i.id === id ? next : i)) : [...prev, next];
          return list.sort((a, b) => a.lot_number - b.lot_number);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_settings" }, (payload) => {
        if (payload.eventType !== "DELETE") setSettings(toSettings(payload.new as Row));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });

    // Los teléfonos cortan la conexión al bloquearse: al volver, recarga.
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  // ---- Datos del invitado guardados en este teléfono ------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GUEST_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Guest>;
      if (saved.firstName && saved.lastName && saved.email && saved.phone) {
        const g: Guest = {
          firstName: saved.firstName,
          lastName: saved.lastName,
          email: saved.email,
          phone: saved.phone,
        };
        setGuest(g);
        setDraft(g);
      }
      const rawBids = localStorage.getItem(MY_BIDS_KEY);
      if (rawBids) setMyBids(JSON.parse(rawBids) as MyBids);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const active = useMemo(() => items.find((i) => i.id === activeId) ?? null, [items, activeId]);
  const raised = useMemo(() => items.reduce((sum, i) => sum + (i.bid_count > 0 ? i.current_bid : 0), 0), [items]);
  const anyBids = items.some((i) => i.bid_count > 0);
  const typedAmount = Number(amountText.replace(/\D/g, "")) || 0;
  // Primera puja: desde el precio inicial. Siguientes: más que la puja actual.
  const minBid = active ? (active.bid_count === 0 ? active.current_bid : active.current_bid + 1) : 0;
  const amountOk = typedAmount > 0 && typedAmount >= minBid;
  // Este teléfono sabe si va ganando comparando su última oferta con la puja actual.
  const bidState = (i: AuctionItem): BidState => {
    const mine = myBids[i.id];
    if (mine === undefined || i.bid_count === 0) return "none";
    return mine === i.current_bid ? "winning" : "outbid";
  };

  function openItem(i: AuctionItem) {
    setActiveId(i.id);
    setAmountText("");
    setNotice(null);
    setFormError("");
    setEditingGuest(false);
  }

  function closeModal() {
    setActiveId(null);
    setNotice(null);
  }

  function startEditGuest() {
    setDraft(guest ?? EMPTY_GUEST);
    setAccepted(Boolean(guest));
    setFormError("");
    setEditingGuest(true);
  }

  function saveGuest() {
    const g: Guest = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
    };
    const digits = g.phone.replace(/\D/g, "").length;
    if (!g.firstName || !g.lastName) return setFormError("Escribe tu nombre y tu apellido.");
    if (!/^\S+@\S+\.\S+$/.test(g.email)) return setFormError("Revisa tu correo electrónico.");
    if (digits < 10 || digits > 15) return setFormError("Escribe tu teléfono con código de área (ej. 809 555 1234).");
    if (!accepted) return setFormError("Debes aceptar las condiciones para participar.");
    setGuest(g);
    setEditingGuest(false);
    setFormError("");
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(g));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  async function placeBid() {
    if (!active || !guest || !amountOk) return;
    // Protección contra ceros de más: si la oferta más que duplica la puja actual, pide confirmar.
    if (
      active.current_bid > 0 &&
      typedAmount > active.current_bid * 2 &&
      !window.confirm(`Tu oferta será de ${money(typedAmount)}. ¿Confirmas que el monto es correcto?`)
    ) {
      return;
    }
    const itemId = active.id;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          ...guest,
          amount: typedAmount,
          acceptedTerms: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        amount?: number;
        bid_count?: number;
      };
      if (!res.ok) {
        if (json.code === "BID_TOO_LOW" || json.code === "ITEM_NOT_OPEN" || json.code === "AUCTION_CLOSED") {
          void load();
        }
        throw new Error(json.error || "No fue posible registrar la puja. Intenta de nuevo.");
      }
      const amount = Number(json.amount);
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId && amount > i.current_bid
            ? {
                ...i,
                current_bid: amount,
                bid_count: Number(json.bid_count ?? i.bid_count + 1),
              }
            : i,
        ),
      );
      setMyBids((prev) => {
        const next = { ...prev, [itemId]: amount };
        try {
          localStorage.setItem(MY_BIDS_KEY, JSON.stringify(next));
        } catch {
          /* almacenamiento no disponible */
        }
        return next;
      });
      setAmountText("");
      setNotice({ kind: "success", text: `¡Puja registrada! Vas ganando este lote con ${money(amount)}.` });
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Error inesperado." });
    } finally {
      setBusy(false);
    }
  }

  const auctionLabel = settings.is_open
    ? "Abierta: ¡haz tu puja!"
    : anyBids
      ? "La subasta está cerrada"
      : "Abrirá durante la cena";

  // ---- Interfaz -------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#ECEBFF]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#3431C7]/15 bg-[#ECEBFF]/95 px-4 py-3 backdrop-blur md:px-8">
        <div>
          <div className="text-xs font-bold uppercase tracking-[.22em] text-[#F5A800]">Subasta benéfica</div>
          <div className="text-lg font-bold text-[#17145B]">A Taste of Hope</div>
        </div>
        <a href="#lotes" className="rounded-full bg-[#17145B] px-5 py-2.5 font-bold text-white">
          Ver lotes
        </a>
      </header>

      <section className="relative overflow-hidden bg-[#17145B]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(245,168,0,.5),transparent_28%),linear-gradient(135deg,#0d0b3b,#3431C7)]" />
        <div className="relative mx-auto aspect-[16/9] max-w-[1440px]">
          <Image
            src="/images/header-atoh-subasta.png"
            alt="A Taste of Hope"
            fill
            priority
            sizes="100vw"
            className="object-contain"
          />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-3 px-4 pb-8 md:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-[#17145B]/85 p-5 text-white backdrop-blur">
            <div className="text-sm text-white/70">Total en pujas</div>
            <div className="mt-1 text-3xl font-black">{money(raised)}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-[#3431C7]/85 p-5 text-white backdrop-blur">
            <div className="flex justify-between text-sm text-white/70">
              <span>Estado de la subasta</span>
              {settings.is_open ? <Gavel className="text-[#F5A800]" /> : <Lock className="text-[#F5A800]" />}
            </div>
            <div className="mt-1 text-2xl font-black md:text-3xl">{auctionLabel}</div>
          </div>
        </div>
      </section>

      <section id="lotes" className="mx-auto max-w-7xl px-4 py-14">
        <p className="font-bold uppercase tracking-[.2em] text-[#F5A800]">Selección especial</p>
        <h1 className="mt-2 text-4xl font-black text-[#17145B]">Lotes disponibles</h1>

        {!supabase ? (
          <StatusBox
            title="El sitio no está conectado a la base de datos."
            detail="Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel. Después de agregarlas, vuelve a desplegar el sitio."
          />
        ) : loadError ? (
          <StatusBox title="No pudimos cargar los lotes. Revisa tu conexión y recarga la página." detail={loadError} />
        ) : !loaded ? (
          <p className="mt-8 text-slate-600">Cargando lotes…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-slate-600">Muy pronto publicaremos los lotes de esta noche.</p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => {
              const src = i.image_url || FALLBACK_IMAGE;
              const closed = i.status !== "open";
              const canBid = settings.is_open && !closed;
              return (
                <article key={i.id} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
                  <div className="relative h-60 bg-[#17145B]">
                    <Image
                      src={src}
                      alt={i.title}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      unoptimized={!canOptimize(src)}
                      className="object-cover"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#17145B]">
                      LOTE {String(i.lot_number).padStart(2, "0")}
                    </span>
                    {closed && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#17145B] px-3 py-1 text-xs font-black text-white">
                        CERRADO
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {i.category && <div className="text-xs font-bold uppercase text-[#F5A800]">{i.category}</div>}
                    <h2 className="mt-2 text-2xl font-black text-[#17145B]">{i.title}</h2>
                    {i.description && (
                      <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-slate-600">{i.description}</p>
                    )}
                    <div className="mt-auto pt-5">
                      <div className="flex items-end justify-between border-t pt-4">
                        <div>
                          <div className="text-xs text-slate-500">
                            {i.bid_count === 0 ? "Precio inicial" : closed ? "Puja ganadora" : "Puja actual"}
                          </div>
                          <div className="text-2xl font-black text-[#17145B]">{money(i.current_bid)}</div>
                        </div>
                        <div className="text-right text-xs text-[#3431C7]">
                          <TrendingUp className="ml-auto h-4 w-4" />
                          {i.bid_count} {i.bid_count === 1 ? "puja" : "pujas"}
                        </div>
                      </div>
                      <BidStatusLine item={i} state={bidState(i)} />
                      <button
                        onClick={() => openItem(i)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#17145B] px-4 py-3 font-bold text-white hover:bg-[#3431C7]"
                      >
                        {canBid ? <Gavel className="h-4 w-4" /> : null}
                        {canBid ? "Hacer una puja" : "Ver detalles"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="bg-[#17145B] px-4 py-10 text-center text-sm text-white/70">
        A Taste of Hope 2026 · Subasta a beneficio de la niñez
      </footer>

      {active && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 md:place-items-center md:p-6">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[95vh] w-full max-w-xl overflow-auto rounded-t-3xl bg-white p-6 md:rounded-3xl"
          >
            <button onClick={closeModal} aria-label="Cerrar" className="ml-auto block">
              <X />
            </button>
            <div className="text-xs font-bold text-[#F5A800]">LOTE {String(active.lot_number).padStart(2, "0")}</div>
            <h2 className="mt-2 text-3xl font-black text-[#17145B]">{active.title}</h2>
            {active.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{active.description}</p>
            )}

            <div className="mt-5 rounded-2xl bg-[#ECEBFF] p-4">
              <div className="text-xs text-slate-500">
                {active.bid_count === 0 ? "Precio inicial" : active.status === "open" ? "Puja actual" : "Puja ganadora"}
              </div>
              <div className="text-3xl font-black text-[#17145B]">{money(active.current_bid)}</div>
              <BidStatusLine item={active} state={bidState(active)} plain />
            </div>

            {!settings.is_open ? (
              <InfoBox>
                {anyBids
                  ? "La subasta está cerrada. ¡Gracias por participar!"
                  : "La subasta abrirá durante la cena. Vuelve en ese momento para pujar."}
              </InfoBox>
            ) : active.status !== "open" ? (
              <InfoBox>Este lote ya está cerrado.</InfoBox>
            ) : !guest || editingGuest ? (
              <div className="mt-6">
                <h3 className="text-lg font-black text-[#17145B]">Regístrate para pujar</h3>
                <p className="text-sm text-slate-600">Solo la primera vez: este teléfono recordará tus datos.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    placeholder="Nombre"
                    autoComplete="given-name"
                    value={draft.firstName}
                    onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                    className="rounded-xl border p-3 text-base"
                  />
                  <input
                    placeholder="Apellido"
                    autoComplete="family-name"
                    value={draft.lastName}
                    onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                    className="rounded-xl border p-3 text-base"
                  />
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="Correo electrónico"
                    autoComplete="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    className="rounded-xl border p-3 text-base md:col-span-2"
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="Teléfono (ej. 809 555 1234)"
                    autoComplete="tel"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    className="rounded-xl border p-3 text-base md:col-span-2"
                  />
                </div>
                <label className="mt-4 flex gap-3 rounded-xl bg-[#ECEBFF] p-4 text-sm">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span>
                    Acepto las condiciones de la subasta y el uso de mis datos para gestionar mi puja. Mis datos no
                    se muestran en el sitio.
                  </span>
                </label>
                {formError && <p className="mt-3 text-sm font-bold text-red-700">{formError}</p>}
                <button
                  onClick={saveGuest}
                  className="mt-5 w-full rounded-xl bg-[#17145B] px-4 py-4 font-black text-white"
                >
                  Continuar
                </button>
                {guest && (
                  <button
                    onClick={() => setEditingGuest(false)}
                    className="mt-2 w-full py-2 text-sm font-bold text-[#3431C7]"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span>
                    Pujando como <strong className="text-[#17145B]">{fullName(guest)}</strong>
                  </span>
                  <button onClick={startEditGuest} className="font-bold text-[#3431C7] underline">
                    Cambiar
                  </button>
                </div>
                {bidState(active) === "winning" && (
                  <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">
                    Vas ganando este lote. Puedes subir tu oferta si quieres asegurarlo.
                  </div>
                )}
                {bidState(active) === "outbid" && (
                  <div className="mt-3 rounded-xl bg-amber-100 p-3 text-sm font-bold text-[#17145B]">
                    Alguien superó tu oferta. Puedes ofrecer más.
                  </div>
                )}
                <label htmlFor="monto-puja" className="mt-4 block font-bold text-[#17145B]">
                  Escribe el monto total de tu oferta
                </label>
                <div className="mt-2 flex items-center rounded-xl border-2 border-[#F5A800] px-4 focus-within:ring-2 focus-within:ring-[#F5A800]/40">
                  <span className="text-xl font-black text-[#17145B]">{settings.currency === "USD" ? "US$" : "RD$"}</span>
                  <input
                    id="monto-puja"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={minBid.toLocaleString("es-DO")}
                    value={typedAmount > 0 ? typedAmount.toLocaleString("es-DO") : ""}
                    onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    className="w-full bg-transparent p-3 text-2xl font-black text-[#17145B] outline-none"
                  />
                </div>
                <p
                  className={`mt-2 text-sm ${
                    typedAmount > 0 && !amountOk ? "font-bold text-red-700" : "text-slate-600"
                  }`}
                >
                  {active.bid_count === 0
                    ? `La primera oferta puede ser desde ${money(minBid)}.`
                    : `Tu oferta debe ser mayor que ${money(active.current_bid)}.`}
                </p>
                <button
                  disabled={busy || !amountOk}
                  onClick={placeBid}
                  className="mt-5 w-full rounded-xl bg-[#F5A800] px-4 py-4 text-lg font-black text-[#17145B] disabled:opacity-50"
                >
                  {busy
                    ? "Registrando…"
                    : amountOk
                      ? `Confirmar oferta de ${money(typedAmount)}`
                      : "Escribe tu oferta para pujar"}
                </button>
              </div>
            )}

            {notice && (
              <div
                className={`mt-4 flex gap-2 rounded-xl p-3 text-sm font-bold ${
                  notice.kind === "success" ? "bg-green-50 text-green-800" : "bg-amber-100 text-[#17145B]"
                }`}
              >
                {notice.kind === "success" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 shrink-0" />
                )}
                {notice.text}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#3431C7]" />
              Tus datos son privados: no aparecen en el sitio y solo el equipo organizador los ve.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BidStatusLine({ item, state, plain = false }: { item: AuctionItem; state: BidState; plain?: boolean }) {
  const closed = item.status !== "open";
  const box = plain
    ? "mt-2 flex items-center gap-2 text-sm"
    : "mt-3 flex items-center gap-2 rounded-xl bg-[#ECEBFF] px-3 py-2 text-sm";
  if (item.bid_count === 0) {
    return <div className={`${box} text-slate-600`}>{closed ? "Sin pujas" : "Sé la primera persona en pujar"}</div>;
  }
  if (state === "winning") {
    return (
      <div className={`${box} font-bold text-green-800`}>
        <Trophy className="h-4 w-4 shrink-0 text-[#F5A800]" />
        {closed ? "¡Ganaste este lote!" : "¡Vas ganando este lote!"}
      </div>
    );
  }
  if (state === "outbid") {
    return (
      <div className={`${box} font-bold text-[#17145B]`}>
        <AlertCircle className="h-4 w-4 shrink-0 text-[#F5A800]" />
        {closed ? "Otra persona ganó este lote" : "Superaron tu oferta"}
      </div>
    );
  }
  return (
    <div className={`${box} text-[#17145B]`}>
      <Trophy className="h-4 w-4 shrink-0 text-[#F5A800]" />
      {closed ? "Lote adjudicado" : "Hay ofertas activas"}
    </div>
  );
}

function StatusBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-8 rounded-2xl bg-amber-100 p-5 text-[#17145B]">
      <div className="flex items-center gap-2 font-bold">
        <AlertCircle className="h-5 w-5 shrink-0" />
        {title}
      </div>
      <p className="mt-2 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#ECEBFF] p-4 font-bold text-[#17145B]">
      <Lock className="h-5 w-5 shrink-0 text-[#3431C7]" />
      {children}
    </div>
  );
}
