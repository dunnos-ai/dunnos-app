// Guarda y carga el avance de cada alumno en Supabase (vía REST, sin SDK).
// La llave secreta vive SOLO en variables de entorno de Netlify:
//   SUPABASE_URL          -> https://xxxxx.supabase.co
//   SUPABASE_SERVICE_KEY  -> service_role key (secreta, nunca en el navegador)
//
// Si no está configurado, responde {error} y la app sigue usando localStorage.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;

  // ── MODO DIAGNÓSTICO ──────────────────────────────────────────────
  // Abre en el navegador: https://dunnos.app/.netlify/functions/progress
  // Reporta el estado SIN exponer secretos (solo si existen y funcionan).
  if (event.httpMethod === 'GET') {
    const diag = {
      hasUrl: !!URL,
      hasKey: !!KEY,
      urlIncludesRestV1: !!(URL && URL.includes('/rest/v1')),
      urlEndsWithSlash: !!(URL && URL.endsWith('/')),
      ping: null,
      pingDetail: ''
    };
    if (URL && KEY) {
      try {
        const base = URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
        // limit=0 no devuelve filas: comprueba conexión SIN exponer datos de alumnos
        const r = await fetch(`${base}/rest/v1/student_progress?select=student_id&limit=0`, {
          headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
        });
        diag.ping = r.status;
        diag.pingDetail = r.ok ? 'ok' : (await r.text()).slice(0, 200);
      } catch (e) { diag.ping = 'fetch_error'; diag.pingDetail = e.message; }
    }
    return { statusCode: 200, headers, body: JSON.stringify(diag, null, 2) };
  }

  if (!URL || !KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Supabase no configurado' }) };
  }

  // Tolera que la URL venga con o sin barra final o con /rest/v1 al final
  const BASE = URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  const sb = (path, opts = {}) => fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, studentId } = body;

    if (!studentId || !/^[A-Za-z0-9]{2,8}$/.test(studentId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'studentId inválido' }) };
    }
    const sid = studentId.toUpperCase();

    // ── Cargar avance ──────────────────────────────────
    if (action === 'load') {
      const res = await sb(`student_progress?student_id=eq.${encodeURIComponent(sid)}&select=done,game,verbs`);
      const rows = await res.json();
      if (!res.ok) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: rows.message || ('HTTP ' + res.status) }) };
      }
      const row = (Array.isArray(rows) && rows[0]) ? rows[0] : { done: {}, game: {}, verbs: {} };
      return { statusCode: 200, headers, body: JSON.stringify(row) };
    }

    // ── Guardar avance (upsert por student_id) ─────────
    if (action === 'save') {
      const { officeId = '', done = {}, game = {}, verbs = {} } = body;
      const payload = [{
        student_id: sid,
        office_id: officeId,
        done, game, verbs,
        updated_at: new Date().toISOString()
      }];
      const res = await sb('student_progress', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        return { statusCode: 200, headers, body: JSON.stringify({ error: e.message || ('HTTP ' + res.status) }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action inválida' }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: e.message }) };
  }
};
