import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Middleware to check if user is admin/manager
function isAdminOrManager(req, res, next) {
    const authToken = req.cookies?.auth_token;
    
    console.log('Cookies:', req.cookies);
    console.log('Auth token:', authToken);
    
    if (!authToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = JSON.parse(authToken);
        console.log('Parsed user:', user);
        
        if (!['admin', 'manager'].includes(user.role?.toLowerCase())) {
            return res.status(403).json({ error: 'Access denied' });
        }
        req.user = user;
        next();
    } catch (err) {
        console.error('Auth token parse error:', err);
        return res.status(401).json({ error: 'Invalid session' });
    }
}

// GET all logs with filters
router.get('/api/admin-logs', isAdminOrManager, async (req, res) => {
    try {
        const { 
            search, 
            action, 
            adminId, 
            startDate, 
            endDate, 
            limit = 100, 
            offset = 0 
        } = req.query;
        
        let query = 'SELECT * FROM admin_logs WHERE 1=1';
        const values = [];
        let paramCount = 1;
        
        if (search) {
            query += ` AND (admin_name ILIKE $${paramCount} OR details ILIKE $${paramCount} OR ip_address ILIKE $${paramCount})`;
            values.push(`%${search}%`);
            paramCount++;
        }
        
        if (action && action !== 'all') {
            query += ` AND action = $${paramCount}`;
            values.push(action);
            paramCount++;
        }
        
        if (adminId && adminId !== 'all') {
            query += ` AND admin_id = $${paramCount}`;
            values.push(adminId);
            paramCount++;
        }
        
        if (startDate) {
            query += ` AND timestamp >= $${paramCount}`;
            values.push(startDate);
            paramCount++;
        }
        
        if (endDate) {
            query += ` AND timestamp <= $${paramCount}`;
            values.push(endDate + ' 23:59:59');
            paramCount++;
        }
        
        query += ` ORDER BY timestamp DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);
        
        const result = await pool.query(query, values);
        
        // Get statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_logs,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_actions,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_actions,
                COUNT(DISTINCT admin_id) as active_admins
            FROM admin_logs
        `;
        const stats = await pool.query(statsQuery);
        
        res.json({
            logs: result.rows,
            statistics: stats.rows[0],
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: result.rowCount
            }
        });
        
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// GET unique actions for filter dropdown
router.get('/api/admin-logs/actions', isAdminOrManager, async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT action FROM admin_logs ORDER BY action');
        res.json({ actions: result.rows.map(row => row.action) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch actions' });
    }
});

// GET unique admins for filter dropdown
router.get('/api/admin-logs/admins', isAdminOrManager, async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT admin_id, admin_name FROM admin_logs ORDER BY admin_name');
        res.json({ admins: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

// Export logs to CSV
router.get('/api/admin-logs/export', isAdminOrManager, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_logs ORDER BY timestamp DESC');
        
        // Log this export action
        try {
            const { logAdminAction } = await import('../middleware/adminLogger.js');
            await logAdminAction(req, 'Export Logs', `Exported ${result.rows.length} log entries to CSV`);
        } catch (err) {
            console.log('Admin logger not available');
        }
        
        res.json({ logs: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to export logs' });
    }
});

export default router;