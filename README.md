# WASH FIT

Aplicación estática en español para evaluación, riesgos, planificación y seguimiento WASH FIT. Incluye 99 indicadores en siete dominios; la cantidad visible depende de los filtros existentes.

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

Las actualizaciones se activan al cerrar las pestañas de esta aplicación y volver a abrirla. Si hay una versión esperando, «Guardar y actualizar aplicación» conserva el borrador antes de recargar. Los borradores están en una base independiente del caché estático. No se utiliza Google Fonts ni un compilador CSS remoto.

## Resultados JMP y valoración

Referencia: [definiciones JMP para establecimientos de salud](https://washdata.org/topics/health-care-facilities).

- **Agua:** usa `A_1a` o `A_1b` según el nivel y `A_3`. Una fuente mejorada en el predio y agua disponible en la visita representan servicio básico. `A_3 = 2` permite inferir disponibilidad durante las horas de operación. Una respuesta de continuidad parcial no demuestra disponibilidad el día de visita; sin información suficiente, la categoría permanece incompleta. El panel de observaciones adicionales se retiró por solicitud del propietario; los valores guardados en archivos anteriores se conservan para compatibilidad.
- **Residuos:** usa segregación efectiva `RES_2` y la ruta de tratamiento. Fuera del centro usa `RES_12`. Dentro del centro usa `RES_10`, `RES_11`, `RES_13` y una confirmación explícita de tratamiento/disposición seguros de infecciosos y punzocortantes. `RES_14` no reemplaza el tratamiento.
- **Higiene:** usa `H_1` y `S_3`. Las estaciones de zonas públicas (`H_2`) no sustituyen las de los baños.
- **Limpieza:** usa `L_1` y `L_5`. Saneamiento conserva los criterios anteriores; se exige información suficiente antes de mostrar categoría.
- Los datos ausentes producen «Sin evaluar» o «Evaluación incompleta». La clasificación es una interpretación de los indicadores y observaciones registrados; requiere verificación en campo. Los puntajes WASH FIT no sustituyen todas las preguntas del instrumento JMP.
- El cumplimiento se calcula únicamente sobre indicadores respondidos. Siempre debe interpretarse junto a la cobertura. La valoración global del establecimiento se emite solo al completar todos los indicadores visibles.
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

Exportar e Imprimir reporte preparan el JSON y un PDF de seis pasos desde una misma captura y los envían a la carpeta configurada. La aplicación confirma ambos archivos en Drive antes de anunciar el guardado. Si falla, conserva el par pendiente en memoria y permite reintentar sin duplicar los archivos confirmados. La descarga local de JSON y la impresión siguen disponibles.

La subida requiere autorización del propietario en el servidor de Vercel. No usa la conexión Drive de un chat, y los visitantes no necesitan iniciar sesión con Google. Consulte [activar el repositorio](docs/activar-drive.md). Hasta completar esa configuración y una prueba real, el repositorio no está activado. El PDF archivado conserva coordenadas y enlace al mapa; los mosaicos interactivos permanecen en la vista previa.

## Validación

`npm test` verifica clasificaciones completas/incompletas, errores de importación, migración de JSON, responsabilidades/historial, límites numéricos, persistencia/respaldos y conservación de los puntos excluidos. Las pruebas de aplicación aíslan Vue para comprobar las reglas; la interfaz se verifica también en navegador.
