/** @type {import('./$types').PageServerLoad} */
export async function load() {
  // Mocked data – replace with your DB/API.
  return {
    user: { name: 'Afiq', role: 'Human Resources', id: 'E3015' },

    donuts: [
      { title: 'Annual Leave Summary', spent: 1, total: 14 },
      { title: 'Medical Leave Summary', spent: 0, total: 14 },
      { title: 'Hospitalization Leave Summary', spent: 0, total: 60 }
    ],
    recent: {
      range: '02 Jan 2024 – 03 Jan 2024',
      days: 1.0,
      type: 'Annual',
      status: 'Approved'
    }
  };
}
