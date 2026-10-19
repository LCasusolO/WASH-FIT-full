# WASH FIT

Aplicación estática en español para evaluación, riesgos, planificación y seguimiento WASH FIT. Incluye las 100 filas del catálogo final en siete dominios: 99 indicadores evaluables y una instrucción de selección del sistema de saneamiento, sin puntuación. La cantidad visible depende del nivel del establecimiento y del sistema seleccionado.

## Desarrollo y publicación

Requiere Node.js 20 o superior y npm.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run serve
```

La vista local se abre en `http://127.0.0.1:8765`. El build fija y copia Vue, Lucide y Leaflet a `vendor/`, compila Tailwind, genera el service worker y prepara `dist/`. Vercel publica únicamente `dist/` mediante `vercel.json`; la publicación debe comprobarse después de integrar un PR en `main`.

Las dependencias y sus licencias se conservan en los recursos de terceros. La licencia general del proyecto queda pendiente de definición por su propietario.

## Borradores y respaldo

Los cambios se guardan en IndexedDB unos 800 ms después de editar. El estado «Guardado» aparece después de completar la transacción. Al volver a abrir la misma dirección en el mismo navegador y dispositivo, se recuperan datos, respuestas, equipo, planes, historial y fotografías.

- «Nueva evaluación» conserva el borrador actual como respaldo antes de abrir una evaluación vacía.
- Importar valida todo el archivo antes de reemplazar el estado. Conserva el borrador anterior y admite JSON antiguos sin versión.
- «Recuperar respaldo anterior» intercambia el borrador actual y el respaldo.
- Exportar descarga JSON con `schemaVersion: 2` y fecha de guardado. El catálogo y sus textos se recuperan de la versión canónica; el JSON no puede reemplazar las definiciones de indicadores.
- El límite de importación es 40 MB. Las fotografías admitidas son JPG, PNG y WebP, hasta 5 MB cada una, máximo 20. Se convierten a JPEG y se reducen a 1.200 píxeles.

Este guardado es local y depende del almacenamiento del navegador. Incógnito, limpieza de datos o políticas del sistema pueden eliminarlo. Los dispositivos no se sincronizan; el JSON permite trasladar la evaluación. Exporte respaldos de los trabajos importantes. «Guardando» o «Error al guardar» indican que aún no se confirmó la persistencia.

Solo un borrador activo por navegador/origen. Evite editar la misma evaluación en varias pestañas simultáneamente.

## Uso sin conexión

Tras la primera visita por HTTPS (o localhost), el service worker conserva la interfaz, scripts, estilos e imágenes institucionales. La evaluación y sus borradores pueden seguir utilizándose sin internet. El mapa OpenStreetMap requiere red; las coordenadas siguen en el borrador y el reporte. No se descargan mapas para uso offline. Los mensajes de conexión se retiraron de la interfaz por solicitud del propietario.

Las actualizaciones se instalan y activan en segundo plano, sin avisos ni botones. Al abrir o recargar la web con conexión, se solicita el HTML actual y sus recursos versionados; sin conexión se conserva la copia instalada. Una evaluación abierta no se recarga automáticamente, para no interrumpir la edición ni las cargas de archivos. Los borradores están en una base independiente del caché estático. No se utiliza Google Fonts ni un compilador CSS remoto.

## Resultados JMP y valoración

Referencia: [definiciones JMP para establecimientos de salud](https://washdata.org/topics/health-care-facilities).

La app utiliza las equivalencias numéricas de la matriz aprobadas por el propietario: 2 = verde, 1 = amarillo, 0 = rojo. Esta adaptación se calcula con las reglas siguientes:

- **Agua:** usa `A_1a` en primer nivel o `A_1b` en segundo/tercer nivel, junto con `A_3`. Básico si ambos son 1 o 2; Limitado si la fuente es 1 o 2 y `A_3 = 0`; Sin Servicio si la fuente es 0, independientemente de `A_3`.
- **Saneamiento:** usa `S_1`, `S_2`, `S_4`, `S_5`, `S_6`, `S_7`. Básico si todos son 1 o 2; Limitado si los dos primeros son 1 o 2 y alguno de los demás es 0; Sin Servicio si `S_1 = 0` o `S_2 = 0`. `S_3` se evalúa en higiene.
- **Residuos:** usa `RES_2` y `RES_10` (tratamiento local) o `RES_12` (externo). Básico si ambos son 1 o 2; Limitado si solo uno es 0; Sin Servicio si ambos son 0. Se respeta la ruta explícita guardada; si no hay ruta seleccionada, se utilizan los tratamientos respondidos y, si ambos están evaluados, el menor puntaje. `RES_11`, `RES_13`, `RES_14` y las confirmaciones antiguas no sustituyen ni condicionan estos puntajes.
- **Higiene:** usa `H_1` y `S_3`. Básico si ambos son 1 o 2; Limitado si solo uno es 0; Sin Servicio si ambos son 0. `H_2` no sustituye a `S_3`.
- **Limpieza:** usa `L_1` y `L_5`. Básico si `L_1` es 1 o 2 y `L_5 = 2`; Sin Servicio si ambos son 0; las demás combinaciones respondidas son Limitado.
- Por decisión del propietario, las respuestas vacías cuentan como 0 (rojo) exclusivamente para calcular JMP, incluso si tienen una justificación de no aplicabilidad. No se modifican las respuestas guardadas. JMP siempre muestra Básico, Limitado o Sin Servicio. Las observaciones antiguas de agua y la confirmación de tratamiento seguro se conservan para compatibilidad, pero no modifican la clasificación numérica. Los puntajes WASH FIT no sustituyen todas las preguntas del instrumento JMP.
- El cumplimiento y la valoración general se calculan sobre los indicadores respondidos, junto con la cobertura visible. La valoración muestra Sin evaluar si aún no se respondió ninguno; después muestra el resultado actual sin esperar a completar todos los dominios.
- El riesgo es **gravedad + probabilidad**, de 0 a 20: bajo 0–7, medio 8–14, alto 15–20. Se conserva la suma por instrucción del propietario.

## Equipo, monitoreo y reporte

Los responsables se vinculan al equipo por ID. Renombrar un integrante actualiza la etiqueta del plan; removerlo conserva su nombre como responsable no vinculado. «Registrar revisión» guarda una instantánea fechada de respuestas, riesgos, acción, responsable, costos, plazos y comentarios, hasta 200 revisiones por indicador. El estado visible se considera retrasado al vencer su plazo, salvo que esté completado.

El reporte tiene una vista de lectura separada en seis pasos: Datos Generales, Evaluación de la Situación, Evaluación del Riesgo, Plan de Mejora, Monitoreo y Revisión, y Resumen. Cada paso empieza en una página nueva al imprimir. Use «Vista previa del reporte» o «Imprimir / guardar PDF». El navegador controla la paginación final; antes de compartir, revise el PDF, especialmente si tiene textos o historiales extensos.

## Alcance de esta actualización

Se implementan los puntos 2–8, 12 y 14–20 del análisis. El punto 1 ya fue integrado previamente. Por instrucción del propietario se conservan:

- Punto 9: filtros y elección del sistema de saneamiento.
- Punto 10: comportamiento de desmarcar respuestas y reiniciar módulos.
- Punto 13: opciones/valor inicial del nivel y reglas de aplicabilidad.

En la revisión posterior se autorizó corregir el punto 11. La tabla de riesgo ahora muestra un único resultado por indicador: «Cumple», «Cumple Parcialmente» o «No Cumple», tomado de la misma respuesta de la evaluación de situación. La validación conserva los niveles existentes y no cambia qué preguntas se muestran. El encabezado muestra «Cumplimiento Global»; debajo están el estado de guardado y los iconos de Nueva evaluación y Recuperar respaldo anterior. Los iconos conservan etiquetas accesibles y ayuda al pasar el puntero. Recuperar respaldo permanece deshabilitado mientras no exista uno. Se retiraron del Plan de Mejora los contadores de avance y del Resumen el panel de observaciones JMP, manteniendo la vista previa.

Se aclararon límites de respuesta de `A_2`, `A_3`, `A_8` y `RES_2`, y se corrigieron errores editoriales. Los umbrales sanitarios específicos y las adaptaciones nacionales requieren una validación metodológica independiente; esta actualización no declara certificación del catálogo por OPS/OMS.

## Repositorio central de Google Drive

Exportar e Imprimir reporte preparan el JSON y un PDF de seis pasos desde una misma captura y los envían a la carpeta configurada. Cada guardado busca en la carpeta el nombre de país/establecimiento y tipo de archivo. Si existe, actualiza el mismo ID; si no, lo crea. Ante duplicados anteriores, actualiza la copia más antigua sin borrar las demás. La aplicación confirma ambos archivos en Drive antes de anunciar el guardado. Si falla, conserva el par pendiente en memoria y permite reintentar sin duplicar los archivos confirmados. La descarga local de JSON y la impresión siguen disponibles.

Al imprimir, el diálogo local se abre en cuanto el HTML está listo; la generación del PDF con Chrome y la subida al repositorio continúan en segundo plano sin bloquear la impresión. Ambos procesos utilizan la misma captura. El reporte y el mapa no se preparan por segunda vez para archivar esa captura.

La subida requiere autorización del propietario en el servidor de Vercel. No usa la conexión Drive de un chat, y los visitantes no necesitan iniciar sesión con Google. Consulte [activar el repositorio](docs/activar-drive.md). Hasta completar esa configuración y una prueba real, el repositorio no está activado. El PDF archivado se genera con Chrome/Chromium a partir del mismo HTML y CSS de impresión: conserva las tablas, el mapa y el radar. El servidor incluye Chromium; no requiere un servicio externo. Si la generación falla, se muestra el error y se permite reintentar, sin sustituirlo por otra plantilla.

## Validación

`npm test` verifica clasificaciones completas/incompletas, errores de importación, migración de JSON, responsabilidades/historial, límites numéricos, persistencia/respaldos y conservación de los puntos excluidos. Las pruebas de aplicación aíslan Vue para comprobar las reglas; la interfaz se verifica también en navegador.
