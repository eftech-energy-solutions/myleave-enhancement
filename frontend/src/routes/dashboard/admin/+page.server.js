import { error } from '@sveltejs/kit';

/**
 * This 'load' function runs on the server before the page is rendered.
 * It fetches data and passes it to the '+page.svelte' component as the `data` prop.
 *
 * @type {import('./$types').PageServerLoad}
 */
export async function load({ fetch }) {
  try {
    // 1. Fetch live holiday data from our API endpoint.
    // This internally queries your Neon PostgreSQL database.
    const response = await fetch('/api/holidays');

    if (!response.ok) {
      // If the API fails, we can log the error and return an empty array.
      console.error(`API Error: ${response.status} ${response.statusText}`);
      throw error(response.status, 'Failed to load holiday data from the API.');
    }

    const holidays = await response.json();

    // 2. We can also define static data here to keep the Svelte component clean.
    const departmentData = [
      { name: "Director", count: 3, color: "#FFD9CC" },
      { name: "Administrator", count: 12, color: "#FCF9BE" },
      { name: "Operations", count: 18, color: "#C6DEF1" },
      { name: "Operations Support", count: 35, color: "#F2C6DE" },
      { name: "Sales & Technical Excellence", count: 27, color: "#C9E4DE" },
      { name: "Technical Data", count: 22, color: "#DBCDF0" }
    ];

    // 3. Return all the data needed for the page.
    // This object will be available as `export let data` in your Svelte component.
    return {
      holidays, // Live data from the database
      departmentData // Static data for the overview chart
    };

  } catch (err) {
    console.error('Failed to execute the server load function:', err);
    // Return a safe fallback state if there's a critical error.
    return {
      holidays: [],
      departmentData: []
    };
  }
}
