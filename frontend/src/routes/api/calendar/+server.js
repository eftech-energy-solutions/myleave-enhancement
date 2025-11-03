// src/routes/api/calendar/+server.js
import { pool } from '$lib/server/db';

export async function GET({ locals, url }) {
  const me = locals.user; // assume { id, role, department }
  if (!me) return new Response('Unauthorized', { status: 401 });

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const where = [];
  const params = [];

  if (from) { params.push(from); where.push(`l.date_to >= $${params.length}`); }
  if (to)   { params.push(to);   where.push(`l.date_from <= $${params.length}`); }

  // role filtering
  if (me.role === 'staff') {
    params.push(me.id);
    where.push(`l.user_id = $${params.length}`);
  } else if (me.role === 'manager') {
    params.push(me.department);
    where.push(`u.department = $${params.length}`);
  }

  const sql = `
    select l.id, l.leave_type, l.status, l.date_from, l.date_to,
           u.name as employee_name, u.department
    from leaves l
    join users u on u.id = l.user_id
    ${where.length ? 'where ' + where.join(' and ') : ''}
    order by l.date_from asc
  `;

  const { rows } = await pool.query(sql, params);
  return new Response(JSON.stringify(rows), {
    headers: { 'content-type': 'application/json' }
  });
}
