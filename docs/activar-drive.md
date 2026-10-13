# Activar el repositorio central de Drive

El código está preparado para cualquier visitante: no necesita una cuenta de Google. El servidor de Vercel obtiene autorización del propietario del repositorio. La conexión Google Drive del chat no autoriza este servidor.

## Configuración del propietario

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o selecciona un proyecto y habilita **Google Drive API**.
2. Configura Google Auth Platform para ese proyecto con tu cuenta como usuario autorizado. Crea un cliente OAuth de tipo **Aplicación web** y añade como URI de redirección `https://developers.google.com/oauthplayground`.
3. Abre [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/). En sus ajustes selecciona **Use your own OAuth credentials** e introduce el Client ID y Client Secret de tu proyecto. Usa acceso **Offline**. Autoriza el alcance `https://www.googleapis.com/auth/drive` con la cuenta que puede escribir en la carpeta Repositorio. Este alcance permite al servidor trabajar con los archivos de esa cuenta; usa una cuenta destinada al repositorio si prefieres separar sus documentos.
4. Intercambia el código por tokens y conserva el **Refresh token**. No copies el access token temporal como refresh token. La autorización la realiza el propietario, una vez; los visitantes no ven esta pantalla.
5. En **Vercel → proyecto wash-fit-full → Settings → Environment Variables**, añade, para Production:

| Variable | Valor |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID del proyecto Google |
| `GOOGLE_CLIENT_SECRET` | Client Secret del mismo cliente |
| `GOOGLE_REFRESH_TOKEN` | Refresh token emitido para ese cliente y esa cuenta |
| `GOOGLE_DRIVE_FOLDER_ID` | `1SjIXFiCnnQwTZTTvCqLY6xJYb9sGxb6z` |
| `WASH_APP_ORIGIN` | `https://wash-fit-full.vercel.app` |

Introduce las credenciales directamente en Vercel, como valores sensibles. No las adjuntes al chat ni las subas a GitHub. El archivo `.env.example` solo contiene nombres y valores públicos. La función usa las variables del servidor, no prefijos `VITE_` o `NEXT_PUBLIC_`.

6. Para uso continuo, revisa el estado de publicación de OAuth. Google indica que los refresh tokens de aplicaciones externas en **Testing** con alcance Drive caducan a los siete días. Publicar el cliente debe seguir los requisitos de Google que correspondan; cambiarlo a producción no equivale a obtener una certificación. [Documentación de OAuth](https://developers.google.com/identity/protocols/oauth2).
7. Integra la rama en `main` y vuelve a desplegar en Vercel después de configurar las variables. Para una vista previa, configura también las variables de Preview y su origen exacto en `WASH_APP_ORIGIN`.

## Comprobación final

En la web desplegada, crea una evaluación de prueba sin datos personales y pulsa **Exportar**. Debe aparecer **JSON y PDF guardados en Drive** y deben existir los dos archivos en la carpeta, con el mismo nombre base. Haz lo mismo con **Imprimir reporte**. La función vuelve a leer en Drive los IDs, tamaños, tipos, carpeta y grupo de ambos archivos antes de declarar éxito.

Cada pulsación crea un nuevo par con el nombre `PAÍS-Establecimiento`, por ejemplo `PER-Hospital_dos_mayo.json` y `PER-Hospital_dos_mayo.pdf`. Se selecciona el país en Datos generales; los JSON anteriores pueden recuperar el país de Ciudad / País. Sin un país reconocible se usa `SIN`. Los nombres eliminan tildes, separan palabras con guiones bajos y omiten artículos y preposiciones de enlace (de, del, la, las, los, el). Las copias pueden tener el mismo nombre en Drive; cada una conserva IDs y un grupo propio, sin sobrescribir las anteriores. **Reintentar Drive** conserva la evaluación que falló y sus sesiones, y evita volver a subir un JSON ya confirmado. Un nuevo Exportar o Imprimir inicia otra captura de la evaluación actual. El JSON se descarga con el mismo nombre base; la impresión propone ese nombre para el PDF, aunque el diálogo permite editarlo.

El borrador local y Drive tienen estados separados. El menú muestra el progreso de cada subida, los errores con reintento, la fecha/hora y enlaces al último par confirmado. Ese registro se conserva en el navegador y señala si el borrador tiene cambios posteriores. No representa un inventario de copias creadas desde otros navegadores.

Los datos grandes se envían por fragmentos de hasta 1 MB al servidor de Vercel, que los transmite a la sesión de subida de Google. Cada petición queda por debajo del límite de cuerpo de las funciones y la confirmación no depende del acceso CORS a Google desde el navegador. Se admite hasta 40 MB por archivo. Las credenciales del propietario nunca se envían al navegador. El servicio es público, según el alcance solicitado: cualquier visitante puede agregar reportes; un control de origen no identifica al visitante. Para limitar el volumen total se puede configurar una regla de rate limiting de Vercel Firewall sobre `/api/drive-archive`; la cuota sigue perteneciendo al propietario del repositorio.

## Reporte guardado

El PDF se genera directamente con datos de la misma captura que el JSON. Separa los seis pasos, incorpora fotos JPEG/PNG (convierte WebP), textos completos, historial, resumen y servicios JMP. Conserva las coordenadas y un enlace a OpenStreetMap; el mapa interactivo continúa en la vista previa de impresión, pero el PDF archivado no incorpora mosaicos externos del mapa.

## Validación realizada y pendiente

Se prueban la generación del PDF, la falta de configuración, los orígenes, el aislamiento de credenciales, la comprobación del par y un reintento que omite el JSON ya guardado. Las llamadas de Drive se simulan en las pruebas: no sustituyen la comprobación final con credenciales reales. Hasta que se configure la autorización del propietario y se verifiquen ambos archivos reales, el guardado automático no se considera activado.

Fuentes: [subidas reanudables de Drive](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [OAuth para servidores](https://developers.google.com/identity/protocols/oauth2/web-server), [pdfmake en navegador](https://pdfmake.github.io/docs/0.1/getting-started/client-side/).
