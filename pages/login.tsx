import { useState } from "react";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password, or your email has not been verified yet.");
      return;
    }
    const session = await getSession();
    setLoading(false);
    const role = (session?.user as any)?.role;
    if (role === "ADMIN") router.push("/admin");
    else if (role === "STUDENT") router.push("/student");
    else router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-gray-900">ClassPulse</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Sign in to ClassPulse</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-sm text-gray-600">College email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="student@college.edu" /></div>
          <div><div className="flex items-center justify-between"><label className="text-sm text-gray-600">Password</label><Link href="/forgot-password" className="text-xs text-gray-700 hover:text-gray-900">Forgot password?</Link></div><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" placeholder="••••••••" /></div>
          {router.query.created === "1" && <p className="text-sm text-green-600">Your password has been set. You can now log in.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">New to ClassPulse? <Link href="/signup" className="text-gray-900 font-medium">Sign up</Link></p>
      </div>
    </div>
  );
}
