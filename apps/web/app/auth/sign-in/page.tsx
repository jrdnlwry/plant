import { SignInForm } from './sign-in-form';
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next, error } = await searchParams as { next?: string; error?: string };
  return <section className="panel"><p className="eyebrow">Website account</p><h1>Sign in</h1>
    <p>Sign-in is optional: the local Chrome extension continues to work without an account. Accounts will enable opt-in garden participation in a later phase; extension linking is not available yet.</p>
    {error && <p className="feedback error" role="alert">That sign-in link is invalid or expired. Please request a new one.</p>}
    <SignInForm next={next} />
  </section>;
}
