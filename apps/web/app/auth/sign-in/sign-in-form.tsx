'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { safeRedirect } from '../../../lib/auth/redirect';

export function SignInForm({ next }: { next?: string }) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'sent' | 'error'>('idle');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus('pending');
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setStatus('error'); return; }
    try {
      const supabase = createClient();
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', safeRedirect(next));
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
      setStatus(error ? 'error' : 'sent');
    } catch { setStatus('error'); }
  }
  return <form onSubmit={submit} noValidate>
    <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
    <button disabled={status === 'pending'}>{status === 'pending' ? 'Sending secure link…' : 'Email me a sign-in link'}</button>
    {status === 'sent' && <p className="feedback" role="status">Check your email for a one-time sign-in link.</p>}
    {status === 'error' && <p className="feedback error" role="alert">Enter a valid email, or try again in a moment.</p>}
  </form>;
}
