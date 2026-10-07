-- =====================================================================
-- AJUSTE DE PRECIOS INICIALES · Subasta A Taste of Hope
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- En los items SIN pujas, el precio actual se ajusta solo al nuevo precio.
-- =====================================================================
update public.auction_items as a
   set starting_price = v.price, updated_at = now()
  from (values
    (1, 2400),
    (2, 350), (4, 350), (8, 350), (10, 350), (14, 350),
    (3, 300), (7, 300), (12, 300),
    (5, 550),
    (9, 3995)
  ) as v(lot, price)
 where a.lot_number = v.lot;

-- Verificación: en items sin pujas, current_bid debe ser igual a starting_price.
select lot_number as item, title, starting_price, current_bid, bid_count
  from public.auction_items order by lot_number;
