import { writable } from 'svelte/store';

/**
 * Tiny bus shared by the notification bell and the announcement carousel.
 *
 * `id` is a counter that changes on every request, so the carousel reacts to a
 * request more than once - a plain boolean would only fire for the first one.
 * `startId` is the announcement the carousel should open on (optional).
 */
export const carouselRequest = writable({ id: 0, startId: null });

/**
 * Ask the announcement carousel to open.
 * @param {number|null} startId announcement to open on, null = newest first
 */
export function openCarousel(startId = null) {
	carouselRequest.update((req) => ({ id: req.id + 1, startId }));
}
