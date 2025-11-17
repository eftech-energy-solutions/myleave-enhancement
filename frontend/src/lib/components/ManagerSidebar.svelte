<script>
  // ======================================================
  // OPTION 2: Prevent pendingCount undefined errors
  // (Placeholder values until real API is implemented)
  // ======================================================
  let pending = [];
  let pendingLeave = [];
  let pendingCancel = [];
  let pendingCount = 0;

  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  let selectedFile = null;

  // Fallback user info (before fetching from server)
  let safeUser = {
    name: '',
    role: '',
    staffId: '',
    email: '',
    department: '',          // ensure backend returns this in /api/me/photo
    photoUrl: null
  };

  // --- STATE ---
  let profileMenuOpen = false;
  let profilePhotoUrl = '';
  let showPwd1 = false;
  let showPwdCurrent = false; // <— add this


  // --- STATE FOR PASSWORD (error/msg) ---
  let error = '';
  let msg = '';

  $: headerAvatarUrl = safeUser.photoUrl
    ? `http://localhost:5000${safeUser.photoUrl}`
    : '/images/icontest1.png';

  // --- Fetch current user on mount ---
  onMount(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/me/photo', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // merge backend data (photoUrl, staffId, email, etc.) into safeUser
        safeUser = { ...safeUser, ...data };
        profilePhotoUrl = safeUser.photoUrl
          ? `http://localhost:5000${safeUser.photoUrl}`
          : '';
        console.log('safeUser updated on mount:', safeUser);
      } else {
        console.error('Failed to fetch user photo/data:', res.status);
      }
    } catch (err) {
      console.error('Error fetching user (possible JSON error):', err);
    }

    // NOTE: intentionally not calling /api/employee/me (avoid duplicate source of truth)
  });

  // Profile modal
  let profileModalOpen = false;
  let activeProfilePane = 'picture'; // 'picture' | 'password'

  // clickOutside action
  function clickOutside(node) {
    const onClick = (e) => {
      if (!node.contains(e.target)) {
        profileMenuOpen = false;
      }
    };
    document.addEventListener('click', onClick);
    return { destroy: () => document.removeEventListener('click', onClick) };
  }

  function openProfileModal() {
    activeProfilePane = 'picture';
    profileModalOpen = true;
    profileMenuOpen = false;
    // Reset error/msg when opening
    error = '';
    msg = '';
  }

  function closeProfileModal() {
    profileModalOpen = false;
  }

  // ---------- Helpers to safely parse responses ----------
  function isJsonResponse(res) {
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json');
  }

  async function parseSmart(res) {
    if (isJsonResponse(res)) return await res.json();
    const text = await res.text();
    return { _nonJson: true, text };
  }
  // ------------------------------------------------------

  // Save profile update
  async function saveProfile(e) {
    e.preventDefault();
    // Clear previous messages on new save attempt
    error = '';
    msg = '';

    // --- PICTURE BRANCH ---
    if (activeProfilePane === 'picture') {
      if (!selectedFile) return alert('Please select a photo');
      try {
        const formData = new FormData();
        formData.append('photo', selectedFile);

        const res = await fetch('http://localhost:5000/api/upload/profile', {
          method: 'POST',
          body: formData,
          credentials: 'include' // important for cookie auth
        });

        const data = await parseSmart(res);
        if (!res.ok || (isJsonResponse(res) && !data?.success)) {
          const msgText = isJsonResponse(res)
            ? (data?.error || `Upload failed (status ${res.status})`)
            : `Upload failed (status ${res.status}). ${String(data.text).slice(0,180)}…`;
          throw new Error(msgText);
        }

        // ✅ Update sidebar and modal preview
        safeUser.photoUrl = data.photoUrl;
        profilePhotoUrl = `http://localhost:5000${data.photoUrl}`;
        selectedFile = null;
        alert('Profile photo updated!');
        closeProfileModal(); // Close modal on picture success
        return;
      } catch (err) {
        console.error(err);
        alert(err.message || 'Upload failed. Server may be down or endpoint is wrong.');
        return;
      }
    }

    // --- PASSWORD BRANCH ---
    if (activeProfilePane === 'password') {
      const pwd1 = e.currentTarget.querySelector('input[name="pwd1"]').value || '';
      const pwd2 = e.currentTarget.querySelector('input[name="pwd2"]').value || '';
      const pwdCurrent = e.currentTarget.querySelector('input[name="pwdCurrent"]').value || '';

      if (!pwdCurrent || !pwd1 || !pwd2) {
        error = 'All password fields are required.';
        return;
      }
      if (pwd1 !== pwd2) {
        error = 'New passwords do not match.';
        return;
      }
      if (pwd1.length < 8) {
        error = 'New password must be at least 8 characters.';
        return;
      }

      // Prefer email flow (as per inspired code). Fall back to staffId route if needed.
      const email = (safeUser?.email || '').trim().toLowerCase();

      try {
        let res, data;

        if (email) {
          // PRIMARY: /api/auth/change-password (JSON)
          res = await fetch('http://localhost:5000/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              email,
              currentPassword: pwdCurrent,
              newPassword: pwd1
            })
          });

          data = await parseSmart(res);

          if (!res.ok || (isJsonResponse(res) && !data?.success)) {
            // If this endpoint not found or non-JSON, try staffId route as fallback
            if (res.status === 404 || data?._nonJson) throw { _tryFallback: true, res, data };
            const msgText = isJsonResponse(res)
              ? (data?.error || `Failed to change password (status ${res.status})`)
              : `Failed to change password (status ${res.status}). ${String(data.text).slice(0,180)}…`;
            throw new Error(msgText);
          }
        } else {
          // No email in session -> fallback directly
          throw { _tryFallback: true };
        }

        // Success path for email route
        msg = data?.message || 'Password updated successfully!';
        e.currentTarget.querySelector('input[name="pwd1"]').value = '';
        e.currentTarget.querySelector('input[name="pwd2"]').value = '';
        e.currentTarget.querySelector('input[name="pwdCurrent"]').value = '';
        return;

      } catch (firstErr) {
        // Fallback to staffId route if available
        try {
          if (!safeUser.staffId) {
            throw new Error(firstErr?.message || 'Missing Staff ID and email; cannot change password.');
          }

          const res2 = await fetch(
            `http://localhost:5000/api/employee/${encodeURIComponent(safeUser.staffId)}/password`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                currentPassword: pwdCurrent,
                newPassword: pwd1
              })
            }
          );

          const data2 = await parseSmart(res2);
          if (!res2.ok || (isJsonResponse(res2) && !data2?.success)) {
            const msgText = isJsonResponse(res2)
              ? (data2?.error || `Password update failed (status ${res2.status})`)
              : `Password update failed (status ${res2.status}). ${String(data2.text).slice(0,180)}…`;
            throw new Error(msgText);
          }

          msg = data2?.message || 'Password updated successfully!';
          e.currentTarget.querySelector('input[name="pwd1"]').value = '';
          e.currentTarget.querySelector('input[name="pwd2"]').value = '';
          e.currentTarget.querySelector('input[name="pwdCurrent"]').value = '';
        } catch (fallbackErr) {
          console.error('Password update error:', fallbackErr);
          error = fallbackErr?.message || firstErr?.message || 'An error occurred.';
        }
      }
    }
  } // <-- closes saveProfile

  function handlePhotoFile(e) {
    const file = e.currentTarget.files?.[0];
    console.log('📁 File selected:', file);
    if (!file) return;
    if (!/^image\/(png|jpeg)$/i.test(file.type)) {
      alert('Please choose a PNG or JPG image.');
      e.currentTarget.value = '';
      return;
    }
    selectedFile = file;
    profilePhotoUrl = URL.createObjectURL(file);
    // Clear password error/msg if user switches to picture
    error = '';
    msg = '';
  }
</script>

<div class="container">
  <aside class="aside">
    <div class="top">
      <div class="logo">
        <img src="/images/myleave.logo.png" alt="MyLeave" />
      </div>

      <nav class="nav">
        <div class="nav-group">
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm11-11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 11h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"
              ></path>
            </svg>
          </span>
          <span class="text">Dashboard</span>
        </div>
        <div class="sub-links">
          <a
            href="/dashboard/manager/main"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/main')}
          >
            <span class="text">Main</span>
          </a>
          <a
            href="/dashboard/manager/reports"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/reports')}
          >
            <span class="text">Reports</span>
          </a>
        </div>

        <div class="nav-group">
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zM5 8V6h14v2H5z"
              ></path>
            </svg>
          </span>
          <span class="text">Leave History</span>
        </div>
        <div class="sub-links">
          <a
            href="/dashboard/manager/history"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/history')}
          >
            <span class="text">Staff</span>
          </a>
          <a
            href="/dashboard/manager/myhistory"
            class:active={$page.url.pathname.startsWith('/dashboard/manager/myhistory')}
          >
            <span class="text">Personal</span>
          </a>
        </div>

        <a
          href="/dashboard/manager/employees"
          class:active={$page.url.pathname.startsWith('/dashboard/manager/employees')}
        >
          <span class="ico">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
              ></path>
            </svg>
          </span>
          <span class="text">Employees</span>
        </a>
      </nav>
    </div>

    <div class="bottom">
      <a href="/logout" class="signout">
        <span class="ico">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="m17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
            ></path>
          </svg>
        </span>
        <span class="text">Sign out</span>
      </a>
    </div>
  </aside>

  <main class="main dash-main">
    <header class="topbar">
      <div class="title-wrap">
        <div class="hello">Welcome back, {safeUser?.name || 'admin'}!</div>

        {#if $page.url.pathname.startsWith('/dashboard/manager/main')}
          <h1 class="page-title">Dashboard</h1>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/reports')}
          <h1 class="page-title">My Dashboard</h1>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/myhistory')}
          <h1 class="page-title">My Leave History</h1>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/history')}
          <h1 class="page-title">Leave History</h1>
        {:else if $page.url.pathname.startsWith('/dashboard/history')}
          <h1 class="page-title">Leave Timeline</h1>
        {:else if $page.url.pathname.startsWith('/dashboard/manager/employees')}
          <h1 class="page-title">Employees</h1>
        {:else}
          <h1 class="page-title">My Dashboard</h1>
        {/if}
      </div>

      <div class="profile" use:clickOutside>
        <div class="profile-info">
          {#if safeUser?.photoUrl}
            <img
              src={`http://localhost:5000${safeUser.photoUrl}`}
              alt="profile"
              class="avatar-img"
              on:error={(e) => (e.currentTarget.style.display = 'none')}
            />
          {/if}
          <div class="who">
            <div class="name">{safeUser?.name}</div>
            <div class="sub">{safeUser?.role}</div>
            <div class="sub">Staff ID : {safeUser?.staffId}</div>
          </div>
        </div>

        <button
          class="icon-btn caret"
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          on:click={() => (profileMenuOpen = !profileMenuOpen)}
          aria-label="Open profile menu"
        >
          ▾
        </button>

        {#if profileMenuOpen}
          <div class="menu" role="menu">
            <button class="menu-btn" type="button" on:click={openProfileModal}>
              Update Profile
            </button>
          </div>
        {/if}
      </div>
    </header>

    <div class="container-inner">
      <slot />
    </div>
  </main>
</div>

{#if profileModalOpen}
  <div
    class="modal-wrap"
    role="dialog"
    aria-modal="true"
    aria-labelledby="profile-title"
  >
    <div class="modal">
      <div class="modal-hd">
        <div id="profile-title" class="modal-ttl">Update Profile</div>
        <button class="modal-x" on:click={closeProfileModal} aria-label="Close">✕</button>
      </div>

      <div class="tabs" role="tablist" aria-label="Update Profile Tabs">
        <button
          class:selected={activeProfilePane === 'picture'}
          role="tab"
          aria-selected={activeProfilePane === 'picture'}
          on:click={() => {
            activeProfilePane = 'picture';
            error = '';
            msg = '';
          }}>Profile Picture</button>

        <button
          class:selected={activeProfilePane === 'password'}
          role="tab"
          aria-selected={activeProfilePane === 'password'}
          on:click={() => {
            activeProfilePane = 'password';
            error = '';
            msg = '';
          }}>Password</button>
      </div>

      <form class="modal-bd" on:submit={saveProfile}>
        {#if activeProfilePane === 'picture'}
          <div class="pic-wrap">
            {#if profilePhotoUrl}
              <img src={profilePhotoUrl} alt="Preview" class="preview" />
            {:else}
              <div class="placeholder">No photo chosen</div>
            {/if}
            <input
              type="file"
              accept="image/png,image/jpeg"
              on:change={handlePhotoFile}
            />
            <div class="muted">
              PNG/JPG up to ~5 MB. Square images (1:1) look best.
            </div>
          </div>
        {:else}
          <div class="row">
  <label>Current Password</label>
  <div class="input-wrap-lg">
    <input
      class="input-lg"
      type={showPwdCurrent ? 'text' : 'password'}
      name="pwdCurrent"
      placeholder="Enter your current password"
      required
    />
    <button
      class="eye-btn"
      type="button"
      on:click={() => (showPwdCurrent = !showPwdCurrent)}
      aria-label={showPwdCurrent ? 'Hide current password' : 'Show current password'}
      title={showPwdCurrent ? 'Hide' : 'Show'}
    >
      {#if showPwdCurrent}
        <!-- eye-off icon -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"></path>
          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      {:else}
        <!-- eye icon -->
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      {/if}
    </button>
  </div>
          </div>
          <div class="row">
            <label>New Password</label>
            <div class="input-wrap-lg">
              <input
                class="input-lg"
                type={showPwd1 ? 'text' : 'password'}
                name="pwd1"
                placeholder="At least 8 characters"
                required
              />
              <button
                class="eye-btn"
                type="button"
                on:click={() => (showPwd1 = !showPwd1)}
                aria-label={showPwd1 ? 'Hide password' : 'Show password'}
                title={showPwd1 ? 'Hide' : 'Show'}
              >
                {#if showPwd1}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.04-2.84 3.05-5.2 5.66-6.6"/>
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a10.95 10.95 0 0 1-4.06 5.06"/>
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                       fill="none" stroke="currentColor" width="20" height="20" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                {/if}
              </button>
            </div>
          </div>
          <div class="row">
            <label>Confirm Password</label>
            <input
              class="input-lg"
              type="password"
              name="pwd2"
              placeholder="Re-enter new password"
              required
            />
          </div>
          {#if error}
            <div class="form-error">{error}</div>
          {/if}
          {#if msg}
            <div class="form-msg">{msg}</div>
          {/if}
        {/if}

        <div class="form-ft">
          <button type="button" class="btn-ghost" on:click={closeProfileModal}>Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* CSS (KEKAL SAMA SEPERTI KOD SEBELUM INI) */
  .container {
    display: grid;
    grid-template-columns: 220px 1fr;
    min-height: 100vh;
  }
  .aside {
    background: #fff;
    border-right: 1px solid #e5e7eb;
    padding: 15px;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .top {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .bottom {
    margin-top: auto;
  }
  .main {
    background: linear-gradient(180deg, #49bdb3 0%, #0c4a6e 100%);
  }
  .container-inner {
    padding: 16px;
  }

  /* Sidebar Navigation */
  .nav {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .nav a,
  .nav-group {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    color: #217859;
    font-weight: 600;
    text-decoration: none;
    transition: background-color 0.2s;
  }
  .nav a:hover {
    background: #f3f4f6;
  }
  .nav a.active {
    background: #eaf6f7;
    color: #1fb3b2;
  }

  /* Sub-links specific styling */
  .sub-links {
    margin-left: 28px;
    display: flex;
    flex-direction: column;
    font-weight: 500;
  }
  .sub-links a .text::before {
    content: '•';
    margin-right: 8px;
    color: #9ca3af;
  }
  .sub-links a.active .text::before {
    color: #1fb3b2;
  }

  /* Icons */
  .ico {
    width: 24px;
    height: 24px;
    display: inline-grid;
    place-items: center;
  }
  .ico svg {
    width: 22px;
    height: 22px;
    fill: #217859;
  }
  .nav a.active .ico svg,
  .nav-group.active .ico svg {
    fill: #1fb3b2;
  }

  /* Sign Out Button */
  .signout {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    color: #e34040;
    font-weight: 600;
    text-decoration: none;
  }
  .signout:hover {
    background: #feecec;
  }
  .signout .ico svg {
    fill: #e34040;
  }

  /* Header */
  .topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .title-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.5px;
    color: #fff;
  }
  .hello {
    font-size: 18px;
    font-weight: 400;
    opacity: 0.95;
    margin: 0;
    color: #fff;
  }
  .page-title {
    margin: 0;
    font-size: 55px;
    line-height: 1.1;
    font-weight: 700;
    color: #fff;
  }
  .logo img {
    height: 38px;
    display: block;
    margin: auto;
  }

  /* Profile Dropdown */
  .profile {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icon-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 6px;
    border-radius: 8px;
    color: #fff;
  }
  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .caret {
    font-size: 16px;
  }
  .profile-info {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
  }
  .avatar-img {
    height: 70px;
    width: 70px;
    border-radius: 9999px;
    object-fit: cover;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
  }
  .who .name {
    font-size: 14px;
    font-weight: 700;
  }
  .who .sub {
    font-size: 12px;
    opacity: 0.95;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    min-width: 200px;
    padding: 6px;
    z-index: 30;
  }
  .menu-btn {
    display: block;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: #fff;
    border-radius: 8px;
    color: #111827;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .menu-btn:hover {
    background: #f3f4f6;
  }

  /* Modal */
  .modal-wrap {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: grid;
    place-items: center;
    z-index: 50;
  }
  .modal {
    background: #fff;
    border-radius: 12px;
    width: 420px;
    max-width: 95vw;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }
  .modal-hd {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
  }
  .modal-ttl {
    font-size: 18px;
    font-weight: 700;
    color: #49bdb3;
  }
  .modal-x {
    border: none;
    background: transparent;
    font-size: 20px;
    cursor: pointer;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
  }
  .tabs button {
    flex: 1;
    padding: 10px;
    background: #f9fafb;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: #000;
  }
  .tabs button.selected {
    background: #fff;
    border-bottom: 2px solid #49bdb3;
    color: #000;
  }

  .modal-bd {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pic-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .preview {
    max-width: 100%;
    border-radius: 10px;
  }
  .placeholder {
    padding: 40px;
    text-align: center;
    color: #6b7280;
    border: 1px dashed #d1d5db;
    border-radius: 10px;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row label {
    font-weight: 600;
    font-size: 14px;
    color: #000;
  }

  .form-ft {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;
  }
  .btn-ghost {
    background: #fff;
    color: #000e;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-weight: 600;
  }
  .btn-primary {
    background: #49bdb3;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-weight: 700;
  }
  .btn-primary:hover {
    filter: brightness(0.95);
  }

  .muted {
    color: #64748b;
    font-size: 12px;
  }

  .input-lg {
    font-size: 16px;
    padding: 12px 14px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .input-lg:focus {
    border-color: #49bdb3;
    box-shadow: 0 0 0 3px rgba(73, 189, 179, 0.15);
  }

  .input-wrap-lg {
    position: relative;
    display: flex;
    align-items: center;
  }
  .input-wrap-lg .input-lg {
    width: 100%;
    padding-right: 44px; /* space for eye icon */
  }

  .eye-btn {
    position: absolute;
    right: 10px;
    height: 32px;
    min-width: 32px;
    display: grid;
    place-items: center;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 8px;
    color: #0c4a6e;
  }
  .eye-btn:hover {
    background: #f3f4f6;
  }

  /* Messages */
  .form-error {
    background: #feecec;
    color: #e34040;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }
  .form-msg {
    background: #eefaf9;
    color: #0c4a6e;
    padding: 10px 14px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }
</style>
