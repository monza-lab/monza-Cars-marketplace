import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const expected = process.env.ADMIN_DASHBOARD_TOKEN;
  if (!expected) {
    // Fail safe: don't expose dashboard if unconfigured
    redirect("/");
  }
  const store = await cookies();
  const got = store.get("admin_token")?.value;
  if (got !== expected) {
    redirect("/admin/social/login");
  }
}
