// netlify/functions/validate-code.js
// Valida códigos de acceso mensuales para DUNNOS AI
// Los códigos se generan con formato: DUNNO-XXXX-MMYY
// donde XXXX = 4 chars únicos del alumno, MMYY = mes/año de expiración

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { code } = JSON.parse(event.body);

    if (!code) {
      return { statusCode: 400, headers, body: JSON.stringify({ valid: false, error: 'Código requerido' }) };
    }

    const result = validateCode(code.toUpperCase().trim());
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, error: 'Código inválido' }) };
  }
};

function validateCode(code) {
  // Formato esperado: DUNNO-XXXX-MMYY
  // Ejemplo: DUNNO-A3K7-0726 = válido julio 2026
  const pattern = /^DUNNO-([A-Z0-9]{4})-(\d{2})(\d{2})$/;
  const match = code.match(pattern);

  if (!match) {
    return { valid: false, error: 'Formato de código incorrecto' };
  }

  const studentId = match[1];
  const month     = parseInt(match[2], 10);
  const year      = parseInt('20' + match[3], 10);

  // Validar rango de mes
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Código con mes inválido' };
  }

  // Verificar si el código sigue vigente
  const now        = new Date();
  const nowMonth   = now.getMonth() + 1;  // 1-12
  const nowYear    = now.getFullYear();

  // El código es válido si coincide con el mes y año actual
  const isCurrentMonth = (month === nowMonth && year === nowYear);

  if (!isCurrentMonth) {
    // Calcular si expiró o aún no empieza
    const codeDate = new Date(year, month - 1, 1);
    const today    = new Date(nowYear, nowMonth - 1, 1);

    if (codeDate < today) {
      return {
        valid: false,
        expired: true,
        studentId,
        error: `Tu código expiró. Solicita el código de ${getMonthName(nowMonth)} ${nowYear}.`
      };
    } else {
      return {
        valid: false,
        error: `Este código es para ${getMonthName(month)} ${year}. Aún no está activo.`
      };
    }
  }

  return {
    valid: true,
    studentId,
    month,
    year,
    message: `¡Bienvenido! Acceso válido hasta el ${lastDayOfMonth(month, year)} de ${getMonthName(month)}.`
  };
}

function getMonthName(month) {
  const months = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return months[month];
}

function lastDayOfMonth(month, year) {
  return new Date(year, month, 0).getDate();
}
