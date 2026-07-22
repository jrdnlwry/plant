# Lifecycle integrity audit and implementation plan

## Verified audit

The active plant was mutated from three independent contexts: popup startup/manual
refresh, content-overlay refresh, and the background alarm. Popup and overlay also
performed an elapsed-time fallback after a failed weather request. Each path read a
whole record, called `advancePlantState`, and passed a whole replacement record to
`savePlantState`. That save rejected a different `plantId`, but a same-ID stale save
had no revision check and could overwrite every lifecycle field.

The MV3 worker fetched weather and ran its own alarm mutation, while popup/content
messages crossed either the tab boundary (visibility/render requests) or the runtime
boundary (`PLANT_FETCH_WEATHER`). Because a worker may stop between events, no
in-memory lock can survive suspension; correctness therefore also requires a stored
revision check immediately before the single atomic `chrome.storage.local.set`.

`createdAt` is lifecycle birth time, `updatedAt` is the last lifecycle advancement,
`weatherUpdatedAt` is the last application of weather effects, and weather
`fetchedAt` is remote-observation time. A refresh is normally due hourly, while the
alarm runs every 30 minutes. Advancement caps elapsed time at seven days, permits at
most one stage transition per operation, carries overflow into the next stage, and
uses stage 4 / 100% as completion. Flowers can be added once per qualifying weather
operation and removed one at a time below the existing health threshold.

Completion already stores an immutable render snapshot and checks `plantId`; reset
creates a new ID/seed, so late writes from the former lifecycle are rejected. The
reported renderer defect is also present: rounded mutable `growthProgress` was part
of the grammar RNG seed, rerolling topology within a stage.

## Implementation plan

- Modify extension state, worker, popup, overlay, renderer source/generated output,
  and their tests; add this audit note.
- Persist monotonic `revision`, migrating legacy records to revision 0.
- Make the worker own setup, completion, and queued lifecycle updates; popup/content
  only request mutations and render stored snapshots.
- Serialize requests, coalesce equivalent refreshes, reread before revision-checked
  commit, and return controlled weather errors without client fallback mutation.
- Seed grammar topology only with stable identity and stage; retain progress-driven
  rendering parameters, palette, pot, type identity, and composition.
- Test migration, stale same-ID rejection, stable topology, queue ownership, and
  existing completion/stage/flower behavior.

Compatibility risks are legacy revisionless records, stale callers, worker restart,
and generated-renderer drift. Migration defaults revision to zero; atomic storage
writes plus ID/revision checks protect restarts; render-only reads remain available;
and the generated adapter is rebuilt and validated from package source.
