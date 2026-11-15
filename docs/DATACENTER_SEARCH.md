# Datacenter and document search

## Scope and boundaries

The application API remains the identity, authorization, and metadata authority. Binary files live on the separate document-storage service. In production, `DATACENTER_PUBLIC_URL` points to the storage host/reverse proxy and the API issues a 120-second HMAC-signed, read-only URL; downloads then bypass the API process and stream directly from storage. When this setting is empty (local development), the API proxy endpoint is used. `DATACENTER_SIGNING_SECRET` must be shared by the API and storage service and must be a unique secret. OpenSearch stores searchable text and metadata only; Redis caches short-lived search result pages and is never a source of truth. Neither service is authoritative for permissions or original files. PostgreSQL stores document metadata, ownership, visibility, and durable indexing jobs.

The document pipeline is asynchronous:

1. An authenticated administrator uploads a supported PDF, image, TXT, or Markdown file.
2. The API checks MIME type, extension, size, and file signature; calculates SHA-256; rejects duplicate content; and streams the file to the separate storage service.
3. PostgreSQL stores metadata and a durable `DocumentIndexJob` in the same application workflow.
4. The indexing worker downloads the source file from storage, extracts PDF text with `pdftotext`, applies OCR to scanned PDFs with `ocrmypdf` when necessary, and uses Tesseract for image files.
5. Persian text is normalized and indexed in OpenSearch. The original file remains in storage.
6. Search results are pre-filtered by visibility/owner/job role in OpenSearch for efficiency and checked again against PostgreSQL access rules before being returned. PDF text is split into bounded overlapping chunks with page numbers so a result can point to its source page.

## Endpoints

- `POST /api/v1/documents` — admin upload; multipart field `file`, plus `title`, optional `description`, `visibility`, `accessJobRoles`, and `language`.
- `GET /api/v1/documents?limit=20&cursor=...` — list documents visible to the current user.
- `GET /api/v1/documents/:id` — metadata.
- `GET /api/v1/documents/:id/open-link` — create a 120-second signed link for browser/system PDF viewing.
- `GET /api/v1/documents/:id/content` — stream original content; supports HTTP Range and the short-lived signed link.
- `DELETE /api/v1/documents/:id` — admin soft-delete metadata and remove the indexed copy; the original is retained for recovery.
- `POST /api/v1/documents/:id/restore` — admin restore and enqueue re-indexing.
- `POST /api/v1/documents/:id/reindex` — admin retry/rebuild the search index for an active document.
- `GET /api/v1/documents/:id/index-status` — admin-only indexing status and latest worker error.
- `GET /api/v1/search?q=...&limit=20&cursor=...` — full-text search with cursor pagination and optional type/language/date filters.
- `POST /api/v1/sync/push` — idempotent offline operation batches (notebook and forms in this phase).
- `GET /api/v1/sync/pull?cursor=...` — incremental changes and deletion tombstones.
- `GET /api/v1/sync/status` — recent accepted operations and conflicts.
- `POST /api/v1/ocr` — enqueue OCR for an image/PDF.
- `GET /api/v1/ocr/:id` — owner-scoped OCR status and extracted text.
- `POST /api/v1/ocr/:id/retry` — retry a failed OCR job.
- `DELETE /api/v1/ocr/:id` — cancel an OCR job.

## Visibility rules

- `PUBLIC`: guests and authenticated users.
- `ROLE_RESTRICTED`: authenticated users whose selected job role appears in `accessJobRoles`.
- `PRIVATE`: the owner and administrators.

The search engine is never trusted to authorize access. Search hit IDs are rechecked in PostgreSQL for every request. Job errors and extraction text are not exposed to ordinary users.

## Local development

1. Create `backend/.env` from `backend/.env.example` and set `DATABASE_URL`, `JWT_ACCESS_SECRET`, `ENCRYPTION_KEY`, a random `DATACENTER_INTERNAL_TOKEN`, and a separate random `DATACENTER_SIGNING_SECRET` (both at least 32 characters). Keep `DATACENTER_PUBLIC_URL` empty for local proxy mode.
2. Run `docker compose --env-file backend/.env -f docker-compose.datacenter.yml up -d opensearch redis document-storage`.
3. Run the API from `backend/` with `DATACENTER_URL=http://127.0.0.1:8081` and `OPENSEARCH_URL=http://127.0.0.1:9200`.
4. Install `poppler-utils`, `ocrmypdf`, `tesseract-ocr`, `tesseract-ocr-fas`, `tesseract-ocr-eng`, and optionally `tesseract-ocr-kmr` for Kurmanji Latin text on the worker host.
5. Run `npm run worker:all` from `backend/` using the same database and storage/search settings.

Alternatively, start the isolated indexing and OCR containers with `docker compose --env-file backend/.env -f docker-compose.datacenter.yml up -d document-index-worker ocr-worker`; each `DATABASE_URL` must be reachable from its container. OCR has a higher CPU/RAM limit than text indexing. For a host PostgreSQL instance, set `WORKER_DATABASE_URL` to a connection string reachable from the worker container (on Linux use `host.docker.internal`; the compose file adds the host-gateway mapping). The API process continues using `DATABASE_URL` from the host environment.

## Production requirements

The compose file intentionally disables the OpenSearch security plugin and binds service ports to loopback; it is for local development or a protected single-host staging environment only. Do not expose these ports to the public internet. In production:

- place storage, OpenSearch, worker, and API on a private network/VPN;
- expose storage only through an HTTPS reverse proxy; set `DATACENTER_PUBLIC_URL` to that HTTPS host; the public endpoint accepts only short-lived signed GET/HEAD tokens;
- use HTTPS/TLS for API-to-storage and API/worker-to-OpenSearch;
- enable OpenSearch authentication and rotate credentials;
- set `DATACENTER_INTERNAL_TOKEN` and `DATACENTER_SIGNING_SECRET` to separate cryptographically random secrets of at least 32 characters;
- mount persistent storage backed by monitored disks/NAS and configure snapshots/backups;
- configure OpenSearch snapshots and monitor disk watermarks, heap, indexing lag, queue depth, and failed jobs;
- protect Redis with a strong password/TLS, private network access, and bounded memory/eviction policy; cache loss must never cause data loss;
- keep PostgreSQL as the authoritative metadata and permission store;
- run more than one worker only after validating database claim behavior and resource limits;
- set upload size and extracted text limits according to available RAM and worker capacity.

The current storage adapter is a separate persistent-volume service with a stable HTTP contract. Uploads require SHA-256 and the storage server verifies the digest before atomically committing a file. It can later be replaced by an S3-compatible object store without changing document metadata or mobile APIs. Offline synchronization is currently implemented for notebook entries and form drafts; other modules can register their entity types and payload validators through their own `module.json` and `sync-adapter.js`; each must define its own version/conflict rules before syncing.

## Known constraints in this phase

- OCR language packs currently target Persian and English (`OCR_LANGUAGES=fas+eng` by default; set `fas+eng+kmr` only when the Kurmanji traineddata is installed). Kurdish OCR needs an appropriate language model and evaluation set before enabling it.
- Supported input formats are PDF, PNG, JPEG, WebP, TXT, and Markdown. DOCX, XLSX, and scanned TIFF ingestion are not enabled yet.
- The indexing worker streams and verifies downloaded files, retries failures with exponential backoff and marks jobs failed after the configured attempt limit. The admin panel now includes document upload, status, reindex, soft-delete, restore, storage-volume and OCR queue metrics.
- This implementation has not been load-tested against the real 20 GB corpus or 10,000 concurrent users. Capacity must be sized from measured document counts, average extracted text size, query concurrency, and storage IOPS.


## Bulk import of the existing document library

For an existing multi-gigabyte library, do not upload every file through a browser. Mount the source library on the trusted import host and run from `backend/`:

1. Set `DOCUMENT_IMPORT_DIR` to the mounted source directory.
2. Set `DATACENTER_URL`, `DATACENTER_INTERNAL_TOKEN`, `DATABASE_URL`, and the visibility/job-role settings.
3. Run `npm run documents:import -- --dry-run` to count supported files, duplicates, and invalid signatures without uploading.
4. Run `npm run documents:import` to stream files to storage and enqueue durable indexing jobs.
5. Start `npm run worker:all`; monitor `DocumentIndexJob` failures and free disk/heap.

The importer is bounded to a configurable concurrency (default 3), skips duplicate SHA-256 content, stores the original filename and relative source path in private metadata (not exposed to ordinary search results), and does not delete or modify source files. It does not recursively download the library to user devices. Use a read-only source mount and a separate backup before import.
