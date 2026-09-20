import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";
import { adminLogin } from "@/lib/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await adminLogin({ email, password });
      localStorage.setItem("auben_admin_token", access_token);
      navigate("/admin");
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const field = "w-full rounded-xl border border-[#E2DDD5] bg-white px-4 py-3 text-[#2C332E] focus:outline-none focus:ring-2 focus:ring-[#87A987]";

  return (
    <>
      <Seo title="Administration — La Maison d'Auben" description="Espace d'administration" path="/admin/login" />
      <div className="flex min-h-screen items-center justify-center bg-[#F2EDE4] px-4">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center"><Logo /></div>
          <form onSubmit={submit} className="card-soft space-y-4 p-8" data-testid="admin-login-form">
            <div className="flex items-center gap-2 text-[#1E3A2B]">
              <Lock className="h-5 w-5" /> <h1 className="font-serif text-2xl font-semibold">Administration</h1>
            </div>
            {error && <div className="rounded-lg bg-[#F8E4DE] px-4 py-2.5 text-sm text-[#B4472E]" data-testid="admin-login-error">{error}</div>}
            <input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={field} data-testid="admin-email-input" />
            <input type="password" required placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className={field} data-testid="admin-password-input" />
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#1E3A2B] px-6 py-3.5 font-medium text-[#FAF8F5] hover:bg-[#3B6B4C] disabled:opacity-70" data-testid="admin-login-submit">
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
