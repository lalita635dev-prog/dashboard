const express = require('express');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = __dirname;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net", "'unsafe-inline'", "'unsafe-eval'"],
      // Compatibilidad temporal con los onclick heredados en v3; conviene migrarlos
      // a addEventListener y retirar esta excepción en una futura revisión de seguridad.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
// En Render, la configuración se inyecta desde variables de entorno. La clave anon
// es pública por diseño; la seguridad real la imponen Auth + RLS en Supabase.
app.get('/config.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
  };
  res.send(`window.DASHBOARD_CONFIG = ${JSON.stringify(config)};`);
});
app.use(express.static(publicDir, { extensions: ['html'], etag: true, maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '3.0.0' }));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.listen(PORT, () => console.log(`Dashboard v3.0 escuchando en puerto ${PORT}`));
