import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const supabase = getSupabaseBrowser();
      const redirectTo = `${window.location.origin}/auth/update-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("If an account exists for this email, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send the reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900">Reset password</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Enter your college email and we&apos;ll send you a reset link.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm text-gray-600">College email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" placeholder="you@college.edu" /></label>
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">{busy ? "Sending..." : "Send reset link"}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6"><Link href="/login" className="text-gray-900 font-medium">Back to login</Link></p>
      </div>
    </div>
  );
}
