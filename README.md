# Velio · web

Interfaz web de [Velio](../../cycling-router): genera rutas ciclistas circulares
y punto a punto sobre la API FastAPI del motor, las puntúa por firme, seguridad
y desnivel, y las guarda.

SPA de React sobre Vite, con HeroUI v3 y Tailwind v4.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Necesita el backend en marcha. Desde el repositorio del motor:

```bash
uvicorn app.main:app --reload --port 8000
```

El proxy de Vite reenvía `/api` a `http://127.0.0.1:8000`, así que en desarrollo
no hay que tocar CORS.

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo con HMR |
| `pnpm build` | Comprobación de tipos y build de producción |
| `pnpm typecheck` | Solo tipos |
| `pnpm lint` | Oxlint |
| `pnpm test` | Vitest |
| `pnpm test:coverage` | Vitest con cobertura |

## Cómo está organizado

```
src/
  api/         Cliente HTTP y un módulo por área de la API
  types/api.ts Contrato de la API, reflejo de cycling-router/docs/api.md
  auth/        Sesión, almacenamiento de tokens y guardas de ruta
  components/  common · layout · map · planner · route · auth
  pages/       Una por pantalla
  lib/         Formato, polilíneas, GPX, paleta de datos, métricas
  i18n/        es y en; fuente única de la terminología
```

### La capa de datos manda

`src/types/api.ts` es un reflejo literal de `docs/api.md` del backend. Si la API
cambia, se cambia ahí primero y el compilador señala el resto.

Los endpoints de cálculo (`/loops`, `/routes`, `/routes/analyze`,
`/routes/elevation`) exigen `Authorization: Bearer`, así que **toda la
aplicación vive detrás del login**. No hay modo invitado.

El refresco de sesión es de un solo vuelo (`src/api/client.ts`): sin eso, varias
peticiones simultáneas con el token caducado dispararían varias rotaciones, y el
backend trata la reutilización de un refresh token como robo y cierra todas las
sesiones del usuario.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Portada pública. Con sesión abierta redirige a `/planificar` |
| `/planificar` | Planificador de circuitos |
| `/punto-a-punto`, `/analizar`, `/guardadas`, `/cuenta` | El resto de la aplicación, tras el login |
| `/entrar`, `/crear-cuenta`, `/verificar`, `/recuperar`, `/nueva-contrasena` | Acceso |
| `/oauth/callback` | Vuelta del proveedor de OAuth |

## Marca y tema

Paleta: `#FFFFFF`, `#222222`, `#126CC7`. HeroUI v3 tematiza con variables CSS
planas, así que todo vive en `src/styles/globals.css`.

El azul de marca da 5,26:1 sobre blanco, pero solo **3,03:1 sobre `#222222`**,
por debajo de AA. En modo oscuro se parte en dos usos manteniendo el tono:

| Uso | Color | Contraste |
|---|---|---|
| Relleno (botón primario) | `#2D75C7` | 4,69:1 con texto blanco |
| Texto y enlaces | `#5AA1F6` | 5,96:1 sobre `#222222` |

El tema se aplica en un script en línea de `index.html` antes de pintar, para que
no haya destello claro al recargar en modo oscuro.

### Dos trampas del tema de HeroUI

Ambas costaron un rato, así que quedan escritas:

1. **Los campos no llevan borde.** HeroUI define `--field-border-width: 0` y los
   distingue solo con fondo y sombra elevada. Sobre una página blanca de marca,
   un campo blanco con esa sombra flota en vez de integrarse, así que aquí el
   campo es un hueco: fondo apenas teñido, borde de 1 px y sin elevación.
2. **`--field-shadow: none` mata el anillo de foco.** El anillo es un `ring-2` de
   Tailwind, que compone `box-shadow` con `--tw-shadow`; poner `none` invalida la
   lista entera y el campo enfocado se queda sin ninguna señal. Va una sombra
   transparente pero válida (`0 0 0 0 transparent`), el mismo truco que usa el
   tema oscuro de HeroUI.

Y un tercer detalle de cascada: el bloque claro se escribe sobre `:root`, que
también aplica en oscuro, y va **después** del `.dark` de HeroUI. Cualquier
variable que se toque en el bloque claro hay que repetirla en el oscuro o se
filtra.

### Dropdown.Trigger no admite un botón dentro

`Dropdown.Trigger` **ya es** el `<button>`. Meter un `<Button>` de HeroUI dentro
produce `<button><button>`, HTML inválido. Pero al pasarle las clases del botón
aparece un segundo problema: `.dropdown__trigger` impone `display: block` y gana
a `.button`, que es inline-flex, así que `justify-center` deja de hacer nada, el
icono se pega al borde izquierdo y el fondo del hover se ve desplazado.

`src/components/common/dropdownTrigger.ts` resuelve las dos cosas de una vez;
úsalo para cualquier disparador con aspecto de botón. Hay un test de regresión
en `themeToggle.test.tsx`, porque ninguno de los dos fallos lo ve el compilador
ni el linter.

### Tres trampas del mapa

Las tres daban un mapa en blanco o sin ruta, y ninguna la ve el compilador:

1. **No dimensionar el contenedor por posicionamiento.** maplibre le añade la
   clase `.maplibregl-map`, que trae `position: relative` desde una hoja **sin
   capa**, y en CSS lo no-capado gana a cualquier capa — incluida `utilities`,
   donde Tailwind v4 mete sus utilidades. Con `absolute inset-0`, ese `relative`
   ganaba, `inset-0` quedaba inerte y el div colapsaba a 0 de alto. Va
   `size-full`, que no compite con `position`.
2. **`setStyle` con el mismo estilo es un no-op y no emite `styledata`.** Se
   llamaba en el montaje con el estilo que ya puso el constructor, colgando la
   siembra de fuentes y capas de un `once('styledata')` que nunca llegaba: mapa
   sin ruta. Ahora el estilo solo se cambia cuando cambia de verdad, y la
   siembra escucha `styledata` **y** `idle`, porque durante un cambio de estilo
   `styledata` puede llegar con el estilo a medias.
3. **maplibre y el pre-bundling de Vite.** Vite reescribe la ruta de su worker
   y en desarrollo da 404: el mapa monta pero no decodifica ni una tesela. Se
   excluye en `optimizeDeps` (`vite.config.ts`). Al cargarse en diferido, Vite
   lo descubre tarde y el problema es más probable.

Y una cuarta, de uso: el panel de resultado flota sobre el mapa, así que
`fitPadding` reserva sitio abajo o la ruta se encuadra centrada y queda
detrás de él.

### El logo

`src/components/layout/logo.tsx` está **generado** desde `public/velio.svg`: los
dos trazados se copian tal cual, no se transcriben. Si el logo cambia, se vuelve
a generar en vez de editarse a mano. `VelioMark` es solo el símbolo (raíl,
favicon) y `VelioLogo` el lockup completo; ambos heredan `currentColor`.

## Mapas sin API key

- **Mapa**: Carto Positron (claro) y Dark Matter (oscuro), vectoriales.
- **Satélite**: ortofoto PNOA del IGN. Solo cubre España, que es justo el alcance
  del grafo de Valhalla del backend.

Ninguno pide credenciales. El estilo se cambia en `src/lib/mapStyles.ts`.

`maplibre-gl` pesa cerca de un megabyte, así que se carga en su propio chunk
(`src/components/map/lazyMap.tsx`): las pantallas de acceso no lo descargan.

## Colores de datos

La paleta de gráficos (`src/lib/chartPalette.ts`) está validada con el script de
la guía de visualización contra los fondos reales de cada modo: banda de
luminosidad, croma mínimo, separación para daltonismo, suelo de visión normal y
contraste. Modo claro y oscuro tienen pasos propios, no un volteo del otro.

**Aviso que hay que respetar**: el par naranja↔verde queda en la banda baja de
tritanopía (ΔE 5,0 claro / 3,7 oscuro). Solo es admisible con codificación
secundaria, así que la barra de firme lleva etiqueta directa en cada tramo y 2 px
de separación. Hay un test que lo vigila (`surfaceBar.test.tsx`); si desaparecen
las etiquetas, el gráfico deja de ser accesible.

## Terminología

`src/i18n/es.ts` es la fuente única. Un concepto, un nombre:

| Campo de la API | Cómo se llama en pantalla |
|---|---|
| `gain_m` | Desnivel + (nunca "Subida" ni "Ascenso") |
| `loss_m` | Desnivel − |
| `cycling_score` | Puntuación (nunca "Nota") |
| `score.comfort` | Firme (nunca "Comodidad") |
| `score.max_grade_pct` | Rampa máx. |
| `overlap_ratio` | Solape |
| el objeto en sí | Ruta (nunca "Trazado" ni "Track") |

Las cifras llevan coma decimal, también las coordenadas: mezclar `40.5964` con
`68,8` en el mismo panel se lee como un fallo. Todo pasa por `src/lib/format.ts`.

## Decisiones que conviene revisar

- **El refresh token vive en `localStorage`** y el access token solo en memoria.
  Es lo máximo que se puede hacer sin apoyo del backend: la API entrega los
  tokens en el cuerpo de la respuesta, no como cookie `httpOnly`. Si algún día
  las emite como cookie, este almacenamiento sobra.
- **OAuth necesita dos variables en el backend**, y son distintas:
  `AUTH_REDIRECT_BASE` sigue apuntando **a la API** (es la URI registrada en
  Google), y `OAUTH_SUCCESS_REDIRECT=http://localhost:5173/oauth/callback` es
  adónde manda la API el navegador después. Sin la segunda, el callback
  responde JSON y el usuario aterriza en una página cruda.
  Los tokens llegan en el **fragmento** (`#`), que nunca viaja al servidor:
  `src/pages/auth/oauthCallback.tsx` los adopta, pide `/auth/me` y limpia la
  barra de direcciones en el acto.
- **La búsqueda de rutas guardadas filtra la página cargada, no el total**: la
  API no tiene endpoint de búsqueda.
- **El export desde el detalle de una ruta guardada se genera en el cliente**
  (`src/lib/exportLocal.ts`). Los `?format=gpx` del backend recalculan a partir
  de la petición original, y de una ruta guardada solo tenemos el resultado.
- **El desglose de firme normaliza sobre la distancia real**, no sobre la suma de
  `surface_km`: no todas las aristas traen atributo de firme, y el hueco se
  muestra como "sin datos" en vez de repartirse.
- **La portada usa el ejemplo de `docs/api.md`** (circuito de 70 km desde
  Algete) para la tarjeta de demostración, con los componentes reales del
  producto. El perfil de elevación de esa tarjeta sí es sintético y la tarjeta
  lo dice. No hay precios ni testimonios inventados.
- **El mapa limita la navegación a España** (`maxBounds` en `mapView.tsx`),
  porque es lo que cubre el grafo del backend.

## Licencias de los datos

Cartografía © [OpenStreetMap](https://www.openstreetmap.org/copyright),
estilos de [CARTO](https://carto.com/attribution/).
Ortofoto PNOA cedida por © Instituto Geográfico Nacional de España.
Elevaciones: Copernicus DEM GLO-30, a través del backend.
