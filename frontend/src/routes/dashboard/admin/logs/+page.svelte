<script>
  import { onMount } from 'svelte';
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';
  
  // State variables
  let logs = [];
  let statistics = {
    total_logs: 0,
    successful_actions: 0,
    failed_actions: 0,
    active_admins: 0
  };
  
  let searchTerm = '';
  let filterAction = 'all';
  let filterAdmin = 'all';
  let dateRange = { start: '', end: '' };
  let selectedLog = null;
  let uniqueActions = [];
  let uniqueAdmins = [];
  let loading = true;
  
  const API_URL = `${PUBLIC_VITE_API_BASE}`;
  
  // Fetch logs on mount
  onMount(async () => {
    await fetchLogs();
    await fetchFilters();
  });
  
  function formatLocation(log) {
  if (!log.location || log.location === 'undefined, undefined' || log.location === ', ') {
    return 'Local Network';
  }
  return log.location;
}
  // Fetch logs from API
async function fetchLogs() {
  try {
    const params = new URLSearchParams({
      search: searchTerm,
      action: filterAction,
      adminId: filterAdmin,
      startDate: dateRange.start,
      endDate: dateRange.end
    });
    
    const response = await fetch(`${API_URL}/api/admin-logs?${params}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error('Failed to fetch logs');
      return;
    }
    
    const data = await response.json();
    console.log('Fetched logs:', data.logs); // ✅ Add this line HERE
    logs = data.logs;
    statistics = data.statistics;
    loading = false;
  } catch (error) {
    console.error('Error fetching logs:', error);
    loading = false;
  }
}
  
  // Fetch filter options
  async function fetchFilters() {
    try {
      const [actionsRes, adminsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin-logs/actions`, { credentials: 'include' }),
        fetch(`${API_URL}/api/admin-logs/admins`, { credentials: 'include' })
      ]);
      
      const actionsData = await actionsRes.json();
      const adminsData = await adminsRes.json();
      
      uniqueActions = actionsData.actions;
      uniqueAdmins = adminsData.admins;
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  }
  
  // Export to CSV
  async function exportToCSV() {
    try {
      const response = await fetch(`${API_URL}/api/admin-logs/export`, {
        credentials: 'include'
      });
      const data = await response.json();
      
      const headers = ['Timestamp', 'Admin ID', 'Admin Name', 'Action', 'Details', 'IP Address', 'Location', 'Device', 'Status'];
      const csvData = data.logs.map(log => [
        log.timestamp,
        log.admin_id,
        log.admin_name,
        log.action,
        log.details,
        log.ip_address,
        log.location,
        log.device_info,
        log.status
      ]);
      
      const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  }
  
  // Helper functions
  function getActionColor(action) {
    if (action.includes('Login')) return 'act-login';
    if (action.includes('Approved')) return 'act-approved';
    if (action.includes('Rejected') || action.includes('Failed')) return 'act-danger';
    if (action.includes('Deleted')) return 'act-warning';
    if (action.includes('Added') || action.includes('Updated')) return 'act-info';
    return 'act-neutral';
  }
  
  function getStatusBadge(status) {
    return status === 'success' 
      ? 'status-pill status-success'
      : 'status-pill status-failed';
  }
  
  // Reactive statement to refetch when filters change
  $: {
    if (searchTerm !== undefined || filterAction || filterAdmin || dateRange.start || dateRange.end) {
      fetchLogs();
    }
  }
</script>

<div class="logs-container">
  <!-- Header -->
  <div class="header-card">
    <div class="header-content">
      <div class="header-left">
        <div class="icon-wrapper">
          <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </div>
        <div>
          <h1 class="title">Admin Activity Log</h1>
          <p class="subtitle">Monitor all administrative actions and access</p>
        </div>
      </div>
      <button on:click={exportToCSV} class="export-btn">
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Export CSV
      </button>
    </div>

    <!-- Statistics -->
    <div class="stats-grid">
      <div class="stat-card stat-neutral">
        <div class="stat-label">Total Logs</div>
        <div class="stat-value">{statistics.total_logs || 0}</div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-label">Successful Actions</div>
        <div class="stat-value">{statistics.successful_actions || 0}</div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-label">Failed Actions</div>
        <div class="stat-value">{statistics.failed_actions || 0}</div>
      </div>
      <div class="stat-card stat-teal">
        <div class="stat-label">Active Manager</div>
        <div class="stat-value">{statistics.active_admins || 0}</div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters-card">
    <div class="filters-grid">
      <div class="search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search logs..."
          bind:value={searchTerm}
          class="search-input"
        />
      </div>

      <select bind:value={filterAction} class="filter-select">
        <option value="all">All Actions</option>
        {#each uniqueActions as action}
          <option value={action}>{action}</option>
        {/each}
      </select>

      <select bind:value={filterAdmin} class="filter-select">
        <option value="all">All Responsible</option>
        {#each uniqueAdmins as admin}
          <option value={admin.admin_id}>{admin.admin_name}</option>
        {/each}
      </select>

      <div class="date-inputs">
        <input
          type="date"
          bind:value={dateRange.start}
          class="date-input"
        />
        <input
          type="date"
          bind:value={dateRange.end}
          class="date-input"
        />
      </div>
    </div>
  </div>

  <!-- Logs Table -->
  <div class="table-card">
    {#if loading}
      <div class="loading">Loading logs...</div>
    {:else if logs.length === 0}
      <div class="no-data">No logs found</div>
    {:else}
      <div class="table-wrapper">
        <table class="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Responsible</th>
              <th>Action</th>
              <th>Details</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
            <tbody>
            {#each logs as log (log.id)}
                <tr class="table-row">
                <!-- Timestamp -->
                <td>
                    <div class="cell-content">
                    <svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{new Date(log.timestamp).toLocaleString('en-MY', { 
                            timeZone: 'Asia/Kuala_Lumpur'
                          })}</span>
                    </div>
                </td>
                
                <!-- Admin -->
                <td>
                    <div class="cell-content">
                    <svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <div>
                        <div class="admin-name">{log.admin_name}</div>
                        <div class="admin-id">{log.admin_id}</div>
                    </div>
                    </div>
                </td>
                
                <!-- Action -->
                <td>
                    <span class={`action-badge ${getActionColor(log.action)}`}>
                    {log.action}
                    </span>
                </td>
                
                <!-- Details -->
                <td>
                    <div class="details-text">{log.details}</div>
                </td>
                
                <!-- Location -->
                <td>
                    <div class="cell-content">
                    <svg class="cell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <div>
                        <div>{formatLocation(log)}</div>
                        <div class="ip-text">{log.ip_address === '::1' ? 'localhost' : log.ip_address}</div>
                    </div>
                    </div>
                </td>
                
                <!-- Status -->
                <td>
                    <span class={getStatusBadge(log.status)}>
                    {log.status === 'success' ? 'Success' : 'Failed'}
                    </span>
                </td>
                
                <!-- Actions -->
                <td>
                    <button on:click={() => selectedLog = log} class="view-btn">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    </button>
                </td>
                </tr>
            {/each}
            </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Detail Modal -->
{#if selectedLog}
  <div class="modal-overlay" on:click={() => selectedLog = null}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2 class="modal-title">Log Details</h2>
        <button on:click={() => selectedLog = null} class="close-btn">✕</button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Timestamp</div>
            <div class="detail-value">{new Date(selectedLog.timestamp).toLocaleString('en-MY', { 
              timeZone: 'Asia/Kuala_Lumpur'
            })}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Status</div>
            <div>
              <span class={getStatusBadge(selectedLog.status)}>
                {selectedLog.status === 'success' ? 'Success' : 'Failed'}
              </span>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Responsible</div>
            <div class="detail-value">{selectedLog.admin_name}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Staff ID</div>
            <div class="detail-value">{selectedLog.admin_id}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Action</div>
            <div>
              <span class={`action-badge ${getActionColor(selectedLog.action)}`}>
                {selectedLog.action}
              </span>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">IP Address</div>
            <div class="detail-value">{selectedLog.ip_address}</div>
          </div>
          <div class="detail-item full-width">
            <div class="detail-label">Location</div>
            <div class="detail-value">{selectedLog.location}</div>
          </div>
          <div class="detail-item full-width">
            <div class="detail-label">Device Information</div>
            <div class="detail-value">{selectedLog.device_info}</div>
          </div>
          <div class="detail-item full-width">
            <div class="detail-label">Details</div>
            <div class="detail-value">{selectedLog.details}</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button on:click={() => selectedLog = null} class="modal-close-btn">
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
.logs-container {
  padding: 0;
  max-width: 96%;
  margin: 0 auto;
}

/* Header Card */
.header-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 10px rgba(15,23,42,.06);
  padding: 24px;
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-wrapper {
  width: 48px;
  height: 48px;
  background: #0F9B8E;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.icon {
  width: 28px;
  height: 28px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0 0;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #0F9B8E;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover {
  background: #0C8075;
}

.btn-icon {
  width: 18px;
  height: 18px;
}

/* Statistics */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 16px;
  border-radius: 12px;
}

.stat-neutral { background: #f1f5f9; }
.stat-green { background: #f0fdf4; }
.stat-red { background: #fef2f2; }
.stat-teal { background: #f0fdfa; }

.stat-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.stat-neutral .stat-label { color: #475569; }
.stat-green .stat-label { color: #166534; }
.stat-red .stat-label { color: #991b1b; }
.stat-teal .stat-label { color: #0f766e; }

.stat-value {
  font-size: var(--fs-stat, 28px);
  font-weight: 700;
}

.stat-neutral .stat-value { color: var(--ink, #1F2937); }
.stat-green .stat-value { color: var(--success, #16A34A); }
.stat-red .stat-value { color: var(--danger, #DC2626); }
.stat-teal .stat-value { color: var(--brand, #0F9B8E); }

/* Filters */
.filters-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 10px rgba(15,23,42,.06);
  padding: 24px;
  margin-bottom: 24px;
}

.filters-grid {
  display: grid;
  grid-template-columns: 2fr 1.5fr 2fr 2fr;
  gap: 16px;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 10px 10px 10px 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #0F9B8E;
  box-shadow: 0 0 0 3px rgba(15,155,142,0.1);
}

.filter-select, .date-input {
  padding: .5rem 2rem .5rem .8rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1F2937;
  background: #fff;
}

.filter-select:focus, .date-input:focus {
  outline: none;
  border-color: #0F9B8E;
  box-shadow: 0 0 0 3px rgba(15,155,142,.15);
}
.filter-select {
  width: 100%;
  max-width: 360px;   /* kawal panjang */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  appearance: none;
  -webkit-appearance: none;
  background: #fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
}


.date-inputs {
  display: flex;
  gap: 8px;
}

/* Table */
.table-card {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 10px rgba(15,23,42,.06);
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table thead {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.logs-table th {
  padding: 14px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  vertical-align: middle;
}

.logs-table th:nth-child(1) { width: 180px; }
.logs-table th:nth-child(2) { width: 160px; }
.logs-table th:nth-child(3) { width: 180px; }
.logs-table th:nth-child(4) { width: auto; min-width: 300px; }
.logs-table th:nth-child(5) { width: 180px; }
.logs-table th:nth-child(6) { width: 100px; }
.logs-table th:nth-child(7) { width: 80px; text-align: center; }

.table-row {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.2s;
}

.table-row:hover {
  background: #f9fafb;
}

.logs-table td {
  padding: 20px 16px;
  font-size: 14px;
  color: #111827;
  vertical-align: middle;
  height: 72px;
}

.cell-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cell-icon {
  width: 16px;
  height: 16px;
  color: #9ca3af;
  flex-shrink: 0;
}

.admin-name {
  font-weight: 600;
  color: #111827;
  line-height: 1.5;
}

.admin-id {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin-top: 2px;
}

.action-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  height: 28px;
}

/* Action tag pills: light tint bg + dark text of the same hue */
.action-badge.act-login    { background: #eff6ff; color: #1d4ed8; }
.action-badge.act-approved { background: #f0fdf4; color: #166534; }
.action-badge.act-danger   { background: #fef2f2; color: var(--danger, #DC2626); }
.action-badge.act-warning  { background: #fffbeb; color: #b45309; }
.action-badge.act-info     { background: #f0fdfa; color: #0f766e; }
.action-badge.act-neutral  { background: #f1f5f9; color: #475569; }

/* Status pills */
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.status-pill.status-success { background: #f0fdf4; color: var(--success, #16A34A); }
.status-pill.status-failed  { background: #fef2f2; color: var(--danger, #DC2626); }

.details-text {
  line-height: 1.6;
  color: #374151;
}

.ip-text {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin-top: 2px;
}

.logs-table td:nth-child(6) {
  text-align: left;
}

.logs-table td:nth-child(7) {
  text-align: center;
}

.view-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: #0F9B8E;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.view-btn:hover {
  background: #f0fdfa;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}

.modal {
  background: #fff;
  border-radius: 12px;
  max-width: 700px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.close-btn:hover {
  background: #f3f4f6;
}

.modal-body {
  padding: 24px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item.full-width {
  grid-column: span 2;
}

.detail-label {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}

.detail-value {
  font-size: 14px;
  color: #111827;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.modal-close-btn {
  padding: 10px 20px;
  background: #6b7280;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.modal-close-btn:hover {
  background: #4b5563;
}

.loading, .no-data {
  padding: 48px;
  text-align: center;
  color: #6b7280;
  font-size: 16px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-item.full-width {
    grid-column: span 1;
  }
}

@media (max-width: 560px) {
  .logs-container {
    max-width: 100%;
  }

  .header-card {
    padding: 16px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .header-left {
    gap: 12px;
  }
  
  .export-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>