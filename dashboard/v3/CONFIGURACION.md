# Configuración de Dashboard v3.0

## 1. Crear el proyecto Supabase
1. Entrá en https://supabase.com/ y creá un proyecto en el plan Free.
2. Guardá de forma segura la contraseña de la base de datos; la aplicación no necesita esa contraseña directa.
3. En **SQL Editor**, creá una consulta nueva, pegá el contenido de `schema.sql` y ejecutala.
4. En **Project Settings → API** (o la sección equivalente de API Keys), copiá la Project URL y la clave pública `anon`/`publishable`. No uses `service_role` ni una secret key.

## 2. Ajustar autenticación
En **Authentication → URL Configuration**: durante las pruebas, agregá la URL local `http://localhost:3000` a las URLs permitidas. Después de desplegar, agregá la URL HTTPS exacta que Render asigne al servicio y configurala como Site URL.

En las opciones de Authentication, mantené la confirmación por correo habilitada para producción. Configurá la política de contraseñas para exigir al menos 8 caracteres y una complejidad adecuada. La política exacta disponible puede variar según la configuración de Auth de Supabase.

## 3. Prueba local
1. En `config.js`, reemplazá `https://TU_PROYECTO.supabase.co` y `TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE` por los valores de tu proyecto.
2. Desde la carpeta `dashboard/v3`, ejecutá `npm install` y luego `npm start`.
3. Abrí `http://localhost:3000`, creá tu cuenta y confirmá el correo si te lo solicita.
4. Creá un trabajo de prueba, cerrá sesión y volvé a ingresar. El registro debe seguir ahí.
5. Si vas a probar aislamiento, creá una segunda cuenta con otro correo: no debe poder ver los datos de la primera.

## 4. Despliegue en Render
1. Subí el repositorio a GitHub con `dashboard/v3` incluido.
2. En Render, elegí **New → Web Service** y conectá el repositorio.
3. Configurá **Root Directory** como `dashboard/v3`.
4. Build Command: `npm install`.
5. Start Command: `npm start`.
6. En **Environment**, agregá estas variables:
   - `SUPABASE_URL` = Project URL de Supabase.
   - `SUPABASE_ANON_KEY` = clave pública anon/publishable de Supabase.
7. Desplegá y comprobá `https://TU-SERVICIO.onrender.com/health` (debe responder JSON con `status: ok`).
8. En Supabase, agregá la URL real de Render a las URLs permitidas de autenticación.
9. Actualizá en la página inicial del proyecto el enlace de acceso para que apunte a la URL real asignada por Render.

## 5. Verificación de seguridad obligatoria
- En Supabase, confirmá que RLS esté habilitado en las tres tablas `dashboard_jobs`, `dashboard_projects` y `dashboard_tools`.
- Confirmá que cada tabla tenga su política `Users manage their own ...` y que las operaciones requieran `authenticated`.
- Nunca incluyas `service_role` ni una contraseña de PostgreSQL en archivos del frontend, GitHub o variables que se envíen al navegador.
- La clave anon/publishable sí se usa en el navegador y no es un secreto; solo es segura con las políticas RLS correctamente aplicadas.
- Probá dos cuentas separadas antes de usar datos reales.

## Nota sobre privacidad
Render aloja la aplicación; no hace que los datos sean privados por sí solo. El aislamiento real lo aportan la autenticación y las políticas RLS de Supabase. El código actual conserva gran parte del renderizado HTML dinámico de la v2; antes de comercializarla, hace falta una auditoría de seguridad adicional de las interpolaciones de datos de usuario y de los flujos de recuperación de contraseña.
