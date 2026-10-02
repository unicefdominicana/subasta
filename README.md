# Subasta A Taste of Hope · UNICEF República Dominicana

Sitio de subasta benéfica en Next.js + Supabase + Vercel.
Los invitados pujan sin login: se registran una vez (nombre, apellido, correo y teléfono)
y escriben cuánto quieren sumar al precio actual del lote. Todo se actualiza en tiempo real.

## Puesta en marcha
1. **Supabase:** SQL Editor > New query > pega `supabase/schema.sql` > Run.
2. **Vercel:** Settings > Environment Variables > agrega las variables de `.env.example`
   (para Production, Preview y Development).
3. **Vercel:** Deployments > ⋯ > Redeploy. Las variables `NEXT_PUBLIC_*` solo se aplican
   en un despliegue nuevo.
4. Carga los lotes en la tabla `auction_items` (Table Editor o SQL).
5. Entra a `/admin` con `ADMIN_USER` y `ADMIN_PASSWORD` y abre la subasta.

## Cómo funciona
- La puja se suma en Supabase (`place_bid`), que bloquea el lote mientras suma:
  dos pujas simultáneas nunca se pisan.
- Correo y teléfono quedan en tablas privadas; el público solo ve el nombre de quien va ganando.
- `/admin`: abrir y cerrar la subasta, cerrar lotes, ver ganadores y descargar CSV.

## Antes del evento
- Haz pruebas y luego borra las pujas de prueba con los comandos al final de `schema.sql`.
- Deja la subasta cerrada hasta el momento de abrirla en la cena.
