import * as React from "react";

export function BidConfirmation({
  firstName,
  lotNumber,
  itemTitle,
  amountLabel,
}: {
  firstName: string;
  lotNumber: number;
  itemTitle: string;
  amountLabel: string;
}) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", color: "#17145B" }}>
      <h1>¡Puja registrada!</h1>
      <p>Hola {firstName},</p>
      <p>
        Tu puja por el lote {String(lotNumber).padStart(2, "0")}, <strong>{itemTitle}</strong>, fue registrada
        correctamente.
      </p>
      <p style={{ fontSize: 24, fontWeight: 700 }}>{amountLabel}</p>
      <p>Puedes seguir la subasta en tiempo real desde el sitio. ¡Gracias por apoyar a la niñez!</p>
    </div>
  );
}
