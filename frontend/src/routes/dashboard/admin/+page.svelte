<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from "svelte";
  

  export let data: {
    user: { name: string; role: string; id: string };
    donuts: { title: string; spent: number; total: number }[];
    recent: { range: string; days: number; type: string; status: string };
  };
  

  const dataByDept = [
    { name: "Administrator", count: 12, color: "#7c3aed" },
    { name: "Operations Support", count: 35, color: "#22c55e" },
    { name: "Technical Data", count: 22, color: "#f59e0b" },
    { name: "Operations – RTOC", count: 18, color: "#3b82f6" },
    { name: "Sales & Technical Excellence", count: 27, color: "#ef4444" },
    { name: "Director", count: 3, color: "#14b8a6" }
  ];

  // Reactive total for the big number
  $: total = dataByDept.reduce((a, b) => a + b.count, 0);

  // Canvas element for Chart.js
  let canvasEl;

  onMount(async () => {
    const Chart = (await import("chart.js/auto")).default; // ✅
    if (!canvasEl) return;

    new Chart(canvasEl, {
      type: "bar",
      data: {
        labels: dataByDept.map(d => d.name),
        datasets: [{
          label: "Active Employees",
          data: dataByDept.map(d => d.count),
          backgroundColor: dataByDept.map(d => d.color),
          borderColor: dataByDept.map(d => d.color),
          borderWidth: 1,
          borderRadius: 8
        }]
      },
    options: {
  indexAxis: 'x', // 👈 pastikan bar naik kebawah, label department duduk bawah
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }, // buang legend kalau tak perlu
  },
  scales: {
    x: {
      ticks: {
        autoSkip: false, // semua label keluar
        maxRotation: 45, // pusing sikit kalau panjang
        minRotation: 0,
      }
    },
    y: {
      beginAtZero: true
    }
  }
}

    });
  });

  // Calendar helpers
  // Normalized "today" (only Y-M-D, no time)
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const monthLabel = monthFmt.format(today);


  function buildMonth(d: Date) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // Monday start
    const days: { label: number; muted: boolean; today: boolean; date: Date }[] = [];
    for (let i = 0; i < 42; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      days.push({
        label: cur.getDate(),
        muted: cur.getMonth() !== d.getMonth(),
        today: cur.toDateString() === new Date().toDateString(),
        date: cur   // 👈 keep the full date
      });
    }
    return days;
  }
  const days = buildMonth(today);

  // ===== Leave Modal =====
  let modal: HTMLDialogElement;
  let selectedDate: Date | null = null;

  function openLeaveForm(d: Date) {
    selectedDate = d;
    modal.showModal();
  }

  function submitLeave(e: SubmitEvent) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    console.log("Apply cuti:", {
      date: selectedDate,
      type: form.get("type"),
      reason: form.get("reason")
    });
    modal.close();
  }
  
</script>

  <!-- MAIN CONTENT -->
  <main class="main dash-main">
    <section class="header">
      <div>
        <div class="hello">Welcome back, {data.user.name}!</div>
        <h1>Dashboard</h1>
      </div>

      <div class="profile">
        <div class="badge">🔔</div>
        <div class="avatar">{data.user.name.at(0)}</div>
        <div>
          <div style="font-weight:700">{data.user.name} Mikail</div>
          <div style="font-size:12px; opacity:.95">{data.user.role}</div>
          <div style="font-size:11px; opacity:.85">#{data.user.id}</div>
        </div>
        <a class="download" href="#" title="Download">Download</a>
      </div>
    </section>

    
    <!-- GRID CARDS -->
    <div class="grid" style="grid-template-rows:auto auto; align-items:start">
      {#each data.donuts as d (d.title)}
        <div class="card" style="grid-column: span 4">
          <h3>{d.title}</h3>
          <div class="legend">
            <span><span class="chip" style="background:#0ea5e9"></span>Spent Leave</span>
            <span><span class="chip" style="background:#e5e7eb"></span>Unspent Leave</span>
          </div>
          <div class="donut" style="--spent: {(100*d.spent/d.total).toFixed(6)}"></div>
          <div class="total">Total spent {d.spent}/{d.total}</div>
        </div>
      {/each}

     <div class="card" style="grid-column: span 6">
  <h3>Calendar of Application</h3>
  <div class="calendar">
    <div class="month">{monthLabel}</div>
    <div class="weekdays">
      <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div>
      <div>Fri</div><div>Sat</div><div>Sun</div>
    </div>
    <div class="days">
   {#each days as d}
  <button
    class:muted={d.muted}
    class:today={d.today}
    disabled={d.date < today}
    autofocus={d.date.toDateString() === today.toDateString()}
    on:click={() => openLeaveForm(d.date)}
  >
    {d.label}
  </button>
{/each}

    </div>
  </div>
</div>



      <div class="card" style="grid-column: span 6">
        <!-- ===== Employees by Department (replaces 'Recent Application') ===== -->
<div class="card" style="grid-column: span 6;">
  <h3>Total Active Employees</h3>

  <div class="grid" style="grid-template-columns:510px 1fr; gap:18px; align-items:start;">
  

    <!-- Chart -->
    <div>
      <canvas bind:this={canvasEl} height="489"></canvas>
    </div>
  </div>
</div>


      </div>
    </div>
 <dialog bind:this={modal} class="leave-modal">
  <form method="dialog" class="leave-form" on:submit|preventDefault={submitLeave}>
    <!-- Close button -->
    <button type="button" class="close-btn" on:click={() => modal.close()}>✕</button>

    <h2 class="title">Leave Application</h2>

    <!-- Type -->
    <label>
      <span>Type</span>
      <select name="type" required>
        <option value="Annual">Annual / Emergency</option>
        <option value="Medical">Medical</option>
        <option value="Unpaid">Unpaid</option>
      </select>
      <small>Unpaid leave will be automatically set when no available annual leave balance.</small>
    </label>

    <!-- Duration -->
    <div class="duration">
      <span>Leave Duration</span>
      <label><input type="radio" name="duration" value="Full" checked /> Full Day</label>
      <label><input type="radio" name="duration" value="Half" /> Half Day</label>
    </div>

    <!-- Dates -->
    <div class="dates">
      <label>
        <span>Date from</span>
        <input type="date" name="dateFrom" required />
      </label>
      <label>
        <span>Date until</span>
        <input type="date" name="dateUntil" required />
      </label>
    </div>

    <!-- Total days -->
    <label>
      <span>Total day</span>
      <input type="number" name="totalDays" min="1" required />
    </label>

    <!-- Reason -->
    <label>
      <span>Reason</span>
      <textarea name="reason" rows="3" required></textarea>
    </label>

    <!-- Attachment -->
    <label>
      <span>Attachment</span>
      <input type="file" name="attachment" />
      <small>Optional. Recommended to upload file size less than 2.5MB.</small>
    </label>

    <!-- Submit -->
    <button type="submit" class="submit-btn">SUBMIT</button>
  </form>
</dialog>

  </main>

