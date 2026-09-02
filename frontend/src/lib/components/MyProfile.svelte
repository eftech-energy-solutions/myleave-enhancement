<script>
  import { onMount } from "svelte";
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

  let loading = true;
  let error = "";
  let user = null;

  const fmt = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return isNaN(d) ? "-" : d.toLocaleDateString();
  };
  const fmtNum = (v) =>
    v === null || v === undefined || v === "" ? "0" : v;

  onMount(async () => {
    try {
      const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me`, {
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error || "Failed to load profile";
        return;
      }
      user = data;
    } catch (err) {
      error = "Failed to load profile";
      console.error("MyProfile load error:", err);
    } finally {
      loading = false;
    }
  });

  function avatarUrl() {
    if (!user?.photourl) return "";
    return user.photourl.startsWith("http")
      ? user.photourl
      : `${PUBLIC_VITE_API_BASE}${user.photourl}`;
  }
</script>

<div class="profile-page">
  {#if loading}
    <div class="state-card">Loading profile…</div>
  {:else if error}
    <div class="state-card error">{error}</div>
  {:else if user}
    <div class="card header-card">
      <div class="avatar-wrap">
        {#if avatarUrl()}
          <img
            src={avatarUrl()}
            alt="profile"
            on:error={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div class="avatar-fallback">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="#9ca3af"/>
              <path d="M4 20c0-4.2 4.2-6.5 8-6.5s8 2.3 8 6.5" fill="#9ca3af"/>
            </svg>
          </div>
        {:else}
          <div class="avatar-fallback">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="#9ca3af"/>
              <path d="M4 20c0-4.2 4.2-6.5 8-6.5s8 2.3 8 6.5" fill="#9ca3af"/>
            </svg>
          </div>
        {/if}
      </div>
      <div class="id-block">
        <h2>{user.full_name}</h2>
        <p class="sub">{user.position}</p>
        <span class="pill role-pill">{user.role}</span>
      </div>
    </div>

    <div class="grid-2col">
      <!-- Personal Details -->
      <div class="card">
        <div class="card-title">Personal Details</div>
        <div class="detail-row"><span>Staff ID</span><strong>{user.staff_id}</strong></div>
        <div class="detail-row"><span>Full Name</span><strong>{user.full_name}</strong></div>
        <div class="detail-row"><span>Email</span><strong>{user.email}</strong></div>
        <div class="detail-row"><span>Position</span><strong>{user.position || "-"}</strong></div>
        <div class="detail-row"><span>Role</span><strong>{user.role}</strong></div>
        <div class="detail-row"><span>Department</span><strong>{user.department || "-"}</strong></div>
      </div>

      <!-- Available Leave -->
      <div class="card leave-card">
        <div class="card-title">Available Leave</div>

        <div class="leave-stat">
          <div class="leave-label">
            <span>Annual Leave</span>
            <strong>{fmtNum(user.remaining_leave ?? user.leave_entitlement_annual)} days</strong>
          </div>
          <div class="leave-meta">
            Balance <b>{fmtNum(user.leave_entitlement_annual)}</b> / Entitlement <b>{fmtNum(user.leave_entitlement_annual_original)}</b>
          </div>
        </div>

        <div class="leave-stat">
          <div class="leave-label">
            <span>Medical Leave</span>
            <strong>{fmtNum(user.leave_entitlement_medical)} days</strong>
          </div>
          <div class="leave-meta">
            Balance <b>{fmtNum(user.leave_entitlement_medical)}</b> / Entitlement <b>{fmtNum(user.leave_entitlement_medical_original)}</b>
          </div>
        </div>

        <div class="leave-stat">
          <div class="leave-label">
            <span>Hospitalization</span>
            <strong>{fmtNum(user.hosp_balance)} days</strong>
          </div>
          <div class="leave-meta">
            Balance <b>{fmtNum(user.hosp_balance)}</b> / Entitlement <b>{fmtNum(user.hosp_entitlement)}</b>
          </div>
        </div>

        {#if user.carry_forward_balance}
          <div class="leave-stat">
            <div class="leave-label">
              <span>Carry Forward</span>
              <strong>{fmtNum(user.carry_forward_balance)} days</strong>
            </div>
            <div class="leave-meta">
              Expires <b>{user.carry_forward_expiry ? fmt(user.carry_forward_expiry) : "-"}</b>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }

  .state-card {
    background: #fff;
    border: 1px dashed #cbd5e1;
    border-radius: 14px;
    padding: 40px 20px;
    text-align: center;
    color: #64748b;
    font-size: 15px;
  }
  .state-card.error { color: #b91c1c; border-color: #fca5a5; }

  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 22px;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
  }
  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: #0c4a6e;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eef2f7;
  }

  .header-card {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
    background:
      linear-gradient(135deg, var(--brand, #0F9B8E), var(--brand-dark, #0C8075));
    color: #fff;
    border: none;
  }
  .avatar-wrap {
    position: relative;
    width: 84px;
    height: 84px;
    border-radius: 9999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.25);
    border: 3px solid rgba(255, 255, 255, 0.6);
    flex: none;
  }
  .avatar-wrap img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 9999px;
  }
  .avatar-wrap img + .avatar-fallback { display: none; }
  .avatar-fallback {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
  .avatar-fallback svg { width: 55%; height: 55%; }

  .id-block h2 { margin: 0; font-size: 24px; font-weight: 700; }
  .id-block .sub { margin: 4px 0 8px; opacity: 0.9; font-size: 14px; }
  .role-pill {
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
    border-radius: 9999px;
    padding: 4px 14px;
    font-size: 12px;
    font-weight: 600;
  }

  .grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 0;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-row span { color: #64748b; }
  .detail-row strong { color: #1f2937; text-align: right; word-break: break-word; }

  .leave-stat {
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .leave-stat:last-of-type { border-bottom: none; }
  .leave-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    color: #0c4a6e;
    margin-bottom: 4px;
  }
  .leave-label strong { color: #16a34a; font-size: 16px; }
  .leave-meta {
    font-size: 12.5px;
    color: #64748b;
  }
  .leave-meta b { color: #334155; }

  @media (max-width: 720px) {
    .profile-page { padding: 16px; }
    .grid-2col { grid-template-columns: 1fr; }
    .id-block h2 { font-size: 20px; }
  }
</style>
