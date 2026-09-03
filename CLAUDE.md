# DUNNOS AI — guía del proyecto

App web (PWA) para aprender inglés con el Método Directo Progresivo.
Todo el front es HTML/CSS/JS plano, sin build step ni framework.

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa (~537 KB): lecciones, verbos, audio, progreso. Es UN solo archivo, todo inline. |
| `admin.html` | Panel de administración: alta de alumnos, generación de códigos de acceso. |
| `metricas.html` | Panel de métricas de uso. |
| `imagegen.html` | Herramienta interna para generar/probar ilustraciones SVG. |
| `imgbank.json` | Banco de ilustraciones SVG ya generadas y cacheadas. |
| `manifest.json`, `sw.js`, `icons/` | Piezas de la PWA. El service worker borra cachés a propósito, para que cada visita traiga la versión nueva. |
| `netlify.toml` | Config de Netlify: `publish = "."`, funciones en `netlify/functions`, headers `no-cache`. |

## Netlify Functions (`netlify/functions/`)

| Función | Qué hace | Variables de entorno |
|---|---|---|
| `ai-coach.js` | Proxy seguro a la API de Anthropic (conversación de verbos, feedback). | `ANTHROPIC_API_KEY` |
| `generate-image.js` | Genera ilustraciones SVG con Claude. Modelo en la constante `MODEL`. | `ANTHROPIC_API_KEY` |
| `generate-codes.js` | Genera códigos de acceso mensuales (`DUNNO-XXXX-MMYY`). | `ADMIN_KEY` |
| `validate-code.js` | Valida esos códigos al iniciar sesión. | — |
| `progress.js` | Guarda/carga el avance del alumno en Supabase vía REST. Si falla, la app cae a `localStorage`. | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

**Las llaves nunca van en el código ni en el navegador.** Viven solo en
Netlify → Site settings → Environment variables. Si se agrega o cambia una
variable, hay que redesplegar para que las funciones la tomen.

## Cómo se publica (no se sube nada a mano)

Netlify está conectado a este repo de GitHub (`dunnos-ai/dunnos-app`).

1. Se hacen los cambios en una rama y se hace push.
2. Al fusionar la rama en `main`, Netlify despliega solo, en ~1 minuto.
3. No hay build: Netlify sirve los archivos tal cual están en el repo.

O sea: **editar aquí + push a `main` = actualización en vivo.** No hay que
arrastrar archivos a Netlify ni subirlos por la web de GitHub.

## Convenciones

- Mensajes de commit en español, estilo `feat:`, `fix:`, `chore:`.
- No partir `index.html` en varios archivos sin pedirlo: la app depende de
  que todo esté inline.
- Antes de tocar `index.html`, buscar la sección con `grep -n` — es enorme
  y leerlo entero no es práctico.
- Los archivos `dunnos-app` y `dunnos-appv5` (sin extensión) son copias
  viejas de `admin.html` subidas por error. No se usan.
