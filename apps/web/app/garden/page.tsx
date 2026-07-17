export default function GardenPage() {
  return (
    <section className="panel" aria-labelledby="garden-title">
      <p className="eyebrow">Read-only placeholder</p>
      <h1 id="garden-title">Community garden infrastructure is not connected yet.</h1>
      <p>
        Garden participation will be opt-in in a later phase. This route does not read extension
        storage, authenticate users, connect to Supabase, call Stripe, persist garden data, or mutate
        plant lifecycle state.
      </p>
    </section>
  );
}
