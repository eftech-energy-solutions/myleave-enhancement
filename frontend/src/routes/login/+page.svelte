<script>
  import { goto } from '$app/navigation'; // import SvelteKit navigation
  let email = "";
  let password = "";

  async function handleLogin() {
    // Example login fetch
    const res = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (data.success) {
      alert("✅ Login successful!");
      goto("/dashboard");
    } else {
      alert("❌ " + data.message);
    }
  }
</script>

<div class="flex min-h-screen">
  <!-- Left: login form -->
  <div class="w-full md:w-4/4 flex flex-col justify-center items-center bg-white px-8 md:px-16">
    <div class="w-full max-w-lg">
      <!-- Logos -->
      <div class="flex justify-center items-center space-x-4 mb-6">
        <img src="/images/eftech.logo.png" alt="Eftech Logo" class="h-12" />
        <img src="/images/myleave.logo.png" alt="Myleave Logo" class="h-12" />
      </div>

      <!-- Title -->
      <h1 class="text-5xl font-bold text-teal-600 mb-8 text-center">Hi, Welcome!</h1>

      <!-- Form -->
      <form on:submit|preventDefault={handleLogin} class="space-y-4">
        <div>
          <input
            type="email"
            bind:value={email}
            placeholder="Email"
            class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <input
            type="password"
            bind:value={password}
            placeholder="Password"
            class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <p class="text-gray-400 text-xs text-center">
          Contact your company’s administrator for registration and any problem occur.
        </p>

        <button
          type="submit"
          class="w-40 bg-teal-500 text-white font-semibold py-3 rounded-full hover:bg-teal-600 transition mx-auto block"
        >
          SUBMIT
        </button>

      </form>
    </div>
  </div>

  <!-- Right: teal background -->
  <div class="hidden md:block w-2/3">
    <img src="/images/bek7.jpg" alt="Background" class="w-full h-full object-cover" />
  </div>
</div>
