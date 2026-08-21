# Extension rainfall root-cause report

## ROOT CAUSE

### Expected behavior

The extension should obtain precipitation for the period after the last successful
weather evaluation, apply that interval once to the active plant, and persist both
the resulting hydration and the processed weather boundary.

### Actual behavior

The Open-Meteo request obtains an instantaneous `current.precipitation` value and
four date-level `daily.precipitation_sum` values. `fetchRemoteWeatherForLocation`
adds those four daily values into `recentRain`; `getRainfallAmount` then chooses the
larger of that multi-day total and the current value. No hourly precipitation or
timestamped precipitation observations enter the plant state.

### Failure point

The propagation stops between provider response and elapsed-time weather
evaluation: the normalized weather object has no precipitation observations for
the interval being processed. `advancePlantState` can only apply the current
instant or an unbounded, repeatedly changing four-day aggregate; it cannot answer
whether the reported storm occurred after the plant's preceding evaluation.

### Evidence

* The provider request asks for `current.precipitation` and daily totals, but no
  hourly precipitation.
* `recentRain` is the sum of the last four daily array entries.
* `getRainfallAmount` is `max(recentRain, precipitation)`.
* The only weather idempotency marker is the response's client-side `fetchedAt`;
  there is no successfully processed precipitation interval.

### Why the recent storm was missed

If a storm finishes before a worker wake, `current.precipitation` can be zero.
The remaining signal is a date aggregate with no observation timestamps. The
application therefore cannot reliably select the rain that happened between two
checks (or distinguish it from rain before the prior check). A sleeping service
worker makes this deterministic gap visible: no check occurs during the storm and
the next check has no interval observations to replay.

### Contributing findings

* **Primary root cause:** the request and weather contract omit timestamped hourly
  precipitation, so lifecycle evaluation is not based on its elapsed interval.
* **Secondary contributor:** `recentRain` spans four calendar dates and is treated
  as though it were a new observation on every fetch, so rain can also be applied
  repeatedly after it has already been processed.
* **Unrelated issue:** location is user-entered `City, State`, geocoded on every
  request, and is not browser geolocation. There is no geolocation permission,
  coordinate cache, ZIP/IP lookup, or fallback coordinate. A user who moves must
  edit the stored location, but a failed lookup does not silently substitute old
  coordinates.

### Affected files/functions

* `apps/extension/src/background/weatherService.js`:
  `fetchRemoteWeatherForLocation`, `refreshStoredPlant`.
* `apps/extension/src/sharedPlantState.js`: `getRainfallAmount`,
  `advancePlantState`, state normalization/persistence.

### Recommended smallest fix

Keep Open-Meteo and the canonical `advancePlantState` path. Request its hourly
precipitation in UTC, retain timestamped millimeter samples, aggregate only samples
inside `(lastWeatherEvaluationAt, evaluation time]`, and persist the successful
weather boundary on the same revision-checked plant write. Preserve current and
daily fields for display/backward compatibility, but do not use the multi-day
total as the interval hydration input when timestamped samples are available.
