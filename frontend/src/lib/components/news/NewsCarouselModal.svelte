<script>
	import { onMount } from 'svelte';
	import { PUBLIC_VITE_API_BASE } from '$env/static/public';
	import { carouselRequest } from './newsStore.js';

	const API = `${PUBLIC_VITE_API_BASE}`;

	let open = false;
	let items = [];
	let index = 0;

	$: current = items[index] || null;

	// ------------------------------------------------------------------
	// DATA
	// ------------------------------------------------------------------
	async function checkDaily() {
		try {
			const res = await fetch(`${API}/api/news/daily`, { credentials: 'include' });
			if (!res.ok) return;
			const data = await res.json();

			if (data.shouldShow && (data.items || []).length > 0) {
				items = data.items;
				index = 0;
				open = true;

				// Record that the popup was shown for today (MYT).
				fetch(`${API}/api/news/popup-seen`, {
					method: 'POST',
					credentials: 'include'
				}).catch(() => {});
			}
		} catch {
			// fail silently - the announcement popup is non critical
		}
	}

	// Manual re-open, triggered from the notification bell. This ignores the
	// once-per-day gate, so the carousel can be brought back at any time.
	async function openOnRequest(startId) {
		try {
			const res = await fetch(`${API}/api/news?limit=20`, { credentials: 'include' });
			if (!res.ok) return;
			const data = await res.json();
			const list = data.items || [];
			if (list.length === 0) return;

			let start = 0;
			if (startId) {
				const found = list.findIndex((it) => it.id === startId);
				if (found >= 0) start = found;
			}

			// open on the requested announcement, then continue with the newer ones
			items = list.slice(start, start + 10);
			index = 0;
			open = true;

			// the user has now seen the announcements - keep the daily gate closed
			fetch(`${API}/api/news/popup-seen`, {
				method: 'POST',
				credentials: 'include'
			}).catch(() => {});
		} catch {
			// fail silently - the announcement popup is non critical
		}
	}

	// reacts to every request (the store holds a counter, not a boolean).
	// This is a store subscription rather than a reactive statement: a `$:`
	// block that writes `items` / `open` would re-trigger itself and the
	// modal could never be closed again.

	// ------------------------------------------------------------------
	// CAROUSEL CONTROLS
	// ------------------------------------------------------------------
	function go(delta) {
		if (items.length === 0) return;
		index = (index + delta + items.length) % items.length;
	}

	function goTo(i) {
		index = i;
	}

	function close() {
		open = false;
	}

	// ------------------------------------------------------------------
	// HELPERS
	// ------------------------------------------------------------------
	function formatDate(value) {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function onKeydown(e) {
		if (!open) return;
		if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
		else if (e.key === 'Escape') close();
	}

	// The cleanup is returned from onMount instead of being registered in a top level
	// onDestroy. SvelteKit runs onDestroy during SSR, where `window` does not exist.
	onMount(() => {
		checkDaily();

		// manual re-open, requested from the notification bell
		const unsub = carouselRequest.subscribe((req) => {
			if (req.id > 0) openOnRequest(req.startId);
		});

		window.addEventListener('keydown', onKeydown);

		return () => {
			unsub();
			window.removeEventListener('keydown', onKeydown);
		};
	});
</script>

{#if open && current}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="news-modal-overlay" on:click={close}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div class="news-modal" on:click|stopPropagation>
			<div class="modal-head">
				<span class="modal-title">Latest Announcements</span>
				<button type="button" class="x-btn" on:click={close} aria-label="Close">✕</button>
			</div>

			<div class="carousel">
				{#key current.id}
					<div class="slide">
						<div class="slide-media">
							{#if current.image_path}
								<img src={`${API}${current.image_path}`} alt={current.title} />
							{:else}
								<div class="media-placeholder">
									<svg
										viewBox="0 0 24 24"
										width="56"
										height="56"
										fill="currentColor"
										aria-hidden="true"
									>
										<path
											d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9h-2v2h-2v-2h-2v-2h2V7h2v2h2v2z"
										/>
									</svg>
									<span>No image attached</span>
								</div>
							{/if}
						</div>

						<div class="slide-body">
							<h2>{current.title}</h2>
							<p class="body-text">{current.body}</p>
							<div class="meta">
								<span>Posted {formatDate(current.created_at)}</span>
								{#if current.created_by_name}
									<span class="dot">•</span>
									<span>{current.created_by_name}</span>
								{/if}
							</div>
						</div>
					</div>
				{/key}
			</div>

			<div class="modal-foot">
				<div class="controls">
					<button
						type="button"
						class="nav-btn"
						on:click={() => go(-1)}
						disabled={items.length < 2}
						aria-label="Previous announcement"
					>
						‹
					</button>

					<div class="dots">
						{#each items as item, i (item.id)}
							<button
								type="button"
								class="dot"
								class:active={i === index}
								on:click={() => goTo(i)}
								aria-label={`Announcement ${i + 1}`}
							></button>
						{/each}
					</div>

					<button
						type="button"
						class="nav-btn"
						on:click={() => go(1)}
						disabled={items.length < 2}
						aria-label="Next announcement"
					>
						›
					</button>
				</div>

				<button type="button" class="close-btn" on:click={close}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.news-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.55);
		display: grid;
		place-items: center;
		padding: 20px;
		z-index: 200;
		animation: fade-in 0.18s ease;
	}

	.news-modal {
		width: min(860px, 100%);
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		background: #fff;
		border-radius: 16px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
		overflow: hidden;
		animation: pop-in 0.22s ease;
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		background: linear-gradient(135deg, var(--brand, #0f9b8e), var(--brand-dark, #0c8075));
		color: #fff;
	}

	.modal-title {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: 0.2px;
	}

	.x-btn {
		border: none;
		background: transparent;
		color: #fff;
		font-size: 15px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 8px;
		line-height: 1;
	}

	.x-btn:hover {
		background: rgba(255, 255, 255, 0.18);
	}

	.carousel {
		overflow-y: auto;
	}

	.slide {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0;
		animation: slide-in 0.25s ease;
	}

	.slide-media {
		background: #f3f4f6;
		display: grid;
		place-items: center;
		min-height: 280px;
		max-height: 420px;
		overflow: hidden;
	}

	.slide-media img {
		width: 100%;
		height: 100%;
		max-height: 420px;
		object-fit: contain;
		display: block;
	}

	.media-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		color: #9ca3af;
		font-size: 13px;
		padding: 40px 20px;
	}

	.slide-body {
		padding: 24px 24px 20px;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.slide-body h2 {
		margin: 0 0 12px;
		font-size: 20px;
		font-weight: 700;
		color: var(--ink, #1f2937);
		line-height: 1.3;
	}

	.body-text {
		margin: 0;
		font-size: 14px;
		line-height: 1.65;
		color: #374151;
		white-space: pre-wrap;
		overflow-y: auto;
	}

	.meta {
		margin-top: auto;
		padding-top: 16px;
		font-size: 12px;
		color: var(--muted, #6b7280);
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.dot {
		color: #d1d5db;
	}

	.modal-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 18px;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.nav-btn {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid #d1d5db;
		background: #fff;
		color: var(--ink, #1f2937);
		font-size: 19px;
		line-height: 1;
		cursor: pointer;
	}

	.nav-btn:hover:not(:disabled) {
		border-color: var(--brand, #0f9b8e);
		color: var(--brand, #0f9b8e);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.dots {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.dot {
		width: 8px;
		height: 8px;
		padding: 0;
		border-radius: 999px;
		border: none;
		background: #d1d5db;
		cursor: pointer;
		transition:
			width 0.18s ease,
			background 0.18s ease;
	}

	.dot.active {
		width: 22px;
		background: var(--brand, #0f9b8e);
	}

	.close-btn {
		border: none;
		background: var(--brand, #0f9b8e);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		padding: 9px 20px;
		border-radius: 9px;
		cursor: pointer;
	}

	.close-btn:hover {
		background: var(--brand-dark, #0c8075);
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(12px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (max-width: 720px) {
		.slide {
			grid-template-columns: 1fr;
		}

		.slide-media {
			min-height: 200px;
			max-height: 260px;
		}

		.slide-media img {
			max-height: 260px;
		}

		.slide-body {
			padding: 18px;
		}

		.slide-body h2 {
			font-size: 17px;
		}
	}
</style>
