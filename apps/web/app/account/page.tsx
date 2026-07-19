import { getCurrentAccountProfile, requireAuthenticatedUser } from '../../lib/auth/server';
import { SUPPORTED_STATE_CODES } from '../../lib/auth/profile';
import { signOut, updateProfile } from './actions';
export const dynamic = 'force-dynamic';
export default async function AccountPage() {
  await requireAuthenticatedUser();
  const profile = await getCurrentAccountProfile();
  return <section className="panel"><p className="eyebrow">Private account</p><h1>Your account</h1>
    <p>Edit the limited profile information used for your future public contributor display. Extension linking and garden publication are not yet available.</p>
    <form action={updateProfile}>
      <label>First name<input name="firstName" maxLength={50} defaultValue={profile.first_name ?? ''} /></label>
      <label>State<select name="stateCode" defaultValue={profile.state_code ?? ''}><option value="">Not selected</option>{SUPPORTED_STATE_CODES.map((state) => <option key={state}>{state}</option>)}</select></label>
      <button>Save profile</button>
    </form>
    <form action={signOut}><button>Sign out</button></form>
  </section>;
}
