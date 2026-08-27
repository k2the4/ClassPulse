import './globals.css'; import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'ClassPulse', description: 'Secure academic insights for college teachers' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
