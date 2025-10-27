// src/routes/api/leaves/+server.js
import { pool } from '$lib/server/db';

export async function POST({ request, locals }) {
  const me = locals.user;
  if (!me) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const {
    user_id = me.id,
    leave_type,
    status = 'Pending',
    date_from,
    date_to,
    total_days = 1,
    notes = ''
  } = body;

  const sql = `
    insert into leaves (user_id, approver_id, leave_type, status, date_from, date_to, total_days, notes)
    values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning id
  `;
  const { rows } = await pool.query(sql, [
    user_id, me.id, leave_type, status, date_from, date_to, total_days, notes
  ]);

  return new Response(JSON.stringify({ id: rows[0].id }), {
    headers: { 'content-type': 'application/json' }
  });
}
