/**
 * Table columns for admin lists on a wide screen, shared by the rows (client components) and
 * their TableHead (rendered on the server). Kept out of the "use client" files: a server page
 * importing a plain value from one gets a client reference, not the string.
 */

/** Dukan or distributor: name, area, status, products, orders, sales, joined, chevron. */
export const entityColumns =
  "lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_8rem_4.5rem_6.5rem_7rem_6.5rem_1.25rem]";
