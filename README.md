# PlazaVea BioSec v7 - estructura corregida

## Cómo ejecutar

Opción recomendada en Windows:
1. Extrae el ZIP completo.
2. Entra a la carpeta `plazavea_biosec_mvc_corregido`.
3. Doble clic en `iniciar_servidor_windows.bat`.
4. Se abrirá `http://localhost:8000`.
5. Contraseña del sistema: `2005`.

Opción simple:
- Abre `index.html` con el navegador.

## Estructura

- `index.html`: vista principal lista para abrir.
- `views/index.html`: copia de la vista dentro de carpeta views.
- `assets/css/styles.css`: estilos separados.
- `assets/js/models/modelo.js`: datos, configuración, IndexedDB/localStorage y estado global.
- `assets/js/controllers/controlador.js`: navegación, login, cámaras, empleados, registros y reportes.
- `original_index.html`: respaldo del archivo original completo por si el docente quiere verlo en una sola pieza.

## Nota importante

El reconocimiento facial usa librerías externas por CDN. Para que la cámara e IA funcionen completas, necesitas conexión a internet y permitir cámara en el navegador.
Si la base IndexedDB falla, esta versión usa localStorage como respaldo para que el sistema no se quede colgado al iniciar.
