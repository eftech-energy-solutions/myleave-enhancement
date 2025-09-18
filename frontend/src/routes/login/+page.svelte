<script lang="ts">
  export let form: any; // receives error from action (optional)
</script>

<!-- YOUR UI (unchanged visually) -->
<div class="login-wrap">
  <section class="left">
       <div class="flex items-center justify-center gap-4 mb-6">
        <img src="/images/eftech.logo.png" alt="EFTECH" class="h-8 md:h-9" />
        <img src="/images/myleave.logo.png" alt="MYLEAVE" class="h-6 md:h-7" />
      </div>

 

    <h1 class="text-center text-4xl md:text-6xl font-extrabold mb-8 text-[#49bdb3]">
  Hi, Welcome!
</h1>


    <!-- only addition: method="POST" -->
    <form method="POST">
      <!-- only additions: name="username" and name="password" -->
      <input name="username" type="text" placeholder="Username" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">SUBMIT</button>
    </form>

    <p>Contact your company's administrator for registration and any problem occur.</p>

    {#if form?.error}
      <p style="color:#ef4444; margin-top:.75rem">{form.error}</p>
    {/if}
  </section>

  <section class="right"></section>
</div>

<style>
  
  :root{
  --teal:#34c5b7;
  --teal-d:#149383;
  --ring:#e6e8ee;
  --text:#0f172a;
  --muted:#9ca3af;
}

.login-wrap{
  display:grid;
  grid-template-columns: 1fr 40%;
  min-height:100vh;
}

/* LEFT */
.left{
  display:flex;flex-direction:column;justify-content:center;align-items:center;
  padding:48px 32px;
}
.left .flex{ margin-top:20px; margin-bottom:18px; }
.left img{ display:block; object-fit:contain; }
.left img.h-8{ height:48px }           /* eftech size like screenshot */
.left img.h-6{ height:34px }           /* myleave size */

h1{
  margin:10px 0 22px;
  font-weight:800;
  text-align:center;
  color:#49bdb3;           /* keep your color */
  font-size:64px;          /* ≈ the screenshot */
  line-height:1.1;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI"
}

/* FORM */
form{
  width:min(560px, 100%);
  display:grid; gap:16px;
}

/* Inputs with left icons (pure CSS) */
input{
  height:56px;
  padding:0 16px 0 46px;                /* room for icon */
  border-radius:14px;
  border:1px solid var(--ring);
  background:#fff;
  box-shadow:0 6px 18px rgba(0,0,0,.05);
  font-size:16px;
  color:var(--text);
}
input::placeholder{ color:var(--muted); }

/* user icon */
input[name="username"]{
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:14px center;
}
/* lock icon */
input[name="password"]{
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Crect x='3' y='11' width='18' height='10' rx='2'/%3E%3Cpath d='M7 11V7a5 5 0 1 1 10 0v4'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:14px center;
}

/* Button = pill with subtle shadow */
button{
  height:56px;
  border:none; cursor:pointer;
  border-radius:9999px;
  font-weight:800; letter-spacing:.3px; color:#fff;
  background:linear-gradient(180deg, var(--teal), var(--teal-d));
  box-shadow:0 12px 24px rgba(20,147,131,.25);
}
button:hover{ filter:brightness(.98) }

/* Helper text */
.left p{
  margin-top:16px; font-size:14px; color:#64748b; text-align:center;
}

/* RIGHT panel */
.right{
  position:relative;
  background: url('/images/bek7.jpg') center/cover no-repeat fixed;
}
.right::after{
  content:""; position:absolute; inset:0; background:rgba(0,0,0,.08); /* subtle overlay */
}

/* Responsive: hide right panel on small screens; shrink title */
@media (max-width: 980px){
  .login-wrap{ grid-template-columns: 1fr; }
  .right{ display:none; }
  h1{ font-size:44px; }
}

</style>
