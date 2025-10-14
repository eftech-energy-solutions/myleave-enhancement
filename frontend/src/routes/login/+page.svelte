<script lang="ts">
  export let form: any; // Receives data/errors from server actions

  // UI state to switch between login and forgot password views
  let uiState: 'login' | 'forgot' | 'success' = 'login';

  // If the server returns a success message from the forgot password action,
  // switch the UI to the success view.
  $: if (form?.success) {
    uiState = 'success';
  }
</script>

<div class="login-wrap">
  <section class="left">
    <div class="flex items-center justify-center gap-4 mb-6">
      <img src="/images/eftech.logo.png" alt="EFTECH" class="h-8 md:h-9" />
      <img src="/images/myleave.logo.png" alt="MYLEAVE" class="h-8 md:h-9" />
    </div>

    <!-- View for Login -->
    {#if uiState === 'login'}
      <h1 class="title">Hi, Welcome!</h1>
      <form method="POST" action="?/login" class="form-layout">
        <input name="username" type="text" placeholder="Username" required />
        <input name="password" type="password" placeholder="Password" required />
        <button type="submit">SUBMIT</button>
      </form>

      <div class="links">
        <button class="link-btn" on:click={() => uiState = 'forgot'}>
          Forgot Password?
        </button>
      </div>

      {#if form?.error && !form.success}
        <p class="error-msg">{form.error}</p>
      {/if}

    <!-- View for Forgot Password -->
    {:else if uiState === 'forgot'}
      <h1 class="title">Reset Password</h1>
      <p class="subtitle">Enter your registered email address to receive a temporary password.</p>
      <form method="POST" action="?/forgotPassword" class="form-layout">
        <input name="email" type="email" placeholder="Registered Email" required />
        <button type="submit">SEND RESET LINK</button>
      </form>

      <div class="links">
        <button class="link-btn" on:click={() => uiState = 'login'}>
          &larr; Back to Login
        </button>
      </div>
       {#if form?.error}
        <p class="error-msg">{form.error}</p>
      {/if}


    <!-- View for Success Message -->
    {:else if uiState === 'success'}
       <h1 class="title" style="color:#49bdb3;">Check Your Email</h1>
       <p class="subtitle" style="max-width: 450px;">
         If an account with that email exists, a temporary password has been sent. Please also check your spam folder. The password is valid for 30 minutes.
       </p>
       <div class="links">
        <button class="link-btn" on:click={() => { uiState = 'login'; form = null; }}>
          &larr; Back to Login
        </button>
      </div>
    {/if}

    <p class="footer-note">
      Contact your company's administrator for registration and any problem occur.
    </p>
  </section>

  <section class="right"></section>
</div>

<style>
  :root {
    --teal: #34c5b7;
    --teal-d: #149383;
    --ring: #e6e8ee;
    --text: #0f172a;
    --muted: #9ca3af;
  }

  .login-wrap {
    display: grid;
    grid-template-columns: 1fr 40%;
    min-height: 100vh;
  }

  .left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 48px 32px;
  }
  .left .flex {
    margin-top: 20px;
    margin-bottom: 18px;
  }
  .left img {
    object-fit: contain;
  }
  .left img.h-8 {
    height: 48px;
  }
  .left img.h-6 {
    height: 34px;
  }

  .title {
    margin: 10px 0 22px;
    font-weight: 800;
    text-align: center;
    color: #49bdb3;
    font-size: 60px;
    line-height: 1.1;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI";
  }
  
  .subtitle {
    font-size: 16px;
    color: #4b5563;
    text-align: center;
    margin-top: -1rem;
    margin-bottom: 1.5rem;
  }

  .form-layout {
    width: min(560px, 100%);
    display: grid;
    gap: 16px;
  }

  input {
    height: 56px;
    padding: 0 16px 0 46px;
    border-radius: 14px;
    border: 1px solid var(--ring);
    background: #fff;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
    font-size: 16px;
    color: var(--text);
  }
  input::placeholder {
    color: var(--muted);
  }

  input[name="username"], input[type="email"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: 14px center;
  }
  input[name="password"] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Crect x='3' y='11' width='18' height='10' rx='2'/%3E%3Cpath d='M7 11V7a5 5 0 1 1 10 0v4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: 14px center;
  }

  button[type="submit"] {
    height: 56px;
    border: none;
    cursor: pointer;
    border-radius: 9999px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: #fff;
    background: linear-gradient(180deg, var(--teal), var(--teal-d));
  }
  button:hover {
    filter: brightness(0.90);
  }

  .links {
    margin-top: 1rem;
    text-align: center;
  }
  .link-btn {
    background: none;
    border: none;
    color: var(--teal-d);
    text-decoration: underline;
    cursor: pointer;
    font-size: 14px;
  }

  .footer-note, .error-msg {
    margin-top: 16px;
    font-size: 14px;
    color: #64748b;
    text-align: center;
  }
  .error-msg {
    color: #ef4444;
  }
  
  .right {
    position: relative;
    background: url('/images/bek7.jpg') center/cover no-repeat fixed;
  }
  .right::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.08);
  }

  @media (max-width: 980px) {
    .login-wrap {
      grid-template-columns: 1fr;
    }
    .right {
      display: none;
    }
    .title {
      font-size: 44px;
    }
  }
</style>

