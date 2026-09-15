<script>
  import { onMount, onDestroy } from 'svelte';
  import { PUBLIC_VITE_API_BASE } from '$env/static/public';

  let me = null;
  let users = [];
  let search = '';
  let loading = true;
  let error = '';

  let selectedUser = null;
  let selectedConversationId = null;
  let message = '';
  let messages = [];
  let hasMore = false;
  let loadingMessages = false;
  let sending = false;
  let battleUntil = null;

  let listTimer = null;
  let fastTimer = null;

  onMount(async () => {
    await loadMe();
    await loadUsers();
    listTimer = setInterval(loadUsers, 15000);
  });

  onDestroy(() => {
    clearInterval(listTimer);
    clearInterval(fastTimer);
  });

  async function loadMe() {
    try {
      const res = await fetch(`${PUBLIC_VITE_API_BASE}/api/me`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.staff_id) {
        me = data;
      }
    } catch (err) {
      console.error('Load me error:', err);
    }
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(`${PUBLIC_VITE_API_BASE}${url}`, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { res, data };
  }

  async function loadUsers() {
    loading = true;
    error = '';
    try {
      const { res, data } = await apiJson(
        `/api/chat/users?search=${encodeURIComponent(search)}`
      );
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load employees');
      }
      users = data.users || [];
      const selectedId = selectedUser?.staff_id;
      if (selectedId) {
        const stillThere = users.find((u) => u.staff_id === selectedId);
        if (stillThere && stillThere.conversation_id) {
          selectedConversationId = stillThere.conversation_id;
        }
      }
    } catch (err) {
      console.error('Load chat users error:', err);
      error = err.message || 'Failed to load employees';
    } finally {
      loading = false;
    }
  }

  async function selectUser(user) {
    selectedUser = user;
    selectedConversationId = user.conversation_id || null;
    messages = [];
    hasMore = false;
    battleUntil = null;

    clearInterval(fastTimer);
    fastTimer = null;

    if (selectedConversationId) {
      await loadMessages();
      await markRead();
    }

    fastTimer = setInterval(async () => {
      if (!selectedConversationId) return;
      await refreshMessages();
    }, 4000);
  }

  async function loadMessages() {
    if (!selectedConversationId) return;
    loadingMessages = true;
    try {
      const { res, data } = await apiJson(
        `/api/chat/messages/${selectedConversationId}?limit=50`
      );
      if (res.ok) {
        messages = data.messages || [];
        hasMore = data.hasMore || false;
        scrollToBottom();
      }
    } catch (err) {
      console.error('Load messages error:', err);
    } finally {
      loadingMessages = false;
    }
  }

  async function loadEarlier() {
    if (!selectedConversationId || messages.length === 0) return;
    const beforeId = messages[0].id;
    try {
      const { res, data } = await apiJson(
        `/api/chat/messages/${selectedConversationId}?beforeId=${beforeId}&limit=50`
      );
      if (res.ok) {
        messages = [...(data.messages || []), ...messages];
        hasMore = data.hasMore || false;
      }
    } catch (err) {
      console.error('Load earlier messages error:', err);
    }
  }

  async function refreshMessages() {
    if (!selectedConversationId) return;
    try {
      const { res, data } = await apiJson(
        `/api/chat/messages/${selectedConversationId}?limit=50`
      );
      if (res.ok) {
        const pooled = data.messages || [];
        const latestLocal = messages.length ? messages[messages.length - 1].id : 0;
        const newestIncoming = pooled.length ? pooled[pooled.length - 1].id : 0;
        messages = pooled;
        hasMore = data.hasMore || false;
        if (newestIncoming && newestIncoming !== latestLocal) {
          markRead();
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error('Refresh messages error:', err);
    }
  }

  async function markRead() {
    if (!selectedConversationId) return;
    try {
      await apiJson('/api/chat/messages/read', {
        method: 'PATCH',
        body: JSON.stringify({ conversationId: selectedConversationId })
      });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  }

  async function sendMessage() {
    const cleanMessage = message.trim();
    if (!cleanMessage || !selectedUser || sending) return;

    sending = true;
    const draft = cleanMessage;
    const draftMessage = {
      temp: true,
      sender_id: me?.staff_id,
      text: draft,
      read_at: null,
      created_at: new Date().toISOString()
    };

    try {
      const { res, data } = await apiJson('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId: selectedUser.staff_id, text: draft })
      });

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send message');
      }

      if (!selectedConversationId) {
        selectedConversationId = data.conversation_id;
        selectedUser = { ...selectedUser, conversation_id: selectedConversationId };
      }

      const stored = data.message;
      messages = [
        ...messages,
        { id: stored.id, sender_id: stored.sender_id, text: stored.text, read_at: stored.read_at, created_at: stored.created_at }
      ];
      message = '';
      scrollToBottom();
    } catch (err) {
      console.error('Send message error:', err);
      if (err.message) {
        battleUntil = err.message;
        setTimeout(() => (battleUntil = null), 2500);
      }
      messages = [...messages, draftMessage];
      message = '';
    } finally {
      sending = false;
    }
  }

  function handleMessageKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function getInitial(name) {
    return name?.charAt(0)?.toUpperCase() || '?';
  }

  function getPhotoUrl(photoUrl) {
    if (!photoUrl) return '';
    if (photoUrl.startsWith('http')) return photoUrl;
    return `${PUBLIC_VITE_API_BASE}${photoUrl}`;
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatTimeFull(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }) + ' · ' + d.toLocaleDateString([], {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function formatPreview(user) {
    if (!user.last_message || !user.last_sender_id) return '';
    if (user.last_sender_id === me?.staff_id) {
      return `You: ${user.last_message}`;
    }
    return user.last_message;
  }

  function dayLabel(iso) {
    if (!iso) return 'Today';
    const d = new Date(iso);
    const today = new Date();
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function isNewDay(index) {
    if (index === 0) return true;
    const prev = messages[index - 1];
    const curr = messages[index];
    if (!prev || !curr) return false;
    return formatDay(prev.created_at) !== formatDay(curr.created_at);
  }

  function formatDay(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  let messagesArea = null;
  function scrollToBottom() {
    if (messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }
</script>

<div class="chat-container">
  <section class="conversation-panel">
    <div class="conversation-header">
      <div>
        <h2>Messages</h2>
        <p>Chat with colleagues</p>
      </div>
    </div>

    <form
      class="search-box"
      on:submit|preventDefault={loadUsers}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"/>
      </svg>

      <input
        bind:value={search}
        type="text"
        placeholder="Search employee"
      />

      <button type="submit">Search</button>
    </form>

    <div class="employee-list">
      {#if loading}
        <div class="state-message">Loading employees...</div>
      {:else if error}
        <div class="state-message error-message">{error}</div>
      {:else if users.length === 0}
        <div class="state-message">No employees found. You can only chat with your manager, admin, and operation support.</div>
      {:else}
        {#each users as user(user.staff_id)}
          <button
            type="button"
            class="employee-card"
            class:selected={selectedUser?.staff_id === user.staff_id}
            on:click={() => selectUser(user)}
          >
            <div class="avatar">
              {#if user.photourl}
                <img src={getPhotoUrl(user.photourl)} alt={user.full_name} />
              {:else}
                <span>{getInitial(user.full_name)}</span>
              {/if}
            </div>

            <div class="employee-info">
              <div class="employee-top">
                <span class="employee-name">{user.full_name}</span>
                {#if user.unread_count > 0}
                  <span class="unread-badge">{user.unread_count}</span>
                {/if}
              </div>

              <div class="employee-position">
                {user.position || 'Employee'}
                {#if user.role?.toLowerCase() === 'admin'}
                  <span class="role-tag admin">Admin</span>
                {:else if user.role?.toLowerCase() === 'manager'}
                  <span class="role-tag manager">Manager</span>
                {:else if user.department?.toLowerCase().includes('operation support')}
                  <span class="role-tag ops">Op Support</span>
                {/if}
              </div>

              <div class="employee-preview">
                {#if user.last_message_at}
                  <span class="preview-text">{formatPreview(user)}</span>
                  <span class="preview-time">{formatTime(user.last_message_at)}</span>
                {:else}
                  <span class="preview-department">{user.department || user.staff_id}</span>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </section>

  <section class="chat-panel">
    {#if selectedUser}
      <div class="chat-header">
        <div class="chat-user">
          <div class="avatar header-avatar">
            {#if selectedUser.photourl}
              <img src={getPhotoUrl(selectedUser.photourl)} alt={selectedUser.full_name} />
            {:else}
              <span>{getInitial(selectedUser.full_name)}</span>
            {/if}
          </div>

          <div>
            <h3>{selectedUser.full_name}</h3>
            <p>
              {selectedUser.position || 'Employee'}
              {#if selectedUser.department}
                · {selectedUser.department}
              {/if}
            </p>
          </div>
        </div>
      </div>

      <div class="messages-area" bind:this={messagesArea}>
        {#if loadingMessages}
          <div class="state-message">Loading messages...</div>
        {:else if messages.length === 0}
          <div class="state-message">No messages yet. Say hello!</div>
        {:else}
          {#if hasMore}
            <button
              type="button"
              class="load-earlier"
              on:click={loadEarlier}
            >
              Load earlier messages
            </button>
          {/if}

          {#each messages as item, index (item.id)}
            {#if isNewDay(index)}
              <div class="conversation-date">{dayLabel(item.created_at)}</div>
            {/if}
            <div
              class="message-row"
              class:mine={item.sender_id === me?.staff_id}
            >
              <div class="message-bubble">
                <p>{item.text}</p>
                <span class="message-meta">
                  {item.sender_id === me?.staff_id ? 'You' : ''}
                  {#if item.sender_id === me?.staff_id}
                    {#if item.read_at}
                      <span class="tick read" title={formatTimeFull(item.read_at)}>✓✓</span>
                    {:else}
                      <span class="tick" title="Delivered">✓</span>
                    {/if}
                  {/if}
                  <span>{formatTime(item.created_at)}</span>
                </span>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      {#if battleUntil}
        <div class="send-error">{battleUntil}</div>
      {/if}

      <form class="message-form" on:submit|preventDefault={sendMessage}>
        <textarea
          bind:value={message}
          on:keydown={handleMessageKeydown}
          placeholder="Type a message..."
          rows="1"
          maxlength="2000"
        ></textarea>

        <button
          type="submit"
          disabled={!message.trim() || sending}
          title="Send message"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M2 21 23 12 2 3v7l15 2-15 2v7z"/>
          </svg>
        </button>
      </form>

    {:else}
      <div class="empty-chat">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H8l-4 4V6c0-1.1.9-2 2-2zm2 2v11.17L7.17 16H20V6H6zm2 3h8v2H8V9zm0 4h6v2H8v-2z"/>
          </svg>
        </div>

        <h2>Your messages</h2>
        <p>Select a colleague from the left to start chatting.</p>
      </div>
    {/if}
  </section>
</div>

<style>
.chat-container {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #ffffff;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
}

.conversation-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  overflow: hidden;
}

  .conversation-header {
    padding: 22px 20px 12px;
  }

  .conversation-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 24px;
  }

  .conversation-header p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 13px;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 16px 16px;
  }

  .search-box svg {
    position: absolute;
    left: 13px;
    width: 19px;
    height: 19px;
    fill: #94a3b8;
    pointer-events: none;
  }

  .search-box input {
    flex: 1;
    min-width: 0;
    height: 42px;
    padding: 0 12px 0 40px;
    border: 1px solid #dbe2ea;
    border-radius: 12px;
    outline: none;
    background: #f8fafc;
    color: #0f172a;
  }

  .search-box input:focus {
    border-color: #2bb7b3;
    box-shadow: 0 0 0 3px rgba(43, 183, 179, 0.14);
  }

  .search-box button {
    height: 42px;
    padding: 0 13px;
    border: none;
    border-radius: 11px;
    background: #2bb7b3;
    color: #ffffff;
    font-weight: 700;
    cursor: pointer;
  }

.employee-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 10px 14px;
}

  .employee-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: none;
    border-radius: 13px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .employee-card:hover {
    background: #f1f8f8;
  }

  .employee-card.selected {
    background: #e5f7f6;
  }

  .avatar {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 50%;
    background: linear-gradient(135deg, #0F9B8E, #0c8295);
    color: white;
    font-weight: 800;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .employee-info {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .employee-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .employee-name {
    overflow: hidden;
    color: #0f172a;
    font-size: 14px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .unread-badge {
    flex-shrink: 0;
    min-width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    padding: 0 6px;
    border-radius: 999px;
    background: #2bb7b3;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
  }

  .employee-position {
    overflow: hidden;
    color: #475569;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-tag {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    vertical-align: 1px;
  }

  .role-tag.admin { background: #e0e7ff; color: #3730a3; }
  .role-tag.manager { background: #dbeafe; color: #1e40af; }
  .role-tag.ops { background: #fef3c7; color: #92400e; }

  .employee-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .preview-text {
    overflow: hidden;
    flex: 1;
    color: #94a3b8;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-time {
    flex-shrink: 0;
    color: #cbd5e1;
    font-size: 10px;
  }

  .preview-department {
    overflow: hidden;
    color: #94a3b8;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .state-message {
    padding: 30px 18px;
    color: #64748b;
    font-size: 13px;
    text-align: center;
  }

  .error-message {
    color: #b91c1c;
  }

.chat-panel {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

  .chat-header {
    display: flex;
    align-items: center;
    min-height: 77px;
    padding: 12px 22px;
    border-bottom: 1px solid #e5e7eb;
    background: rgba(255, 255, 255, 0.94);
  }

  .chat-user {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-avatar {
    width: 48px;
    height: 48px;
  }

  .chat-user h3 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
  }

  .chat-user p {
    margin: 3px 0 0;
    color: #64748b;
    font-size: 12px;
  }

.messages-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
}

  .load-earlier {
    display: block;
    margin: 0 auto 16px;
    padding: 7px 14px;
    border: 1px solid #dbe2ea;
    border-radius: 999px;
    background: #ffffff;
    color: #2bb7b3;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .load-earlier:hover {
    background: #f1f8f8;
  }

  .conversation-date {
    width: max-content;
    margin: 0 auto 20px;
    padding: 5px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.86);
    color: #64748b;
    font-size: 11px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  }

  .message-row {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 12px;
  }

  .message-row.mine {
    justify-content: flex-end;
  }

  .message-bubble {
    max-width: min(70%, 540px);
    padding: 10px 13px 7px;
    border-radius: 15px 15px 15px 4px;
    background: #ffffff;
    color: #1e293b;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.08);
  }

  .message-row.mine .message-bubble {
    border-radius: 15px 15px 4px 15px;
    background: #dff6f3;
  }

  .message-bubble p {
    margin: 0;
    overflow-wrap: anywhere;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .message-meta {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    color: #94a3b8;
    font-size: 10px;
  }

  .tick {
    font-weight: 800;
  }

  .tick.read {
    color: #2bb7b3;
  }

  .send-error {
    position: absolute;
    left: 50%;
    bottom: 96px;
    transform: translateX(-50%);
    padding: 8px 14px;
    border-radius: 10px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
    z-index: 5;
  }

  .message-form {
    flex-shrink: 0;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 14px 18px;
    border-top: 1px solid #e5e7eb;
    background: #ffffff;
  }

  .message-form textarea {
    flex: 1;
    min-height: 44px;
    max-height: 130px;
    resize: vertical;
    padding: 11px 14px;
    border: 1px solid #dbe2ea;
    border-radius: 13px;
    outline: none;
    color: #0f172a;
    font: inherit;
  }

  .message-form textarea:focus {
    border-color: #2bb7b3;
    box-shadow: 0 0 0 3px rgba(43, 183, 179, 0.14);
  }

  .message-form button {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: none;
    border-radius: 50%;
    background: #2bb7b3;
    cursor: pointer;
  }

  .message-form button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .message-form button svg {
    width: 20px;
    height: 20px;
    fill: #ffffff;
  }

  .empty-chat {
    flex: 1;
    display: grid;
    place-content: center;
    justify-items: center;
    padding: 30px;
    text-align: center;
  }

  .empty-icon {
    width: 86px;
    height: 86px;
    display: grid;
    place-items: center;
    margin-bottom: 18px;
    border-radius: 50%;
    background: rgba(43, 183, 179, 0.13);
  }

  .empty-icon svg {
    width: 42px;
    height: 42px;
    fill: #249e9b;
  }

  .empty-chat h2 {
    margin: 0 0 7px;
    color: #0f172a;
    font-size: 22px;
  }

  .empty-chat p {
    margin: 0;
    color: #64748b;
  }

  @media (max-width: 850px) {
    .chat-container {
      grid-template-columns: 290px minmax(0, 1fr);
    }
  }

  @media (max-width: 680px) {
    .chat-container {
      grid-template-columns: 1fr;
      height: auto;
      min-height: 650px;
    }

    .conversation-panel {
      max-height: 360px;
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
    }

    .chat-panel {
      min-height: 500px;
    }
  }
</style>