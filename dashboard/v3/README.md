# Dashboard v3.1.0 - Lali

Aplicación web para organizar trabajos, proyectos, tareas y herramientas. Esta versión incorpora cuentas con Supabase Auth y almacenamiento PostgreSQL separado por usuario mediante Row Level Security (RLS).

## Stack
- HTML, CSS y JavaScript (mantiene la interfaz de la v2).
- Node.js + Express para servir la aplicación en Render.
- Supabase Auth para registro, inicio/cierre de sesión y recuperación de contraseña.
- Supabase PostgreSQL para los registros personales.

## Archivos importantes
- `index.html`, `script.js`, `style.css`: aplicación.
- `config.js`: configuración local de ejemplo; no contiene credenciales válidas.
- `server.js`, `package.json`: servidor de Render.
- `schema.sql`: esquema y políticas RLS de Supabase.
- `CONFIGURACION.md`: guía de puesta en marcha.

## Desarrollo local
1. Instalar Node.js LTS.
2. Ejecutar `npm install`.
3. Completar `config.js` con la URL del proyecto Supabase y su clave pública anon/publishable.
4. Ejecutar `npm start` y abrir `http://localhost:3000`.
5. Ejecutar antes `schema.sql` en el SQL Editor de Supabase.

No se incluye importación de datos de la versión anterior. La exportación JSON queda disponible como copia de seguridad; no se utiliza para sincronizar datos.

## Seguridad
Nunca colocar la clave `service_role` en el navegador ni en `config.js`. En Render se recomienda configurar `SUPABASE_URL` y `SUPABASE_ANON_KEY` como variables de entorno. No publicar el dashboard antes de ejecutar el SQL y verificar las políticas RLS.


## Corrección de autenticación (v3.0.1)
- Se quitó el botón duplicado de Ingresar en la parte superior.
- El botón superior permite alternar entre Crear cuenta e Ingresar; el botón del formulario ejecuta la acción seleccionada.
- Se conectaron los eventos de autenticación mediante JavaScript y se ajustó la CSP para compatibilidad con los controladores inline heredados de la aplicación. Esta excepción de CSP es temporal; antes de comercializar conviene migrar todos los controladores inline y retirarla.


## Versión 3.0.1

- Se reemplazaron los manejadores de eventos inline por `addEventListener` y delegación de eventos.
- Se eliminó la opción y la función de exportación JSON.
- Se agregó escape de texto dinámico antes de insertarlo en HTML y validación de URL para enlaces externos.
- Se retiró la excepción CSP `script-src-attr 'unsafe-inline'` y el permiso `'unsafe-inline'` de `script-src`.
- Los datos continúan guardándose en Supabase por usuario. La exportación no era el mecanismo de persistencia.
- La advertencia de Tailwind CDN sigue siendo independiente; se recomienda compilar Tailwind localmente antes de una publicación comercial.


## Versión 3.1.0
- Se agregó una ventana de Perfil con apodo sincronizado mediante Supabase Auth, cambio de contraseña y descarga de Backup JSON.
- Se agregaron ventanas emergentes de Términos y condiciones y Política de privacidad, accesibles desde el footer y durante el registro.
- El registro requiere aceptar ambos documentos y guarda fecha/versión de aceptación en los metadatos de la cuenta.
- El Backup JSON incluye los trabajos, proyectos y herramientas de la cuenta activa.

**Importante:** los textos legales incluidos son una base inicial genérica y deben revisarse/adaptarse a la identidad de la persona responsable, los datos de contacto, el funcionamiento real del servicio y la normativa aplicable antes de abrir el registro al público o comercializar la plataforma. La aceptación obligatoria está aplicada en el flujo de registro de la interfaz; no constituye una validación legal independiente del lado del servidor.


## v3.2.0 — Tableros Kanban
- Tablero por cada proyecto y trabajo, con cuatro estados fijos: Pendiente, En progreso, En revisión y Completada.
- Tareas con título, descripción, prioridad, fecha límite y etiqueta opcional.
- Las tareas Kanban se almacenan dentro del campo JSONB `data` del registro padre (`dashboard_projects` o `dashboard_jobs`), respetando el aislamiento por usuario ya aplicado con RLS.
- No requiere migración SQL: reutiliza las tablas existentes y persiste con el mecanismo de guardado actual.
