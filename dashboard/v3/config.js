/* Configuración pública del cliente Supabase.
 * La anon/publishable key puede estar en el frontend SOLO si RLS está activado
 * y las políticas del esquema SQL están aplicadas. Nunca pongas aquí service_role.
 */
window.DASHBOARD_CONFIG = {
  SUPABASE_URL: "https://TU_PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE"
};
