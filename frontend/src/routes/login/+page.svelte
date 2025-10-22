<script>
  import { goto } from '$app/navigation';
  let email = '';
  let password = '';
  let errorMsg = '';

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const data = await res.json();
      console.log('Login response:', data);
      console.log('About to redirect to:', data.redirectTo);
      console.log('Redirect attempted to:', data.redirectTo);
      console.log('Current URL:', window.location.pathname);


      if (data.success) {
        console.log('About to redirect to:', data.redirectTo);

        // 🧠 guna cara ni untuk paksa redirect di client-side
        setTimeout(() => {
          window.location.href = data.redirectTo;
        }, 300);
      } else {
        errorMsg = data.error || 'Login failed';
      }
    } catch (err) {
      console.error(err);
      errorMsg = 'Something went wrong.';
    }
  }
</script>

<div class="login-wrap">
  <section class="left">
    <div class="flex items-center justify-center gap-4 mb-6">
      <img src="/images/eftech.logo.png" alt="EFTECH" class="h-8 md:h-9" />
      <img src="/images/myleave.logo.png" alt="MYLEAVE" class="h-6 md:h-7" />
    </div>

    <h1 class="text-center text-4xl md:text-6xl font-extrabold mb-8 text-[#49bdb3]">
      Hi, Welcome!
    </h1>

    <form on:submit|preventDefault={handleLogin}>
      <input type="text" name="email" bind:value={email} placeholder="Email" autocomplete="email" required />
      <input type="password" bind:value={password} placeholder="Password" required />
      <button type="button" on:click={handleLogin}>Login</button>
    </form>

    <p>Contact your company's administrator for registration and any problem occur.</p>

    {#if errorMsg}
      <p style="color:#ef4444; margin-top:.75rem">{errorMsg}</p>
    {/if}
  </section>

  <section class="right"></section>
</div>

<style>
  :root {
    --teal:#34c5b7;
    --teal-d:#149383;
    --ring:#e6e8ee;
    --text:#0f172a;
    --muted:#9ca3af;
  }

  .login-wrap {
    display:grid;
    grid-template-columns: 1fr 40%;
    min-height:100vh;
  }

  .left {
    display:flex;flex-direction:column;justify-content:center;align-items:center;
    padding:48px 32px;
  }
  .left .flex{ margin-top:20px; margin-bottom:18px; }
  .left img{ display:block; object-fit:contain; }

  h1 {
    margin:10px 0 22px;
    font-weight:800;
    text-align:center;
    color:#49bdb3;
    font-size:64px;
    line-height:1.1;
  }

  form {
    width:min(560px, 100%);
    display:grid; gap:16px;
  }

  input {
    height:56px;
    padding:0 16px;
    border-radius:14px;
    border:1px solid var(--ring);
    background:#fff;
    box-shadow:0 6px 18px rgba(0,0,0,.05);
    font-size:16px;
    color:var(--text);
  }
  input::placeholder{ color:var(--muted); }

  button {
    height:56px;
    border:none; cursor:pointer;
    border-radius:9999px;
    font-weight:800; letter-spacing:.3px; color:#fff;
    background:linear-gradient(180deg, var(--teal), var(--teal-d));
    box-shadow:0 12px 24px rgba(20,147,131,.25);
  }
  button:hover{ filter:brightness(.98) }

  .left p {
    margin-top:16px; font-size:14px; color:#64748b; text-align:center;
  }

  .right {
    position:relative;
    background: url('/images/bek7.jpg') center/cover no-repeat fixed;
  }
  .right::after {
    content:""; position:absolute; inset:0; background:rgba(0,0,0,.08);
  }

  @media (max-width: 980px){
    .login-wrap{ grid-template-columns: 1fr; }
    .right{ display:none; }
    h1{ font-size:44px; }
  }
</style>
