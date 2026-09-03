# DECISIONS.md — Andina Cargo

Cuatro decisiones importantes. El formato es fijo: situación, decisión, alternativas descartadas, qué sacrifiqué, qué rompe a escala 100× y qué haría con una semana más. Están escritas en lenguaje de negocio.

---

## Decisión 1 — Los tres transportistas se convierten a un único modelo de "evento normalizado" en la puerta de entrada

**Situación** — qué había que resolver.
Andes Express nos manda un JSON plano, TransBolívar un JSON anidado con códigos numéricos, y RutaSur campos planos sin zona horaria. Un mismo paquete puede significar "en tránsito" en tres lenguajes distintos, y el equipo de atención no puede leer código de transportista: solo quiere saber *dónde está el paquete*.

**Decisión** — qué hice, en dos líneas.
Cada transportista tiene un adaptador que traduce su formato a un `NormalizedEvent` con un vocabulario común de cinco estados, fecha normalizada y ciudad. El resto del sistema (base de datos, API, panel) solo conoce ese modelo único y nunca ve el formato original.

**Alternativas descartadas** — al menos una, y por qué.
Guardar cada formato tal cual llega y normalizar solo al momento de mostrar. Lo descarté porque la historia de un paquete se ordena y compara entre transportistas, y eso obliga a traducir en cada consulta (lento y con errores repetidos). También descarté pedir a los transportistas que cambien su formato: no tenemos poder sobre ellos, son externos.

**Qué sacrifiqué** — toda decisión cuesta algo.
La información que el formato original tiene y mi modelo no captura se pierde en la traducción. Para no perderla del todo guardo el payload original en la base; pero el estado "canónico" es exactamente cinco y solo cinco, aunque un transportista quisiera darme más matices.

**Qué rompe esto a escala 100×** — dos millones de eventos y cuatro transportistas.
Sumar un transportista nuevo no rompe nada: es escribir un adaptador más y registrarlo, sin tocar el núcleo. Lo que sí presiona es que todos los formatos tienen que seguir cabiendo en el mismo modelo de cinco estados; si mañana un transportista reporta algo que no encaja (por ejemplo una tercera etapa de logística), el modelo se queda corto y habría que ampliarlo con cuidado de no romper los cuatro existentes.
**Qué haría con una semana más** — Validar contra lotes reales históricos de los tres transportistas y medir cuántos eventos caen en "no interpretables", para ajustar el mapa de estados con datos, no con suposiciones.

---

## Decisión 2 — Un mismo paquete con el mismo número de guía existe una vez por transportista

**Situación** — qué había que resolver.
Distintos transportistas usan números de guía de formatos distintos, pero el número no es único a nivel mundial: `AC-4471` lo emite Andes Express y podría existir un número idéntico en otro transportista. El panel busca por guía y debe mostrar la historia de ese paquete *para ese transportista*.

**Decisión** — qué hice, en dos líneas.
La identidad de un envío es la pareja (número de guía + transportista). La consulta por guía devuelve todas las versiones que existan (si el número coincide en dos transportistas, muestra ambas, cada una con su historia). Los eventos de un envío se deduplican para que un mismo aviso no se cuente dos veces.

**Alternativas descartadas** — al menos una, y por qué.
Suponer que el número de guía es único a nivel global e identificarse solo por él. Lo descarté porque es falso en la práctica y produciría mezclar historias de paquetes distintos bajo una misma guía.

**Qué sacrifiqué** — toda decisión cuesta algo.
La búsqueda por guía puede devolver más de un envío si el número se repite entre transportistas. Eso obliga al panel a mostrar varias tarjetas en lugar de una sola respuesta simple; es un poco más de trabajo de pantalla, pero correcto.

**Qué rompe esto a escala 100×** — dos millones de eventos y cuatro transportistas.
No rompe: la pareja (guía, transportista) es única y está indexada, así que la consulta es directa y barata. Lo que crece es el catálogo de paquetes, no la complejidad de cada búsqueda. El punto a vigilar es la deduplicación cuando un transportista reenvía un lote completo de 5.000 eventos; está resuelto con una clave de huella, ver Decisión 4.

**Qué haría con una semana más** — Diseñar la pantalla de "collisiones" para que, cuando una guía exista en varios transportistas, el panel las agrupe y distinga sin confundir al agente.

---

## Decisión 3 — Un evento se considera "el actual" solo si es más nuevo; los eventos fuera de orden no hacen retroceder el estado

**Situación** — qué había que resolver.
Los transportistas empujan lotes hasta tres veces al día, y no garantizan que los eventos lleguen en orden: puede llegar primero "entregado" y después "en tránsito" que ocurrió antes. Si simplemente sobreescribo el estado con lo último recibido, el panel mostraría "en tránsito" después de "entregado", un absurdo para el cliente.

**Decisión** — qué hice, en dos líneas.
El estado actual de un paquete solo avanza cuando el evento entrante ocurrió después del que estaba vigente. Todos los eventos se guardan igual en la historia (cada uno con su fecha real), pero el "estado actual" que se muestra es el de la fecha más reciente, nunca uno antiguo que llegó tarde.

**Alternativas descartadas** — al menos una, y por qué.
Manipular el orden de llegada asumiendo que el último recibido es el correcto (hacer que un evento viejo que llegó tarde marque el estado actual). Lo descarté porque contradice la realidad: la fecha del evento es el dato de verdad, no el orden en que nos enteramos.

**Qué sacrifiqué** — toda decisión cuesta algo.
Necesito guardar más campos denormalizados del "estado actual" en el envío y actualizarlos con una condición, en vez de solo insertar eventos. Es un poco más de lógica en la ingesta, pero la ganancia en confianza del dato es grande.

**Qué rompe esto a escala 100×** — dos millones de eventos y cuatro transportistas.
No rompe: la actualización es por paquete y cada lote toca solo los paquetes que menciona. El costo es que cada envío lleva campos duplicados (sus datos actuales) además de su historia; a dos millones de envíos eso es espacio, pero es espacio que se paga a cambio de responder "dónde está" sin recorrer toda la historia en cada llamada.

**Qué haría con una semana más** — Instrumentar métricas de cuántos eventos llegan fuera de orden, para dimensionar si la regla "solo avanza" necesita una política visible de "aviso tardío" para el agente.

---

## Decisión 4 — La deduplicación se hace con una huella del evento normalizado, no con el payload original

**Situación** — qué había que resolver.
Un transportista puede reenviar el mismo lote (o el mismo evento) varias veces al día, y el aviso llegó tres veces por un corte de red. Sin control, la historia de un paquete se llenaría de duplicados y el panel mostraría "Cúcuta - en tránsito" cuatro veces seguidas sin que haya pasado nada.

**Decisión** — qué hice, en dos líneas.
Al normalizar un evento genero una huella (hash) de sus datos canónicos —guía, transportista, fecha, estado, ciudad— y la cierro como única. Al grabar, si esa huella ya existe, el evento se cuenta como duplicado y se descarta; el mismo aviso reenviado no se repite.

**Alternativas descartadas** — al menos una, y por qué.
Firmar el payload original (el JSON tal cual llega). Lo descarté porque cada transportista escribe el mismo aviso con diferencias menores (espacios, orden de campos, capitalización), y la huella del "texto crudo" fallaría: el mismo evento lógico daría huellas distintas y se duplicaría igual. Firma sobre lo ya normalizado, que es estable.

**Qué sacrifiqué** — toda decisión cuesta algo.
Un evento reenviado con un campo distinto (por ejemplo una ciudad corregida) genera una huella nueva y se trataría como un evento distinto. Es un caso límite raro, pero para ser exacto habría que decidir caso a caso; hoy gana la simplicidad.

**Qué rompe esto a escala 100×** — dos millones de eventos y cuatro transportistas.
La huella es un índice único, así que buscar duplicados es directo y no escanea toda la historia. El riesgo real a escala es el tamaño del lote: 5.000 eventos por lote, tres veces al día, contra una tabla de dos millones de huellas. Está soportado por el índice, pero si el volumen creciera a un ritmo muy superior habría que vigilar el rendimiento de la verificación de duplicados.

**Qué haría con una semana más** — Hacer una estrategia de ventana de deduplicación (solo mirar los eventos de los últimos N días) en vez de una única tabla global de huellas, para mantener la verificación barata a medida que crece el volumen histórico.

---

## Decisión 5 — Producción se despliega en línea (Supabase + Render + Vercel) en lugar de levantar con Docker local

**Situación** — qué había que resolver.
El equipo evaluador debe abrir el sistema y verlo funcionando siguiendo mis instrucciones, sin depender de que en su máquina haya instalados fondos de base de datos ni contenedores. Los datos además deben sobrevivir reinicios.

**Decisión** — qué hice, en dos líneas.
La base de datos real está en Supabase (PostgreSQL), la API en Render y el panel en Vercel. Con tres variables de entorno se conectan: la base con su cadena de conexión, el panel apuntando a la API. Abrir el panel y buscar una guía demuestra el sistema completo en línea.

**Alternativas descartadas** — al menos una, y por qué.
Levantar todo con `docker compose` desde la máquina local (base + API + panel en contenedores). Lo descarté porque era contexto de mi equipo de desarrollo, no del evaluador: exigía Docker instalado y quitaba la garantía de "abrir y ver andar" con un clic en una URL. Para esta prueba, el despliegue en línea es lo que hace el sistema efectivamente reproducible para quien lo revisa.

**Qué sacrifiqué** — toda decisión cuesta algo.
El despliegue en línea requiere configurar tres servicios y sus variables de entorno, y la cadena de conexión de la base queda fuera del repositorio (es un secreto). Pierdo la portabilidad de "todo en una carpeta local", a cambio de una demostración real que funciona desde cualquier navegador.

**Qué rompe esto a escala 100×** — dos millones de eventos y cuatro transportistas.
El despliegue en sí no rompe: Render y Vercel escalan la API y el panel. El cuello de botella pasa a ser la base (Supabase) y el plan de costos a medida que crecen los eventos. A dos millones de eventos hay que pensar en particionar la historia y en indexación, como queda dicho en otros puntos; el despliegue seguiría siendo el mismo.

**Qué haría con una semana más** — Automatizar el despliegue (unos archivos de definición de infraestructura para Render y Vercel) para que levantar entornos de producción y pruebas sea reproducible con un commit, en lugar de configurar a mano el primer día.

---

## Decisión 6 — El panel consulta la API en el momento (sin cachear ni refresco automático)

**Situación** — qué había que resolver.
El agente de atención abre el panel, escribe una guía y quiere saber dónde está el paquete *ahora mismo*. La información cambia a lo largo del día con los lotes de los transportistas, y el dato que se muestre tiene que estar fresco.

**Decisión** — qué hice, en dos líneas.
Cada búsqueda hace una llamada nueva a la API sin cachear, y el panel muestra el estado actual y la historia ordenada en español. No hay actualización automática en vivo; el agente vuelve a buscar cuando quiere un refresco.

**Alternativas descartadas** — al menos una, y por qué.
Refrescar en vivo cada pocos segundos sin que el usuario lo pida (websocket o sondeo). Lo descarté por dos motivos: el negocio consulta por demanda (los lotes llegan a lo sumo tres veces al día, no en stream), y el precio de una conexión permanente es complejidad y consumo sin beneficio real para el caso de uso.

**Qué sacrifiqué** — toda decisión cuesta algo.
Si un aviso llega justo mientras el agente mira la pantalla, el panel no se actualizará solo; tendrá que re-buscar. Es una fricción mínima y previsible, a cambio de un sistema claramente más simple de mantener.

**Qué rompe esto a escala 100×** — dos millones de eventos y cuatro transportistas.
No rompe: cada búsqueda individual sigue siendo barata porque el estado actual está denormalizado en el envío (no se recorre la historia completa para mostrar "dónde está"). Lo que crece es el número de agentes consultando a la vez; eso lo absorbe la API en Render. El punto a vigilar es el costo si creciera mucho el volumen de consultas simultáneas.

**Qué haría con una semana más** — Añadir actualización en vivo como mejora opcional sobre esta base: mantener el modo "bajo demanda" por defecto y ofrecer refresco manual con un botón, sin complicar el camino normal.
