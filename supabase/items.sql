-- =====================================================================
-- SUBASTA A TASTE OF HOPE · CARGA DE LOS 15 ITEMS
-- Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar varias veces: actualiza los items sin duplicarlos.
-- El precio actual se ajusta solo mientras un item no tenga pujas.
-- (La columna "category" se muestra en el sitio como el autor.)
-- =====================================================================

-- Elimina el item 99 de prueba, si existe.
update public.auction_items set winner_bid_id = null where lot_number = 99;
delete from public.bids where item_id in (select id from public.auction_items where lot_number = 99);
delete from public.auction_items where lot_number = 99;

insert into public.auction_items
  (lot_number, title, category, description, image_url, starting_price, status)
values
  (1, $t$Corrientes de añil$t$, $t$Fernando Varela$t$, $t$Un azul profundo que avanza, se cruza y se abre en destellos de luz dorada.

Fernando Varela construye esta composición con amplias franjas de azul intenso que atraviesan campos de ocre cálido, como corrientes que se encuentran. Líneas finas trazan rutas sobre la superficie y las transparencias dejan ver capas que dan profundidad y movimiento. Una obra abstracta y contemporánea que equilibra orden geométrico y energía contenida, pensada para espacios que buscan sofisticación y carácter.

Medidas: 30" x 25.5"$t$, '/images/items/item-01.jpg', 2400, 'open'),
  (2, $t$Río Mulito$t$, $t$Javier Gautier$t$, $t$El agua del río Mulito cae despacio entre piedras y helechos, y el bosque entero parece respirar en calma.

Javier Gautier detiene el tiempo en este rincón dominicano: el agua se vuelve seda sobre las rocas cubiertas de musgo, mientras la luz se filtra entre el verde intenso del follaje. Es una invitación a bajar el ritmo, escuchar el murmullo del río y llevar a casa un pedazo de naturaleza en estado puro. Fotógrafo de naturaleza con exposiciones en Santo Domingo, Roma y la Expo Milano 2015, Gautier crea desde el respeto y la contemplación íntima del paisaje dominicano.

Medidas: 20" x 30"$t$, '/images/items/item-02.jpg', 350, 'open'),
  (3, $t$Menina Quisqueya I$t$, $t$CEPM · Evergo$t$, $t$Una menina que lleva en su falda todo lo que nos hace dominicanos.

Inspirada en la clásica menina, esta pieza viste los colores de la bandera y una falda escrita a mano con palabras que cuentan el país: merengue, béisbol, larimar, sancocho, hospitalidad, Pico Duarte. Al frente, el sol se asoma entre montañas y mar; detrás, una palmera, la arena blanca y la Isla Saona completan el paisaje. Con una flor en el cabello y la bandera en la mano, es una celebración alegre y colorida de la identidad dominicana, ideal para regalar o para llenar de alegría cualquier espacio.

Medidas: 6" x 10"$t$, '/images/items/item-03.jpg', 300, 'open'),
  (4, $t$Bahía de las Águilas$t$, $t$Javier Gautier$t$, $t$Arena blanca, agua turquesa y un horizonte que no termina: el paraíso dominicano en su forma más pura.

Javier Gautier nos lleva a Bahía de las Águilas, en el extremo suroeste del país, donde el mar se vuelve transparente al tocar la orilla y el azul se intensifica hasta fundirse con el cielo. Nubes ligeras, una costa virgen y una luz limpia componen una escena de calma absoluta. Con la mirada contemplativa que ha llevado su obra a Roma y a la Expo Milano, Gautier convierte este rincón protegido en una ventana permanente al Caribe.

Medidas: 20" x 30"$t$, '/images/items/item-04.jpg', 350, 'open'),
  (5, $t$Lazo Infinito$t$, $t$Mónica Varela$t$, $t$Un trazo dorado que no tiene principio ni fin, hecho para acompañarte siempre.

Mónica Varela convierte el símbolo del infinito en un juego de joyería delicado y lleno de significado. El collar luce un dije de infinito finamente calado, con pequeños detalles oscuros que resaltan su brillo, y los aretes repiten el mismo trazo con un movimiento ligero y elegante. Es un conjunto pensado para quien celebra los lazos que perduran, ideal para lucir a diario o en una ocasión especial.

Incluye: collar con dije de infinito y par de aretes a juego, con estuches y bolsa de la marca.$t$, '/images/items/item-05.jpg', 550, 'open'),
  (6, $t$Sintonía interior$t$, $t$Juan Foronda · Galería Nader$t$, $t$Ojos cerrados, música en los oídos y un mundo que se reordena en luz dorada.

Juan Foronda retrata un instante de introspección: un rostro sereno, envuelto en audífonos, se fragmenta en cubos translúcidos que parecen flotar entre tonos de oro, ocre y verde. Cada trazo del óleo recorre la piel como un río de energía, y la retícula convierte el retrato en una pieza que cambia según desde dónde se mire. Nacido en Medellín en 1972, Foronda pintó y expuso durante siete años en Europa antes de regresar a Colombia, y suma 15 exposiciones individuales y 24 colectivas.

Técnica: Óleo sobre tela
Medidas: 40" x 55"
País: Colombia$t$, '/images/items/item-06.jpg', 3995, 'open'),
  (7, $t$Menina Quisqueya II$t$, $t$CEPM · Evergo$t$, $t$Una menina que lleva en su falda todo lo que nos hace dominicanos.

Inspirada en la clásica menina, esta pieza viste los colores de la bandera y una falda escrita a mano con palabras que cuentan el país: merengue, béisbol, larimar, sancocho, hospitalidad, Pico Duarte. Al frente, el sol se asoma entre montañas y mar; detrás, una palmera, la arena blanca y la Isla Saona completan el paisaje. Con una flor en el cabello y la bandera en la mano, es una celebración alegre y colorida de la identidad dominicana, ideal para regalar o para llenar de alegría cualquier espacio.

Medidas: 6" x 10"$t$, '/images/items/item-07.jpg', 300, 'open'),
  (8, $t$Chicuí$t$, $t$Javier Gautier$t$, $t$Pequeño, verde y con un destello rojo en la garganta: una joya viva de nuestros bosques.

Javier Gautier captura al chicuí, ave endémica de La Española, en un instante de quietud sobre una rama. El verde intenso de su plumaje, el pecho blanco y el rojo vibrante de su garganta resaltan sobre un fondo suave de selva, como un retrato íntimo hecho con paciencia y respeto. Gautier, que además aporta sus imágenes a la ciencia ciudadana para documentar la biodiversidad del país, ofrece aquí una celebración de lo que solo existe en nuestra isla.

Medidas: 20" x 30"$t$, '/images/items/item-08.jpg', 350, 'open'),
  (9, $t$Aventuras$t$, $t$María Cechar$t$, $t$Un sí rotundo a lo desconocido, a toda velocidad y con el corazón por delante.

María Cechar retrata a una pareja que se lanza al camino en una scooter amarilla, con corazones en lugar de rostros y una señal que lo dice todo: Yes to new adventures. El círculo azul profundo, el piso geométrico en blanco y negro y la elegancia de sus personajes crean una escena pop, romántica y llena de movimiento. Es una invitación a decir que sí al amor, al viaje y a todo lo que está por venir.

Técnica: Acrílico y técnica mixta sobre lienzo
Medidas: 44.88" x 44.88"$t$, '/images/items/item-09.jpg', 3995, 'open'),
  (10, $t$Ballena$t$, $t$Javier Gautier$t$, $t$Una ballena jorobada rompe la superficie y, por un instante, el mar entero parece contener la respiración.

Javier Gautier congela el salto de este gigante frente a una costa verde de palmas y casas de colores, en las aguas dominicanas que las ballenas jorobadas visitan cada invierno. El cuerpo surcado de pliegues, las aletas extendidas como alas y el estallido de agua a su alrededor convierten la escena en una muestra de fuerza y libertad. Fiel a su mirada documental, Gautier busca transmitir la naturaleza tal como es, con paz y verdad.

Medidas: 20" x 30"$t$, '/images/items/item-10.jpg', 350, 'open'),
  (11, $t$Monalisa en Azules$t$, $t$Fernando Gallardo · Galería Nader$t$, $t$La sonrisa más famosa del mundo, reinventada en un sueño azul lleno de vuelo y flores.

Fernando Gallardo toma el retrato más célebre de la historia del arte y lo sumerge en una atmósfera de azules profundos, donde la Monalisa conserva su mirada enigmática mientras aves rosadas, mariposas y lirios blancos revolotean a su alrededor. Las texturas del fondo y los toques de color en relieve dan vida a cada detalle, en un diálogo entre lo clásico y lo contemporáneo. Una obra que sorprende a primera vista y revela algo nuevo cada vez que se contempla.

Medidas: 43" x 51"$t$, '/images/items/item-11.jpg', 3995, 'open'),
  (12, $t$Menina Quisqueya III$t$, $t$CEPM · Evergo$t$, $t$Una menina que lleva en su falda todo lo que nos hace dominicanos.

Inspirada en la clásica menina, esta pieza viste los colores de la bandera y una falda escrita a mano con palabras que cuentan el país: merengue, béisbol, larimar, sancocho, hospitalidad, Pico Duarte. Al frente, el sol se asoma entre montañas y mar; detrás, una palmera, la arena blanca y la Isla Saona completan el paisaje. Con una flor en el cabello y la bandera en la mano, es una celebración alegre y colorida de la identidad dominicana, ideal para regalar o para llenar de alegría cualquier espacio.

Medidas: 6" x 10"$t$, '/images/items/item-12.jpg', 300, 'open'),
  (13, $t$Albino$t$, $t$Carlos Bermúdez · Galería Nader$t$, $t$Un caballo blanco gira la cabeza y su mirada clara se queda contigo.

Carlos Bermúdez pinta con precisión casi fotográfica a un caballo albino, de piel nacarada y ojos azules, que se recorta contra un fondo turquesa sereno. Cada detalle está trabajado con paciencia: los pliegues del cuello, el brillo de la piel y la brida negra con acentos rojos que da fuerza a la composición. El encuadre cercano y la curva elegante del cuerpo convierten el retrato en una pieza de presencia silenciosa y magnética.

Técnica: Óleo sobre lienzo
Medidas: 31 1/2" x 44"
País: Colombia$t$, '/images/items/item-13.jpg', 3995, 'open'),
  (14, $t$Playa El Ermitaño$t$, $t$Javier Gautier$t$, $t$Dos palmas que se inclinan hacia el mar y un islote solitario en el horizonte: el Caribe en calma.

Javier Gautier encuentra en Playa El Ermitaño el equilibrio perfecto entre cielo, arena y agua. Las palmas se arquean sobre la orilla, el mar pasa del turquesa al azul profundo y, al fondo, un pequeño islote verde descansa como un ermitaño en medio del agua. Bajo un cielo limpio y luminoso, la escena invita a quedarse, respirar y dejar que el tiempo pase despacio.

Medidas: 20" x 30"$t$, '/images/items/item-14.jpg', 350, 'open'),
  (15, $t$Helena de Troya$t$, $t$Alonso Loaiza · Galería Nader$t$, $t$Belleza, mito y pasión se encuentran en un solo instante suspendido en el tiempo.

Alonso Loaiza evoca a Helena de Troya, la mujer cuya belleza cambió el curso de la historia, en una figura recostada que se entrega al sueño sobre un manto de azules y violetas vibrantes. Detrás de ella, tres caballos de crines doradas emergen como un recuerdo de la leyenda troyana, entre veladuras cálidas y pinceladas sueltas. El contraste entre la delicadeza del cuerpo y la fuerza de los caballos convierte la obra en un poema visual sobre el deseo y el destino.

Técnica: Óleo sobre lienzo
Medidas: 38" x 49"
País: Colombia$t$, '/images/items/item-15.jpg', 3995, 'open')
on conflict (lot_number) do update set
  title          = excluded.title,
  category       = excluded.category,
  description    = excluded.description,
  image_url      = excluded.image_url,
  starting_price = excluded.starting_price,
  updated_at     = now();

-- Verificación: deben aparecer 15 filas.
select lot_number as item, title, category as autor, starting_price, current_bid, status
  from public.auction_items order by lot_number;
