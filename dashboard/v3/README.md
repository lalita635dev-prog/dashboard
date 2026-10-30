# Dashboard Project v3

Aplicación web para organizar trabajos, proyectos, tareas, herramientas y recordatorios. Esta versión incorpora cuentas con Supabase Auth y almacenamiento PostgreSQL separado por usuario mediante Row Level Security (RLS).

## Stack

- HTML, CSS y JavaScript (mantiene la interfaz y estructura de la v2).
- Node.js + Express para servir la aplicación en Render.
- Supabase Auth para registro, inicio/cierre de sesión y recuperación de contraseña.
- Supabase PostgreSQL para almacenar los registros personales.
- Render para hosting de la aplicación.

## Versión 3.0.1 — Seguridad y persistencia

- Se reemplazaron los manejadores de eventos inline por `addEventListener` y delegación de eventos.
- Se eliminó la opción y la función de exportación JSON de la interfaz principal.
- Se agregó escape de texto dinámico antes de insertarlo en HTML y validación de URL para enlaces externos.
- Se retiró la excepción CSP `script-src-attr 'unsafe-inline'` y el permiso `'unsafe-inline'` de `script-src`.
- Los datos continúan guardándose en Supabase por usuario. La exportación no era el mecanismo de persistencia.
- La advertencia de Tailwind CDN sigue siendo independiente; se recomienda compilar Tailwind localmente antes de una publicación comercial.

## Versión 3.1.0 — Perfil y documentos legales

- Se agregó una ventana de Perfil con apodo sincronizado mediante Supabase Auth, cambio de contraseña y descarga de Backup JSON.
- Se agregaron ventanas emergentes de Términos y condiciones y Política de privacidad, accesibles desde el footer y durante el registro.
- El registro requiere aceptar ambos documentos y guarda fecha y versión de aceptación en los metadatos de la cuenta.
- El Backup JSON incluye los trabajos, proyectos y herramientas de la cuenta activa.

## Versión 3.2.0 — Tableros Kanban

- Se agregó un tablero Kanban para cada proyecto y trabajo.
- Se incorporaron cuatro estados fijos: Pendiente, En progreso, En revisión y Completada.
- Las tareas incluyen título, descripción, prioridad, fecha límite y etiqueta opcional.
- Las tareas Kanban se almacenan dentro del campo JSONB `data` del registro padre (`dashboard_projects` o `dashboard_jobs`), respetando el aislamiento por usuario aplicado con RLS.
- Los tableros se acceden desde la ficha de cada proyecto o trabajo.
- No requiere migración SQL: reutiliza las tablas existentes y persiste con el mecanismo de guardado actual.

## Versión 3.3.0 — Agenda y recordatorios

- Se agregó una agenda mensual única por usuario, independiente de los proyectos y trabajos.
- Los recordatorios permiten crear, editar, eliminar y marcar como realizados.
- Cada recordatorio puede tener un color personalizado para identificar categorías.
- Los recordatorios pueden relacionarse opcionalmente con un proyecto, un trabajo o una tarea Kanban.
- Se incorporaron alertas dentro de la aplicación mientras está abierta.
- Los recordatorios sin hora se notifican a las 09:00 hora local del dispositivo.
- Se agregó un popup de notificación superpuesto a la web, que permanece visible hasta que el usuario elija una acción.
- El popup permite reprogramar, posponer 5 o 10 minutos, cerrar el aviso o marcar el recordatorio como realizado.
- Los avisos pendientes se presentan en una cola para evitar que varios recordatorios se superpongan.
- Al posponer, se actualizan la fecha y hora del recordatorio en Supabase.
- El Backup JSON del Perfil incluye los recordatorios.
- Antes de desplegar esta versión, ejecutar `migration_calendar.sql` en Supabase SQL Editor para crear `dashboard_reminders` y sus políticas RLS.

## Versión 3.4.0 — Home y panel de resumen

- Se incorporó una nueva pantalla inicial denominada Home, que se muestra al iniciar sesión.
- Se agregó un saludo personalizado que muestra el Nick del usuario o su correo electrónico si todavía no configuró un apodo.
- Se incorporó un acceso directo para editar el Perfil desde Home.
- Se agregó un gráfico estadístico dinámico con la cantidad de trabajos, proyectos, herramientas y recordatorios pendientes.
- Se incorporó una vista rápida de los próximos cinco recordatorios pendientes.
- Desde Home es posible editar, eliminar y marcar recordatorios como realizados.
- Se agregó un acceso directo para crear nuevos recordatorios y abrir la Agenda.
- Se incorporó un panel de tareas Kanban pendientes con vencimiento dentro del mes actual, tanto de proyectos como de trabajos.
- Las tareas vencidas se identifican con el texto «Vencida», mientras que las tareas con vencimiento actual o futuro muestran «Vence».
- Al seleccionar una tarea del panel se abre el tablero Kanban correspondiente.
- Se agregaron accesos directos a Trabajos, Proyectos, Herramientas y Agenda, acompañados de sus respectivos contadores.
- Home utiliza los datos ya cargados en la aplicación y no requiere tablas ni migraciones SQL adicionales.

## Seguridad y datos

- La autenticación y gestión de usuarios se realiza mediante Supabase Auth.
- Los datos personales se almacenan en Supabase PostgreSQL.
- Las políticas Row Level Security (RLS) restringen el acceso a los registros de cada usuario.
- Los recordatorios se almacenan en `dashboard_reminders`.
- Las tareas Kanban se almacenan dentro de los registros JSONB de proyectos y trabajos.
- El Backup JSON permite descargar una copia de los datos del usuario.

## Despliegue

- Repositorio: GitHub.
- Hosting: Render.
- Base de datos y autenticación: Supabase.
- Las migraciones SQL necesarias deben ejecutarse en Supabase antes de desplegar las versiones que las incorporen.

## Próximas mejoras

- Optimización de estilos y recursos para producción.
- Evaluar notificaciones push para avisos incluso cuando la aplicación esté cerrada.
- Mejoras de estadísticas y seguimiento de actividad.
