<script lang="ts">
  import Icon from '@iconify/svelte';
  import { goto } from '$app/navigation';

  let email = '';
  let password = '';
  let showPassword = false;
  let loading = false;
  let error = '';

  async function submit() {
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Cookie is set server-side; the /dashboard route will redirect by role
        goto('/dashboard');
      } else {
        error = data?.message ?? 'Invalid email or password';
      }
    } catch {
      error = 'Network error. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<form class="space-y-4" on:submit|preventDefault={submit} autocomplete="on">
  <!-- Email -->
  <label class="block">
    <span class="sr-only">Email</span>
    <div class="relative">
      <span class="absolute inset-y-0 left-3 flex items-center">
        <Icon icon="material-symbols:person" class="h-5 w-5 text-gray-400" />
      </span>
      <input
        type="email"
        bind:value={email}
        placeholder="Email"
        class="w-full rounded-xl border border-gray-200 bg-white/90 pl-10 pr-10 py-3 outline-none
               placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-[#49bdb3] focus:border-[#49bdb3]"
        name="email"
        autocomplete="email"
        required
      />
    </div>
  </label>

  <!-- Password -->
  <label class="block">
    <span class="sr-only">Password</span>
    <div class="relative">
      <span class="absolute inset-y-0 left-3 flex items-center">
        <Icon icon="ooui:lock" class="h-5 w-5 text-gray-400" />
      </span>
      <input
        type={showPassword ? 'text' : 'password'}
        bind:value={password}
        placeholder="Password"
        class="w-full rounded-xl border border-gray-200 bg-white/90 pl-10 pr-10 py-3 outline-none
               placeholder-gray-400 shadow-sm focus:ring-2 focus:ring-[#49bdb3] focus:border-[#49bdb3]"
        name="password"
        autocomplete="current-password"
        required
      />
      <!-- Toggle visibility -->
      <button
        type="button"
        class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
        on:click={() => (showPassword = !showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        <Icon icon={showPassword ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} class="h-5 w-5" />
      </button>
    </div>
  </label>

  {#if error}
    <p class="text-red-600 text-sm">{error}</p>
  {/if}

  <!-- Submit -->
  <button
    type="submit"
    class="mt-2 w-full rounded-full px-6 py-3 font-semibold tracking-wide
           bg-[#49bdb3] hover:bg-[#40B1A7] active:bg-[#38948e]
           text-white shadow-md transition disabled:opacity-60"
    disabled={loading}
  >
    {loading ? 'Signing in…' : 'SUBMIT'}
  </button>
</form>
