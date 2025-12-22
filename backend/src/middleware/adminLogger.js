import pool from '../db.js';

// Get location from IP (simple version - you can enhance this)
async function getLocationFromIP(ip) {
    try {
        // Clean up the IP address
        let cleanIP = ip;
        
        // Handle IPv6 localhost and private IPs
        if (!cleanIP || 
            cleanIP === '::1' || 
            cleanIP === '::ffff:127.0.0.1' ||
            cleanIP === '127.0.0.1' || 
            cleanIP.startsWith('192.168.') || 
            cleanIP.startsWith('10.') ||
            cleanIP.startsWith('172.16.') ||
            cleanIP.startsWith('::ffff:192.168.') ||
            cleanIP.startsWith('::ffff:10.')) {
            return 'Local Network';
        }
        
        // Remove IPv6 prefix if present
        if (cleanIP.startsWith('::ffff:')) {
            cleanIP = cleanIP.substring(7);
        }
        
        // Try to get location from IP
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`http://ip-api.com/json/${cleanIP}?fields=city,country`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            return 'Unknown Location';
        }
        
        const data = await response.json();
        
        if (data.city && data.country) {
            return `${data.city}, ${data.country}`;
        }
        
        return 'Unknown Location';
    } catch (error) {
        console.error('Geolocation error:', error.message);
        return 'Unknown Location';
    }
}

// Update the main logging function
export async function logAdminAction(req, action, details, status = 'success') {
    try {
        const authToken = req.cookies?.auth_token;
        if (!authToken) return;
        const user = JSON.parse(authToken);
        
        if (!['admin', 'manager'].includes(user.role?.toLowerCase())) {
            return;
        }

        const adminId = user.staffId || 'UNKNOWN';
        const adminName = user.name || 'Unknown Admin';
        
        // Get IP address with proper handling
        let ipAddress = req.ip || 
                       req.connection?.remoteAddress || 
                       req.socket?.remoteAddress ||
                       req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                       'Unknown';
        
        // Clean up IPv6 notation
        if (ipAddress.startsWith('::ffff:')) {
            ipAddress = ipAddress.substring(7);
        }
        
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
        const location = await getLocationFromIP(ipAddress);
        
        const query = `
            INSERT INTO admin_logs 
            (admin_id, admin_name, action, details, ip_address, location, device_info, status, user_agent, request_method, endpoint, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kuala_Lumpur')
            RETURNING *
        `;
        
        const values = [
            adminId,
            adminName,
            action,
            details || 'No details provided',
            ipAddress === '::1' || ipAddress === '127.0.0.1' ? 'localhost' : ipAddress,
            location,
            deviceInfo,
            status,
            req.headers['user-agent'] || 'Unknown',
            req.method,
            req.originalUrl || req.path
        ];
        
        await pool.query(query, values);
    } catch (error) {
        console.error('Error logging admin action:', error);
    }
}

// Middleware to automatically log certain actions
export function autoLogMiddleware(req, res, next) {
    const originalSend = res.send;
    
    res.send = function(data) {
        res.send = originalSend;
        res.send(data);
        
        // Log after response is sent - CHANGED FROM 'session' TO 'auth_token'
        const authToken = req.cookies?.auth_token;
        if (!authToken) return;
        
        try {
            const user = JSON.parse(authToken);
            
            // Only log admin/manager actions
            if (!['admin', 'manager'].includes(user.role?.toLowerCase())) {
                return;
            }
            
            let action = '';
            let details = '';
            
            if (req.path.includes('/login') && req.method === 'POST') {
                action = res.statusCode === 200 ? 'Login' : 'Failed Login';
                details = res.statusCode === 200 ? 'Successful login' : 'Invalid credentials';
                logAdminAction(req, action, details, res.statusCode === 200 ? 'success' : 'failed');
            } else if (req.path.includes('/logout')) {
                action = 'Logout';
                details = 'User logged out';
                logAdminAction(req, action, details);
            }
        } catch (err) {
            console.error('Auto-log error:', err);
        }
    };
    
    next();
}

export default { logAdminAction, autoLogMiddleware };