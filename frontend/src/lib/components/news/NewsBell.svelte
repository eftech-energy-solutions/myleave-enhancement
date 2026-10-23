<script>
	import { onMount } from 'svelte';
	import { PUBLIC_VITE_API_BASE } from '$env/static/public';
	import { openCarousel } from './newsStore.js';

	const API = `${PUBLIC_VITE_API_BASE}`;

	let unreadCount = 0;
	let open = false;
	let items = [];
	let loading = false;
	let pollTimer = null;

	// ------------------------------------------------------------------
	// DATA
	// ------------------------------------------------------------------
	async function loadUnreadCount() {
		try {
			const res = await fetch(`${API}/api/news/unread-count`, { credentials: 'include' });
			if (!res.ok) return;
			const data = await res.json();
			unreadCount = data.unread_count || 0;
		} catch {
			// badge is non critical - fail silently
		}
	}

	async function loadNews() {
		loading = true;
		try {
			const res = await fetch(`${API}/api/news?limit=20`, { credentials: 'include' });
			if (!res.ok) return;
			const data = await res.json();
			items = data.items || [];
			unreadCount = data.unread_count || 0;
		} catch {
			// fail silently
		} finally {
			loading = false;
		}
	}

	async function togglePanel() {
		open = !open;
		if (open) await loadNews();
	}

	// Re-open the announcement carousel on demand. The daily popup only shows
	// once per day, so this is the manual way to bring it back.
	function showCarousel(startId = null) {
		open = false;
		openCarousel(startId);
	}

	async function markRead(item) {
		if (item.is_read) return;
		try {
			await fetch(`${API}/api/news/${item.id}/read`, {
				method: 'POST',
				credentials: 'include'
			});
		} catch {
			// ignore - the local state is still updated below
		}
		item.is_read = true;
		unreadCount = Math.max(0, unreadCount - 1);
		window.dispatchEvent(new CustomEvent('news-updated'));
	}

	async function markAllRead() {
		try {
			await fetch(`${API}/api/news/read-all`, {
				method: 'POST',
				credentials: 'include'
			});
		} catch {
			// ignore
		}
		items = items.map((i) => ({ ...i, is_read: true }));
		unreadCount = 0;
		window.dispatchEvent(new CustomEvent('news-updated'));
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

	function onDocumentClick(e) {
		if (!open) return;
		if (e.target && e.target.closest && e.target.closest('.news-bell-root')) return;
		open = false;
	}

	function onVisibilityChange() {
		if (document.visibilityState === 'visible') loadUnreadCount();
	}

	// ------------------------------------------------------------------
	// LIFECYCLE
	// ------------------------------------------------------------------
	// NOTE: the cleanup is returned from onMount instead of being registered in a
	// top level onDestroy. SvelteKit runs onDestroy during SSR, where `document`
	// and `window` do not exist -> ReferenceError -> 500 on the dashboard pages.
	onMount(() => {
		loadUnreadCount();
		pollTimer = setInterval(loadUnreadCount, 30000);
		document.addEventListener('click', onDocumentClick);
		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('news-updated', loadUnreadCount);

		return () => {
			if (pollTimer) clearInterval(pollTimer);
			document.removeEventListener('click', onDocumentClick);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('news-updated', loadUnreadCount);
		};
	});
</script>

<span class="news-bell-root">
	<button
		type="button"
		class="bell"
		class:has-unread={unreadCount > 0}
		on:click={togglePanel}
		aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
		aria-expanded={open}
		title="Notifications"
	>
		<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
			<path
				d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
			/>
		</svg>
	</button>

	{#if unreadCount > 0}
		<span class="count">{unreadCount > 9 ? '9+' : unreadCount}</span>
	{/if}
</span>

{#if open}
	<div class="news-panel" role="dialog" aria-label="Notifications">
		<div class="panel-head">
			<button
				type="button"
				class="head-btn"
				on:click={() => showCarousel()}
				title="Show announcements"
			>
				<h4>Notifications</h4>
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
					<path d="M8 5v14l11-7z" />
				</svg>
			</button>
			{#if unreadCount > 0}
				<button type="button" class="link-btn" on:click={markAllRead}>Mark all as read</button>
			{/if}
		</div>

		<div class="panel-body">
			{#if loading}
				<p class="empty">Loading…</p>
			{:else if items.length === 0}
				<p class="empty">No announcements yet.</p>
			{:else}
				<ul class="news-list">
					{#each items as item (item.id)}
						<li class="news-row" class:unread={!item.is_read}>
							{#if item.image_path}
								<img class="thumb" src={`${API}${item.image_path}`} alt="" />
							{:else}
								<div class="thumb thumb-ph" aria-hidden="true">
									<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
										<path
											d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9h-2v2h-2v-2h-2v-2h2V7h2v2h2v2z"
										/>
									</svg>
								</div>
							{/if}

							<div class="row-main">
								<button
									type="button"
									class="row-title"
									on:click={() => showCarousel(item.id)}
									title="Show this announcement"
								>
									{item.title}
								</button>
								<div class="row-meta">{formatDate(item.created_at)}</div>
							</div>

							{#if item.is_read}
								<span class="read-flag">Read</span>
							{:else}
								<button type="button" class="mark-btn" on:click={() => markRead(item)}>
									Mark read
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<style>
	.news-bell-root {
		position: absolute;
		top: 0;
		left: -1px;
		transform: translate(-30%, -30%);
		z-index: 6;
		display: inline-flex;
	}

	.bell {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 2px solid #fff;
		background: rgba(15, 155, 142, 0.72);
		color: #fff;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
		box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
		transition:
			background 0.2s ease,
			transform 0.15s ease;
	}

	.bell:hover {
		background: rgba(15, 155, 142, 0.92);
	}

	.bell:active {
		transform: scale(0.94);
	}

	.bell.has-unread {
		background: var(--brand, #0f9b8e);
	}

	.count {
		position: absolute;
		top: -2px;
		right: -7px;
		min-width: 16px;
		height: 16px;
		padding: 0 3px;
		border-radius: 999px;
		background: #dc2626;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		line-height: 16px;
		text-align: center;
		border: 2px solid #fff;
		box-sizing: border-box;
	}

	.news-panel {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		width: 380px;
		max-width: calc(100vw - 32px);
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		box-shadow: 0 12px 34px rgba(0, 0, 0, 0.18);
		z-index: 60;
		overflow: hidden;
		color: var(--ink, #1f2937);
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.panel-head h4 {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
	}

	/* the "Notifications" title doubles as the button that re-opens the carousel */
	.head-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: none;
		background: transparent;
		padding: 4px 6px;
		margin-left: -6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--ink, #1f2937);
	}

	.head-btn:hover {
		background: rgba(15, 155, 142, 0.1);
		color: var(--brand, #0f9b8e);
	}

	.head-btn svg {
		flex-shrink: 0;
		opacity: 0.75;
	}

	.head-btn:hover svg {
		opacity: 1;
	}

	.link-btn {
		border: none;
		background: transparent;
		color: var(--brand, #0f9b8e);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 6px;
		border-radius: 6px;
	}

	.link-btn:hover {
		background: rgba(15, 155, 142, 0.1);
	}

	.panel-body {
		max-height: 360px;
		overflow-y: auto;
	}

	.empty {
		margin: 0;
		padding: 26px 14px;
		text-align: center;
		font-size: 13px;
		color: var(--muted, #6b7280);
	}

	.news-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.news-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid #f1f5f9;
	}

	.news-row.unread {
		background: rgba(15, 155, 142, 0.06);
	}

	.thumb {
		width: 42px;
		height: 42px;
		border-radius: 8px;
		object-fit: cover;
		flex-shrink: 0;
		background: #f3f4f6;
	}

	.thumb-ph {
		display: grid;
		place-items: center;
		color: #9ca3af;
	}

	.row-main {
		flex: 1;
		min-width: 0;
	}

	.row-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink, #1f2937);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		/* it is a button - strip the default chrome but keep it clickable */
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		width: 100%;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
	}

	.row-title:hover {
		color: var(--brand, #0f9b8e);
		text-decoration: underline;
	}

	.row-meta {
		margin-top: 2px;
		font-size: 11.5px;
		color: var(--muted, #6b7280);
	}

	.read-flag {
		font-size: 11px;
		color: #9ca3af;
		flex-shrink: 0;
	}

	.mark-btn {
		flex-shrink: 0;
		border: 1px solid var(--brand, #0f9b8e);
		background: #fff;
		color: var(--brand, #0f9b8e);
		font-size: 11.5px;
		font-weight: 600;
		padding: 4px 8px;
		border-radius: 6px;
		cursor: pointer;
	}

	.mark-btn:hover {
		background: var(--brand, #0f9b8e);
		color: #fff;
	}

	/* the avatar shrinks to 44px on mobile - keep the bell proportional */
	@media (max-width: 860px) {
		.bell {
			width: 24px;
			height: 24px;
		}

		.count {
			min-width: 14px;
			height: 14px;
			font-size: 9px;
			line-height: 14px;
			top: -1px;
			right: -6px;
		}
	}
</style>
