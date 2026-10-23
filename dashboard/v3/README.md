# Dashboard v3.0 - Lali

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
