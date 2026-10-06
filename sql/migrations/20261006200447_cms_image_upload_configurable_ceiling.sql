-- Keep the configured Media policy as the per-upload limit. Storage enforces
-- only the shared safe ceiling; no settings, MIME rules or permissions change.
update storage.buckets
set file_size_limit = 52428800
where id = 'cms-images';
