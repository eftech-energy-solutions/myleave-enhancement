// src/routes/dashboard/admin/main/+page.server.js
export const load = async ({ locals }) => {
  const user = locals.user ?? { name: "admin", role: "admin", id: "U001" };

  // Data donut – pastikan total ada (boleh 0 kalau guard kat UI dah ada)
  const donuts = [
    { title: "Annual Leave Summary",          spent: 1, total: 14 },
    { title: "Medical Leave Summary",         spent: 0, total: 14 },
    { title: "Hospitalization Leave Summary", spent: 0, total: 60 },
  ];

  return { user, donuts };
};
