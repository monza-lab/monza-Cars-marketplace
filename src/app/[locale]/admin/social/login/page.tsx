import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function submit(formData: FormData) {
  "use server";
  const token = formData.get("token")?.toString() ?? "";
  if (token !== process.env.ADMIN_DASHBOARD_TOKEN) {
    redirect("/admin/social/login?error=1");
  }
  const store = await cookies();
  store.set("admin_token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/admin",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin/social");
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0E0E0D", color: "#E8E2DE", fontFamily: "Karla, sans-serif",
    }}>
      <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 16, width: 320 }}>
        <h1 style={{ fontFamily: "Cormorant, serif", fontWeight: 400, fontSize: 32 }}>MonzaHaus Admin</h1>
        <input type="password" name="token" placeholder="Admin token" required
          style={{ padding: "12px 16px", background: "#161114", border: "1px solid #2A2226", color: "#E8E2DE", borderRadius: 6 }} />
        <button type="submit" style={{ padding: "12px 16px", background: "#D6BEDC", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>
          Enter
        </button>
      </form>
    </div>
  );
}
