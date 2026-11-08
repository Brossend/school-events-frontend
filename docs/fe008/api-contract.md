# FE-008 actual export contract

Read from ScenarioExportController, ScenarioExportService, IdempotencyService and OpenAPI without backend edits. Actual HTTP responses are in `evidence/http-exports.json`.

POST `/scenarios/{id}/revisions/{version}/exports` accepts exactly `{ "format": "pdf|docx|pptx|print_pack_pdf" }` and an Idempotency-Key UUID. OpenAPI declares 202 without its JSON schema. Testing executes the existing synchronous branch, returning `{data:{id,status:"ready",download_url,file_name,file_size_bytes}}`. The production branch queues ExecuteExportJob and returns `{data:{id,status:"queued"}}`. The frontend provides a local typed response override; generated OpenAPI remains unchanged.

GET `/export-jobs/{id}` returns `{data:{id,status,download_url,file_name,file_size_bytes,error_message,created_at,completed_at}}`. It does not return format, revision_id or is_downloadable. Membership is checked through revision history before accepting this response.

GET revision exports returns `{data:[{id,revision_id,format,status,provenance_fingerprint,is_downloadable,download_url,created_at,completed_at,artifact:null|{id,file_name,file_size_bytes,mime_type,sha256_hash,expires_at}}]}`. The runtime parser validates revision, enum, UUIDs, artifact sizes and SHA256. Current history availability controls buttons. The frontend does not independently certify provenance freshness; POST and GET download are authoritative gates.

GET `/export-jobs/{id}/download` returns protected binary content with actual format MIME, Content-Disposition, Content-Length and X-Checksum-Sha256. CORS currently exposes only X-Trace-Id and X-School-Id. Browsers therefore use deterministic safe filenames when Content-Disposition is hidden and validate SHA256 from history metadata. No backend CORS change is required. The frontend constructs the download endpoint from a validated job UUID and never follows the supplied download_url.

Idempotency is scoped by authenticated user, endpoint and payload hash for 24 hours. A minimal receipt binds user/school/scenario/revision/version/format to key, timestamp, phase and known job UUID. Unknown POST outcomes do not trigger automatic POST or automatic replacement keys. Reopening first reads history; explicit recovery replays the same key within a conservative 23-hour window. History lacks the key, so an unknown job is never guessed from timestamps. A new key requires an explicit action after a known terminal job. The server rechecks provenance before replay and may deny it after source changes.

HTTP gates include 401 unauthenticated, 403 tenant/author/provenance/signoff/moderation, 404 missing job/artifact, 409 historical revision/not-ready, 410 expiration, and 500 integrity/storage failure. Network failure is separate from the server's failed state. The shared client retains its existing single 419 CSRF refresh and retries the same request/key.
