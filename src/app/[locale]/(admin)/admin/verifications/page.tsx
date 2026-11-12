import { redirect } from "next/navigation";

// New-registration alerts link here (the name the database uses); the queue is Approvals.
export default function Page() {
  redirect("/admin/approvals");
}
