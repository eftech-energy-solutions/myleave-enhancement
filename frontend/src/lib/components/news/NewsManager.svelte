<script>
	import { onMount } from 'svelte';
	import { PUBLIC_VITE_API_BASE } from '$env/static/public';

	const API = `${PUBLIC_VITE_API_BASE}`;

	let items = [];
	let loading = true;
	let saving = false;
	let formOpen = false;
	let formMode = 'create';
	let editingId = null;
	let selectedFile = null;
	let previewUrl = null;
	let removeImage = false;
	let editingImagePath = null;

	let form = { title: '', body: '' };

	let toast = { show: false, type: 'success', title: '', message: '', closing: false };

	function showToast(message, type = 'success', title = '', duration = 3000) {
		toast = {
			show: true,
			type,
			title: title || type.charAt(0).toUpperCase() + type.slice(1),
			message,
			closing: false
		};

		setTimeout(() => {
			toast.closing = true;
			setTimeout(() => {
				toast.show = false;
				toast.closing = false;
			}, 300);
		}, duration);
	}

	// ------------------------------------------------------------------
	// DATA
	// ------------------------------------------------------------------
	async function loadNews() {
		loading = true;
		try {
			const res = await fetch(`${API}/api/news?limit=100`, { credentials: 'include' });
			if (!res.ok) throw new Error('failed');
			const data = await res.json();
			items = data.items || [];
		} catch {
			showToast('Failed to load bulletins.', 'error', 'Error');
		} finally {
			loading = false;
		}
	}

	// ------------------------------------------------------------------
	// FORM
	// ------------------------------------------------------------------
	function resetForm() {
		form = { title: '', body: '' };
		selectedFile = null;
		removeImage = false;
		editingImagePath = null;
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	function openCreate() {
		resetForm();
		formMode = 'create';
		editingId = null;
		formOpen = true;
	}

	function openEdit(item) {
		resetForm();
		formMode = 'edit';
		editingId = item.id;
		editingImagePath = item.image_path || null;
		form = { title: item.title, body: item.body };
		formOpen = true;
	}

	function closeForm() {
		formOpen = false;
		resetForm();
	}

	function handleFile(e) {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.type !== 'image/png') {
			showToast('Only PNG images are allowed.', 'warning', 'Invalid file');
			e.target.value = '';
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			showToast('Image must be 5MB or smaller.', 'warning', 'File too large');
			e.target.value = '';
			return;
		}

		if (previewUrl) URL.revokeObjectURL(previewUrl);
		selectedFile = file;
		previewUrl = URL.createObjectURL(file);
		removeImage = false;
	}

	function clearImage() {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
		selectedFile = null;
		removeImage = true;
	}

	async function submit() {
		if (!form.title.trim() || !form.body.trim()) {
			showToast('Title and news text are required.', 'warning', 'Missing details');
			return;
		}

		saving = true;
		try {
			const fd = new FormData();
			fd.append('title', form.title.trim());
			fd.append('body', form.body.trim());
			if (selectedFile) fd.append('image', selectedFile);
			if (removeImage) fd.append('removeImage', 'true');

			const url = formMode === 'create' ? `${API}/api/news` : `${API}/api/news/${editingId}`;
			const res = await fetch(url, {
				method: formMode === 'create' ? 'POST' : 'PUT',
				credentials: 'include',
				body: fd
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				showToast(data.error || 'Failed to save bulletin.', 'error', 'Error');
				return;
			}

			showToast(
				formMode === 'create' ? 'Bulletin published to all staff.' : 'Bulletin updated.',
				'success',
				'Success'
			);
			closeForm();
			await loadNews();
			window.dispatchEvent(new CustomEvent('news-updated'));
		} catch {
			showToast('Failed to save bulletin.', 'error', 'Error');
		} finally {
			saving = false;
		}
	}

	async function remove(item) {
		const ok = confirm(`Delete bulletin "${item.title}"? This cannot be undone.`);
		if (!ok) return;

		try {
			const res = await fetch(`${API}/api/news/${item.id}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				showToast(data.error || 'Failed to delete bulletin.', 'error', 'Error');
				return;
			}
			showToast('Bulletin deleted.', 'success', 'Success');
			await loadNews();
			window.dispatchEvent(new CustomEvent('news-updated'));
		} catch {
			showToast('Failed to delete bulletin.', 'error', 'Error');
		}
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

	onMount(loadNews);
</script>

<div class="page">
	<div class="page-head">
		<div class="head-text">
			<h2>Bulletin</h2>
			<p class="sub">Publish announcements that every staff member sees in their notifications.</p>
		</div>
		<button type="button" class="primary-btn" on:click={openCreate}>+ Add News</button>
	</div>

	{#if loading}
		<p class="state">Loading bulletins…</p>
	{:else if items.length === 0}
		<div class="empty">
			<div class="empty-ico">
				<svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true">
					<path
						d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9h-2v2h-2v-2h-2v-2h2V7h2v2h2v2z"
					/>
				</svg>
			</div>
			<p class="empty-title">No bulletins yet</p>
			<p class="empty-sub">Post your first announcement to reach everyone in the company.</p>
		</div>
	{:else}
		<div class="grid">
			{#each items as item (item.id)}
				<div class="card">
					<div class="card-media">
						{#if item.image_path}
							<img src={`${API}${item.image_path}`} alt={item.title} />
						{:else}
							<div class="media-ph">
								<svg
									viewBox="0 0 24 24"
									width="32"
									height="32"
									fill="currentColor"
									aria-hidden="true"
								>
									<path
										d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9h-2v2h-2v-2h-2v-2h2V7h2v2h2v2z"
									/>
								</svg>
							</div>
						{/if}
					</div>

					<div class="card-body">
						<h3 class="card-title">{item.title}</h3>
						<p class="card-excerpt">{item.body}</p>
						<div class="card-meta">
							<span>{formatDate(item.created_at)}</span>
							{#if item.created_by_name}
								<span class="dot">•</span>
								<span>{item.created_by_name}</span>
							{/if}
							<span class="dot">•</span>
							<span>{item.read_count || 0} read{item.read_count === 1 ? '' : 's'}</span>
						</div>
					</div>

					<div class="card-actions">
						<button type="button" class="ghost-btn" on:click={() => openEdit(item)}>Edit</button>
						<button type="button" class="danger-btn" on:click={() => remove(item)}>Delete</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if formOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="modal-overlay" on:click={closeForm}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div class="modal-card" on:click|stopPropagation>
			<div class="modal-head">
				<h3>{formMode === 'create' ? 'Add News' : 'Edit News'}</h3>
				<button type="button" class="x-btn" on:click={closeForm} aria-label="Close">✕</button>
			</div>

			<div class="modal-bd">
				<label class="field">
					<span class="field-label">Title <em>*</em></span>
					<input
						type="text"
						bind:value={form.title}
						placeholder="e.g. Company Town Hall on 12 Jan"
					/>
				</label>

				<label class="field">
					<span class="field-label">News <em>*</em></span>
					<textarea rows="6" bind:value={form.body} placeholder="Write the announcement…"
					></textarea>
				</label>

				<div class="field">
					<span class="field-label">PNG image <small>(optional, max 5MB)</small></span>
					<input type="file" accept="image/png" on:change={handleFile} />
				</div>

				{#if previewUrl}
					<div class="preview">
						<img src={previewUrl} alt="preview" />
						<button type="button" class="ghost-btn" on:click={clearImage}>Remove image</button>
					</div>
				{:else if formMode === 'edit' && editingImagePath && !removeImage}
					<div class="preview">
						<img src={`${API}${editingImagePath}`} alt="current" />
						<button type="button" class="ghost-btn" on:click={clearImage}>Remove image</button>
					</div>
				{/if}
			</div>

			<div class="modal-ft">
				<button type="button" class="ghost-btn" on:click={closeForm}>Cancel</button>
				<button type="button" class="primary-btn" on:click={submit} disabled={saving}>
					{saving ? 'Saving…' : formMode === 'create' ? 'Publish' : 'Save changes'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if toast.show}
	<div class="toast-wrap">
		<div
			class="toast"
			class:closing={toast.closing}
			class:error={toast.type === 'error'}
			class:warning={toast.type === 'warning'}
		>
			<div class="toast-title">{toast.title}</div>
			<div class="toast-msg">{toast.message}</div>
		</div>
	</div>
{/if}

<style>
	.page {
		padding: 1.5rem;
		max-width: 1500px;
		margin: auto;
	}

	.page-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}

	.head-text h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		color: var(--ink, #1f2937);
	}

	.sub {
		margin: 4px 0 0;
		font-size: 13.5px;
		color: var(--muted, #6b7280);
	}

	.primary-btn {
		border: none;
		background: var(--brand, #0f9b8e);
		color: #fff;
		font-size: 13.5px;
		font-weight: 600;
		padding: 10px 18px;
		border-radius: 9px;
		cursor: pointer;
		white-space: nowrap;
	}

	.primary-btn:hover:not(:disabled) {
		background: var(--brand-dark, #0c8075);
	}

	.primary-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.state {
		text-align: center;
		color: var(--muted, #6b7280);
		font-size: 13.5px;
		padding: 40px 0;
	}

	.empty {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		padding: 48px 20px;
		text-align: center;
	}

	.empty-ico {
		color: #cbd5e1;
	}

	.empty-title {
		margin: 12px 0 4px;
		font-size: 16px;
		font-weight: 700;
		color: var(--ink, #1f2937);
	}

	.empty-sub {
		margin: 0 0 18px;
		font-size: 13.5px;
		color: var(--muted, #6b7280);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 14px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.card-media {
		height: 170px;
		background: #f3f4f6;
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.card-media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.media-ph {
		color: #cbd5e1;
	}

	.card-body {
		padding: 14px 16px 10px;
		flex: 1;
		min-width: 0;
	}

	.card-title {
		margin: 0 0 6px;
		font-size: 15px;
		font-weight: 700;
		color: var(--ink, #1f2937);
		line-height: 1.35;
	}

	.card-excerpt {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: #4b5563;
		white-space: pre-wrap;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-meta {
		margin-top: 10px;
		font-size: 11.5px;
		color: var(--muted, #6b7280);
		display: flex;
		align-items: center;
		gap: 5px;
		flex-wrap: wrap;
	}

	.dot {
		color: #d1d5db;
	}

	.card-actions {
		display: flex;
		gap: 8px;
		padding: 12px 16px;
		border-top: 1px solid #f1f5f9;
	}

	.ghost-btn {
		border: 1px solid #d1d5db;
		background: #fff;
		color: var(--ink, #1f2937);
		font-size: 12.5px;
		font-weight: 600;
		padding: 7px 14px;
		border-radius: 8px;
		cursor: pointer;
	}

	.ghost-btn:hover {
		border-color: var(--brand, #0f9b8e);
		color: var(--brand, #0f9b8e);
	}

	.danger-btn {
		border: 1px solid #fecaca;
		background: #fff;
		color: var(--danger, #dc2626);
		font-size: 12.5px;
		font-weight: 600;
		padding: 7px 14px;
		border-radius: 8px;
		cursor: pointer;
	}

	.danger-btn:hover {
		background: #fef2f2;
	}

	/* ===== MODAL ===== */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.5);
		display: grid;
		place-items: center;
		padding: 20px;
		z-index: 200;
	}

	.modal-card {
		width: min(620px, 100%);
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		background: #fff;
		border-radius: 14px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 15px 18px;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-head h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
	}

	.x-btn {
		border: none;
		background: transparent;
		color: var(--muted, #6b7280);
		font-size: 15px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 8px;
		line-height: 1;
	}

	.x-btn:hover {
		background: #f3f4f6;
	}

	.modal-bd {
		padding: 18px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--ink, #1f2937);
	}

	.field-label em {
		color: var(--danger, #dc2626);
		font-style: normal;
	}

	.field-label small {
		font-weight: 400;
		color: var(--muted, #6b7280);
	}

	.field input[type='text'],
	.field textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #d1d5db;
		border-radius: 9px;
		padding: 9px 11px;
		font-size: 13.5px;
		font-family: inherit;
		color: var(--ink, #1f2937);
		background: #fff;
		resize: vertical;
	}

	.field input[type='text']:focus,
	.field textarea:focus {
		outline: none;
		border-color: var(--brand, #0f9b8e);
		box-shadow: 0 0 0 3px rgba(15, 155, 142, 0.15);
	}

	.field input[type='file'] {
		font-size: 13px;
		color: var(--muted, #6b7280);
	}

	.preview {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px;
		border: 1px dashed #d1d5db;
		border-radius: 10px;
		background: #f9fafb;
	}

	.preview img {
		width: 88px;
		height: 64px;
		object-fit: cover;
		border-radius: 8px;
		background: #e5e7eb;
	}

	.modal-ft {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 15px 18px;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	/* ===== TOAST ===== */
	.toast-wrap {
		position: fixed;
		top: 18px;
		right: 18px;
		z-index: 300;
	}

	.toast {
		min-width: 240px;
		max-width: 340px;
		background: #fff;
		border-left: 4px solid var(--success, #16a34a);
		border-radius: 10px;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
		padding: 12px 15px;
		animation: toast-in 0.22s ease;
	}

	.toast.error {
		border-left-color: var(--danger, #dc2626);
	}

	.toast.warning {
		border-left-color: #d97706;
	}

	.toast.closing {
		animation: toast-out 0.3s ease forwards;
	}

	.toast-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink, #1f2937);
	}

	.toast-msg {
		margin-top: 3px;
		font-size: 12.5px;
		color: var(--muted, #6b7280);
		line-height: 1.45;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(18px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes toast-out {
		to {
			opacity: 0;
			transform: translateX(18px);
		}
	}
</style>
