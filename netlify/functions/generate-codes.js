// netlify/functions/generate-codes.js
// Panel para generar códigos de acceso mensuales
// SOLO accesible con la clave admin (definida en variable de entorno)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const { adminKey, action, studentIds, month, year } = JSON.parse(event.body);

    // Verificar clave admin
    const ADMIN_KEY = process.env.ADMIN_KEY;
    if (!ADMIN_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    if (adminKey !== ADMIN_KEY) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Clave admin incorrecta' }) };
    }

    if (action === 'generate') {
      // Generar códigos para una lista de alumnos
      const targetMonth = month || (new Date().getMonth() + 1);
      const targetYear  = year  || new Date().getFullYear();

      const MM = String(targetMonth).padStart(2, '0');
      const YY = String(targetYear).slice(-2);

      // Si se proporcionan IDs específicos, usarlos; si no, generar nuevos
      const usedIds = new Set(studentIds || []);
      const ids = studentIds && studentIds.length > 0
        ? studentIds
        : Array.from({ length: 10 }, () => randomId(usedIds));

      const codes = ids.map(id => ({
        studentId: id,
        code: `DUNNO-${id}-${MM}${YY}`,
        validFor: `${getMonthName(targetMonth)} ${targetYear}`,
        expiresEnd: `${lastDay(targetMonth, targetYear)}/${MM}/${targetYear}`,
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          month: getMonthName(targetMonth),
          year: targetYear,
          total: codes.length,
          codes,
        })
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Acción no reconocida' }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno' }) };
  }
};

function randomId(usedInSession) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O,0,I,1
  const crypto = require('crypto');
  let id, attempts = 0;
  do {
    // crypto.randomBytes garantiza aleatoriedad criptográfica
    const bytes = crypto.randomBytes(4);
    id = Array.from(bytes, b => chars[b % chars.length]).join('');
    attempts++;
    if (attempts > 200) break;
  } while (usedInSession && usedInSession.has(id));
  if (usedInSession) usedInSession.add(id);
  return id;
}

function getMonthName(m) {
  return ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];
}

function lastDay(month, year) {
  return new Date(year, month, 0).getDate();
}
