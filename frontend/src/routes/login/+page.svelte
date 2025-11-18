<script>
	import { onMount } from 'svelte';

	// -------------------------------
	// VIEW STATE (same page toggles)
	// 'login' | 'forgot' | 'reset' | 'success'
	// -------------------------------
	let uiState = 'login';

	// -------------------------------
	// LOGIN
	// -------------------------------
	let email = '';
	let password = '';
	let loginLoading = false;
	let loginError = ''; // inline under password

	onMount(async () => {
		try {
			// Optional prefill email (if already known)
			const r = await fetch('http://localhost:5000/api/employee/me', { credentials: 'include' });
			if (r.ok) {
				const me = await r.json();
				email = me?.email || '';
			}
		} catch (_) {}
	});

	async function handleLogin(e) {
		e.preventDefault();
		loginError = '';
		loginLoading = true;
		try {
			const res = await fetch('http://localhost:5000/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email: email.trim().toLowerCase(), password })
			});
			const data = await res.json();

			if (!res.ok) {
    loginError =
        data?.error === 'Invalid email or password'
            ? 'Wrong password'
            : data?.error || 'Login failed';
    return;
}
			window.location.href = data.redirectTo || '/dashboard/staff';
		} catch (err) {
			console.error(err);
			loginError = 'Login failed';
		} finally {
			loginLoading = false;
		}
	}
	// -------------------------------
	// FORGOT (Send OTP)
	// -------------------------------
	let emailValue = ''; // the "forgot" email input
	let forgotLoading = false;
	let form = null;
	let sending = false;
	let resendCooldown = 0;
	let resendTimer = null;

	async function handleForgotSubmit(e) {
		e.preventDefault();
		form = { error: null, success: false, emailMasked: null };
		forgotLoading = true;

		try {
			const email = (emailValue || '').trim().toLowerCase();
			if (!email) {
				form.error = 'Please enter your email.';
				return;
			}

			const r = await fetch('http://localhost:5000/api/auth/forgot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = await r.json();

			if (!r.ok || data?.error) {
				form.error = data?.error || 'Failed to send OTP.';
				return;
			}

			// Go straight to RESET
			resetEmail = email;
			uiState = 'reset';
			
			// *** PERUBAHAN ***: Reset state untuk flow baru
			resetStep = 'verify_otp'; // Mula dengan step 1
			otpValues = ['', '', '', '', '', '']; // Clear OTP
			resetErr = '';
			resetMsg = '';
			
		} catch (err) {
			console.error(err);
			form = { error: 'Failed to send OTP.', success: false };
		} finally {
			forgotLoading = false;
		}
	}

	function maskEmail(e) {
		try {
			const [u, d] = e.split('@');
			if (!u || !d) return e;
			const maskedUser = u.length <= 2 ? u[0] + '*' : u[0] + '*'.repeat(Math.max(1, u.length - 2)) + u[u.length - 1];
			return `${maskedUser}@${d}`;
		} catch { return e; }
	}

	function startResendCooldown() {
		clearInterval(resendTimer);
		resendCooldown = 30; // seconds
		resendTimer = setInterval(() => {
			resendCooldown -= 1;
			if (resendCooldown <= 0) clearInterval(resendTimer);
		}, 1000);
	}

	async function resendCode() {
		if (!resetEmail || resendCooldown > 0) return;
		sending = true;
		try {
			const r = await fetch('http://localhost:5000/api/auth/forgot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: resetEmail })
			});
			startResendCooldown();
		} catch (e) {
		} finally {
			sending = false;
		}
	}

	// -------------------------------
	// RESET (OTP & Set Password) - FLOW BARU
	// -------------------------------
	let resetEmail = ''; // prefilled after forgot
	let newPwd1 = '';
	let newPwd2 = '';
	let resetLoading = false; // Loading untuk final submit password
	let resetMsg = '';
	let resetErr = '';

	// *** STATE BARU ***
	let resetStep = 'verify_otp'; // 'verify_otp' | 'set_password'
	let otpValues = ['', '', '', '', '', '']; // Untuk 6 kotak
	let otpInputs = []; // Rujukan kpd elemen input
	let otpLoading = false; // Loading untuk OTP verification

	// --- Fungsi Baru untuk 6 Kotak OTP ---
	function handleOtpInput(e, i) {
		const el = e.target;
		const val = el.value;
		
		// Hanya benarkan 1 digit
		if (!/^[0-9]$/.test(val)) {
			el.value = '';
			otpValues[i] = ''; // Pastikan state juga clear
			return;
		}
		
		otpValues[i] = val; // Update state
		
		// Auto-focus next
		if (i < 5 && val) {
			otpInputs[i + 1]?.focus();
		}
	}

	function handleOtpKeydown(e, i) {
		// Auto-focus previous on backspace
		if (e.key === 'Backspace' && !otpValues[i]) {
			if (i > 0) {
				otpInputs[i - 1]?.focus();
			}
		}
	}

	function handleOtpPaste(e, i) {
		e.preventDefault();
		const pasteData = e.clipboardData.getData('text').trim().slice(0, 6);
		
		if (!/^\d+$/.test(pasteData)) return; // Hanya paste digit

		// Isi kotak-kotak
		for (let k = 0; k < pasteData.length; k++) {
			if (i + k < 6) {
				otpValues[i + k] = pasteData[k];
			}
		}
		
		// Focus pada elemen terakhir diisi
		const nextFocus = Math.min(i + pasteData.length, 5);
		otpInputs[nextFocus]?.focus();
	}
	// --- Tamat Fungsi OTP ---


	// *** FUNGSI SUBMIT UTAMA ***
	// Form submit sekarang akan panggil fungsi ini,
	// yang akan tentukan nak verify OTP atau set password.
	async function handleResetFlow(e) {
		e.preventDefault();
		if (resetStep === 'verify_otp') {
			await verifyOtp();
		} else {
			await submitNewPassword();
		}
	}

	// *** FUNGSI BARU: STEP 1 - Verify OTP ***
	async function verifyOtp() {
		const otp = otpValues.join('');
		if (otp.length !== 6) {
			resetErr = 'Please enter the 6-digit OTP.';
			return;
		}

		resetErr = '';
		otpLoading = true;
		
		try {
			// // Anda PERLU BUAT endpoint baru ni di backend.
			// Contoh: POST /api/auth/verify-otp
			// Body: { "email": "user@email.com", "otp": "123456" }
			// Backend check jika OTP sah & belum expired.
			// Jika OK, hantar { "success": true }
			// Jika Gagal, hantar { "error": "Wrong OTP number." }
			
			const r = await fetch('http://localhost:5000/api/auth/verify-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: resetEmail, otp })
			});
			const data = await r.json();

			if (!r.ok || data?.error) {
				resetErr = data?.error || 'Wrong OTP number. Please try again.';
				return;
			}

			// --- OTP SAH! ---
			resetStep = 'set_password'; // Pindah ke step 2
			resetErr = ''; // Clear error
			
		} catch (err) {
			console.error(err);
			resetErr = 'An error occurred during verification.';
		} finally {
			otpLoading = false;
		}
	}

	// *** FUNGSI DIUBAHSUAI: STEP 2 - Set New Password ***
	// Ini adalah logik asal 'handleResetSubmit'
	async function submitNewPassword() {
		const otp = otpValues.join(''); // OTP masih diperlukan
		resetMsg = '';
		resetErr = '';
		
		// Validasi password
		if (!newPwd1 || !newPwd2) {
			resetErr = 'Please fill all password fields.';
			return;
		}
		if (newPwd1 !== newPwd2) {
			resetErr = 'Passwords do not match.';
			return;
		}
		if (newPwd1.length < 8) {
			resetErr = 'Password must be at least 8 characters.';
			return;
		}

		resetLoading = true; // Guna loading state asal
		
		try {
			const emailToReset = (resetEmail || '').trim().toLowerCase();
			
			// Panggil endpoint ASAL
			const r = await fetch('http://localhost:5000/api/auth/reset', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: emailToReset, otp, newPassword: newPwd1 })
			});
			const data = await r.json();

			if (!r.ok || data?.error) {
				resetErr = data?.error || 'Failed to reset password.';
				
				// Jika OTP tiba-tiba expired (security), hantar user balik ke step 1
				if (data?.error.toLowerCase().includes('otp')) {
					resetErr = data.error + ' Please request a new one.';
					resetStep = 'verify_otp'; // Hantar balik ke step OTP
				}
				return;
			}

			// --- BERJAYA RESET! ---
			resetMsg = 'Password has been reset. You can now login.';
			setTimeout(() => {
				email = resetEmail; 
				uiState = 'login';
				// Reset semua state untuk 'reset'
				resetMsg = '';
				resetErr = '';
				resetStep = 'verify_otp';
				otpValues = ['', '', '', '', '', ''];
				newPwd1 = '';
				newPwd2 = '';
			}, 1200);

		} catch (err) {
			console.error(err);
			resetErr = 'Failed to reset password.';
		} finally {
			resetLoading = false;
		}
	}
</script>

<div class="login-wrap">
	<section class="left">
		<div class="flex items-center justify-center gap-4 mb-6">
			<img src="/images/eftech.logo.png" alt="EFTECH" class="h-8 md:h-9" />
			<img src="/images/myleave.logo.png" alt="MYLEAVE" class="h-8 md:h-9" />
		</div>

		{#if uiState === 'login'}
			<h1 class="title">Hi, Welcome!</h1>
			<form on:submit|preventDefault={handleLogin} class="form-layout">
				<input type="email" name="email" bind:value={email} placeholder="Email" autocomplete="email" required />
				<input type="password" name="password" bind:value={password} placeholder="Password" required />
				{#if loginError}
					<p class="error-msg">❌ {loginError}</p>
				{/if}
				<button type="submit" disabled={loginLoading}>
					{#if loginLoading}Logging in...{:else}Login{/if}
				</button>
			</form>
			<div class="links">
				<button class="link-btn" on:click={() => { uiState = 'forgot'; form = null; }}>
					Forgot Password?
				</button>
			</div>
			{#if form?.error && !form.success}
				<p class="error-msg">{form.error}</p>
			{/if}

		{:else if uiState === 'forgot'}
			<h1 class="title">Reset Password</h1>
			<p class="subtitle">Enter your registered email address to receive a one-time code.</p>
			<form class="form-layout" on:submit|preventDefault={handleForgotSubmit}>
				<input
					name="email"
					type="email"
					placeholder="Registered Email"
					required
					bind:value={emailValue}
				/>
				<button type="submit" disabled={forgotLoading}>
					{#if forgotLoading}SENDING...{:else}SEND RESET CODE{/if}
				</button>
			</form>
			<div class="links">
				<button class="link-btn" on:click={() => { uiState = 'login'; form = null; }}>
					&larr; Back to Login
				</button>
			</div>
			{#if form?.error}
				<p class="error-msg">{form.error}</p>
			{/if}
			
		{:else if uiState === 'reset'}
			<h1 class="title">
				{#if resetStep === 'verify_otp'}Enter OTP{:else}Set New Password{/if}
			</h1>
			<p class="subtitle">
				{#if resetStep === 'verify_otp'}
					We’ve sent a 6-digit code to <b>{resetEmail || 'your email'}</b>.
				{:else}
					Great! Now create your new password.
				{/if}
			</p>

			<form class="form-layout" on:submit|preventDefault={handleResetFlow}>
				
				<input 
					name="resetEmail" 
					type="email" 
					placeholder="Email" 
					bind:value={resetEmail} 
					disabled 
					style="background-color: #f4f4f5; color: #71717a;"
				/>

				{#if resetStep === 'verify_otp'}
					<div class="otp-inputs">
						{#each {length: 6} as _, i}
							<input
								type="text"
								maxlength="1"
								autocomplete="off"
								pattern="\d*"
								inputmode="numeric"
								bind:this={otpInputs[i]}
								bind:value={otpValues[i]}
								on:input={(e) => handleOtpInput(e, i)}
								on:keydown={(e) => handleOtpKeydown(e, i)}
								on:paste={(e) => handleOtpPaste(e, i)}
								required
							/>
						{/each}
					</div>
					
					{#if resetErr}<p class="error-msg">{resetErr}</p>{/if}

					<button type="submit" disabled={otpLoading}>
						{#if otpLoading}VERIFYING...{:else}VERIFY OTP{/if}
					</button>

				{:else if resetStep === 'set_password'}
					<input name="newPwd1" type="password" placeholder="New password (min 8 chars)" bind:value={newPwd1} required />
					<input name="newPwd2" type="password" placeholder="Confirm new password" bind:value={newPwd2} required />

					{#if resetErr}<p class="error-msg">{resetErr}</p>{/if}
					{#if resetMsg}<p class="footer-note" style="color:#16a34a">{resetMsg}</p>{/if}

					<button type="submit" disabled={resetLoading}>
						{#if resetLoading}RESETTING...{:else}RESET PASSWORD{/if}
					</button>
				{/if}
			</form>

			<div class="links">
				<button
					class="link-btn"
					on:click={resendCode}
					disabled={sending || resendCooldown > 0}
					title="Resend OTP"
				>
					{#if sending}
						Sending...
					{:else if resendCooldown > 0}
						Resend in {resendCooldown}s
					{:else}
						Resend code
					{/if}
				</button>
				&nbsp;|&nbsp;
				<button class="link-btn" on:click={() => { uiState = 'forgot'; form = null; }}>
					Change email
				</button>
			</div>

		{:else if uiState === 'success'}
			<h1 class="title" style="color:#49bdb3;">Email Sent!</h1>
			<p class="subtitle" style="max-width:450px;">
				{#if form?.emailMasked}
					An OTP has been sent to <b>{form.emailMasked}</b>.<br />The code is valid for 10 minutes only.
				{:else}
					If an account with that email exists, instructions have been sent.
				{/if}
				<br />Please also check your spam folder.
			</p>
			<div class="links">
				<button
					class="link-btn"
					on:click={resendCode}
					disabled={sending || resendCooldown > 0}
				>
					{#if sending}
						Sending...
					{:else if resendCooldown > 0}
						Resend in {resendCooldown}s
					{:else}
						Resend code
					{/if}
				</button>
				&nbsp;|&nbsp;
				<button class="link-btn" on:click={() => { uiState = 'forgot'; form = null; }}>
					Change email
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
		max-width: 420px;
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

	input[name="email"],
	input[type="email"] {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 14px center;
	}

	input[name="password"] {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%239ca3af' stroke-width='2' viewBox='0 0 24 24'%3E%3Crect x='3' y='11' width='18' height='10' rx='2'/%3E%3Cpath d='M7 11V7a5 5 0 1 1 10 0v4'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: 14px center
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
		filter: brightness(0.9);
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

	.link-btn:disabled {
		color: #9ca3af;
		text-decoration: none;
		cursor: not-allowed;
	}

	.footer-note,
	.error-msg {
		margin-top: 16px;
		font-size: 14px;
		color: #64748b;
		text-align: center;
	}

	.error-msg {
		color: #ef4444;
		margin-top: 4px; /* Kurangkan margin sikit */
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

	/* --- CSS BARU UNTUK KOTAK OTP --- */
	.otp-inputs {
		display: flex;
		gap: 10px;
		justify-content: center;
		width: 100%;
		box-sizing: border-box;
	}

	.otp-inputs input {
		width: 56px; /* Lebar sikit */
		height: 64px; /* Tinggi sikit */
		font-size: 24px;
		font-weight: 600;
		text-align: center;
		padding: 0; /* Buang padding asal */
		background-image: none; /* Buang ikon */
		line-height: 1;
	}
	/* --- TAMAT CSS BARU --- */


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
	
	/* Responsif untuk kotak OTP pada skrin kecil */
	@media (max-width: 480px) {
		.otp-inputs {
			gap: 6px;
		}
		.otp-inputs input {
			width: 44px;
			height: 52px;
			font-size: 20px;
		}
	}
</style>