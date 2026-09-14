import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getSupabaseBrowser } from "../../lib/supabaseBrowser";

export default function FinishSignupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setReady(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setReady(!!session);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      await router.replace("/login?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not set your password.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900">Finish your signup</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Set the password you&apos;ll use to log in to ClassPulse.</p>
        {!ready ? <p className="text-sm text-red-600">This invitation is missing, expired, or has already been used.</p> : <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm text-gray-600">Password<input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm text-gray-600">Confirm password<input required minLength={6} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" /></label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">{busy ? "Saving..." : "Set password"}</button>
        </form>}
      </div>
    </div>
  );
}
