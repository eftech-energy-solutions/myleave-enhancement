import express from 'express';
import pool from '../db.js';

const router = express.Router();

const OP_SUPPORT_LIKE = '%operation support%';

// The two Operation Support members that are GLOBALLY chat reachable —
// identified by POSITION (not department), per product decision. All other
// members of the Operation Support department are hidden from non-admin
// chat lists (only admins — and the handlers themselves — see them).
const HANDLER_POSITIONS = [
  'senior procurement & operations executive',
  'head of corporate services',
];

function isHandler(alias) {
  return `LOWER(COALESCE(${alias}.position, '')) IN (
    'senior procurement & operations executive',
    'head of corporate services'
  )`;
}

function isHandlerPosition(position) {
  return HANDLER_POSITIONS.includes(String(position || '').toLowerCase().trim());
}

// A profile row in the Operation Support department that is NOT one of the
// handlers and NOT an admin — fully hidden from every non-admin chat list.
function hiddenOpsMember(alias) {
  return `(
    ${alias}.department ILIKE '${OP_SUPPORT_LIKE}'
    AND LOWER(COALESCE(${alias}.role, '')) <> 'admin'
    AND NOT (${isHandler(alias)})
  )`;
}

// Builds a SQL predicate that tests whether a profile row (aliased as the
// given table alias) is reachable by a caller with the given role/department.
// Returns { sql, params } — the predicate may reference `$1` for the caller
// department when the role needs department overlap matching.
function reachablePredicate(role, department, position, alias = 'p') {
  const r = String(role || '').toLowerCase();
  const full = `(LOWER(${alias}.role) = 'admin' OR ${isHandler(alias)})`;

  if (r === 'director') {
    return { sql: '1 = 0', params: [] };
  }

  if (
    r === 'admin'
    || isHandlerPosition(position)
    || String(department || '').toLowerCase().includes('operation support')
  ) {
    return { sql: '1 = 1', params: [] };
  }

  const hiddenExclusion = `NOT (${hiddenOpsMember(alias)})`;

  if (r === 'manager') {
    return {
      sql: `${hiddenExclusion} AND (${full} OR EXISTS (
        SELECT 1 FROM unnest(string_to_array(${alias}.department, ',')) d
        WHERE trim(d) = ANY (string_to_array($1, ','))
      ))`,
      params: [department || '']
    };
  }

  return {
    sql: `${hiddenExclusion} AND (${full} OR (
      LOWER(${alias}.role) = 'manager' AND EXISTS (
        SELECT 1 FROM unnest(string_to_array(${alias}.department, ',')) d
        WHERE trim(d) = ANY (string_to_array($1, ','))
      )
    ))`,
    params: [department || '']
  };
}

function normalizePair(a, b) {
  return a < b ? [a, b] : [b, a];
}

// GET /api/chat/users?search=...
// Returns the list of users the caller is allowed to chat with, including
// conversation id, last message preview and unread count where available.
router.get('/users', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const me = req.user;
    const search = req.query.search?.trim() || '';

    const mine = reachablePredicate(me.role, me.department, me.position, 'u');
    const meIdx = mine.params.length + 1;
    const searchIdx = meIdx + 1;

    const result = await pool.query(
      `
      SELECT
        u.staff_id,
        u.full_name,
        u.department,
        u.position,
        u.role,
        u.photourl,
        c.id AS conversation_id,
        c.last_message_at,
        lm.text AS last_message,
        lm.sender_id AS last_sender_id,
        COALESCE(unread.cnt, 0)::int AS unread_count
      FROM profiles u
      LEFT JOIN LATERAL (
        SELECT id, last_message_at
        FROM conversations
        WHERE (participant_1 = $${meIdx} AND participant_2 = u.staff_id)
           OR (participant_1 = u.staff_id AND participant_2 = $${meIdx})
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT text, sender_id
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY id DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM messages
        WHERE conversation_id = c.id
          AND sender_id <> $${meIdx}
          AND read_at IS NULL
      ) unread ON true
      WHERE
        u.termination_date IS NULL
        AND u.staff_id <> $${meIdx}
        AND LOWER(u.role) <> 'director'
        AND (${mine.sql})
        AND (
          $${searchIdx} = ''
          OR u.full_name ILIKE '%' || $${searchIdx} || '%'
          OR u.staff_id ILIKE '%' || $${searchIdx} || '%'
          OR u.department ILIKE '%' || $${searchIdx} || '%'
        )
      ORDER BY c.last_message_at DESC NULLS LAST, u.full_name ASC
      LIMIT 300
      `,
      [...mine.params, me.staff_id, search]
    );

    return res.json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error('Get chat users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat users'
    });
  }
});

// POST /api/chat/messages  { recipientId, text }
router.post('/messages', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const me = req.user;
    const recipientId = String(req.body.recipientId || '').trim();
    const text = String(req.body.text || '').trim();

    if (!recipientId || !text) {
      return res.status(400).json({ success: false, message: 'recipientId and text are required' });
    }
    if (recipientId === me.staff_id) {
      return res.status(400).json({ success: false, message: 'Cannot message yourself' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters)' });
    }

    const recipient = (
      await client.query(
        `SELECT staff_id, role, department, position FROM profiles WHERE staff_id = $1 AND termination_date IS NULL LIMIT 1`,
        [recipientId]
      )
    ).rows[0];

    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

const mePred = reachablePredicate(me.role, me.department, me.position);
const themPred = reachablePredicate(recipient.role, recipient.department, recipient.position);

    const fromMe = await client.query(
      `SELECT 1 FROM profiles p
       WHERE p.staff_id = $${mePred.params.length + 1}
         AND (${mePred.sql})
       LIMIT 1`,
      [...mePred.params, recipient.staff_id]
    );

    const fromThem = await client.query(
      `SELECT 1 FROM profiles p
       WHERE p.staff_id = $${themPred.params.length + 1}
         AND (${themPred.sql})
       LIMIT 1`,
      [...themPred.params, me.staff_id]
    );

    if (!fromMe.rowCount || !fromThem.rowCount) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to chat with this person'
      });
    }

    const [p1, p2] = normalizePair(me.staff_id, recipientId);

    await client.query(
      `INSERT INTO conversations (participant_1, participant_2)
       VALUES ($1, $2)
       ON CONFLICT (participant_1, participant_2) DO NOTHING`,
      [p1, p2]
    );

    const conv = (
      await client.query(
        `SELECT id FROM conversations WHERE participant_1 = $1 AND participant_2 = $2`,
        [p1, p2]
      )
    ).rows[0];

    const msg = (
      await client.query(
        `INSERT INTO messages (conversation_id, sender_id, text)
         VALUES ($1, $2, $3)
         RETURNING id, sender_id, text, read_at, created_at`,
        [conv.id, me.staff_id, text]
      )
    ).rows[0];

    await client.query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conv.id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      conversation_id: conv.id,
      message: msg
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send chat message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  } finally {
    client.release();
  }
});

// GET /api/chat/messages/:conversationId?beforeId=&limit=
router.get('/messages/:conversationId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const me = req.user;
    const conversationId = Number(req.params.conversationId);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id' });
    }

    const conv = (
      await pool.query(
        `SELECT id FROM conversations
         WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)
         LIMIT 1`,
        [conversationId, me.staff_id]
      )
    ).rows[0];

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const result = await pool.query(
      `SELECT id, sender_id, text, read_at, created_at
       FROM messages
       WHERE conversation_id = $1
         AND ($2::int IS NULL OR id < $2)
       ORDER BY id DESC
       LIMIT $3`,
      [conversationId, beforeId, limit]
    );

    const messages = result.rows.reverse();
    const hasMore = messages.length === limit;

    return res.json({ success: true, conversation_id: conversationId, messages, hasMore });
  } catch (error) {
    console.error('Get chat messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
});

// PATCH /api/chat/messages/read  { conversationId }
router.patch('/messages/read', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const me = req.user;
    const conversationId = Number(req.body.conversationId);

    if (!Number.isInteger(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id' });
    }

    const conv = (
      await pool.query(
        `SELECT id FROM conversations
         WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)
         LIMIT 1`,
        [conversationId, me.staff_id]
      )
    ).rows[0];

    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const result = await pool.query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL
       RETURNING id`,
      [conversationId, me.staff_id]
    );

    return res.json({
      success: true,
      marked_read: result.rowCount
    });
  } catch (error) {
    console.error('Mark messages read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

// GET /api/chat/unread
router.get('/unread', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const me = req.user;

    const result = await pool.query(
      `SELECT c.id::int AS conversation_id, COUNT(*)::int AS unread_count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE (c.participant_1 = $1 OR c.participant_2 = $1)
         AND m.sender_id <> $1
         AND m.read_at IS NULL
       GROUP BY c.id`,
      [me.staff_id]
    );

    const total = result.rows.reduce((sum, row) => sum + row.unread_count, 0);

    return res.json({
      success: true,
      total,
      conversations: result.rows
    });
  } catch (error) {
    console.error('Get unread error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve unread counts'
    });
  }
});

export default router;