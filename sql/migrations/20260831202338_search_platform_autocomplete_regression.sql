begin;

do $$
declare
  target_rows integer;
begin
  perform id
  from public.content_block_templates
  where slug = 'search-platform'
    and variant = 'search-platform'
  for update;

  get diagnostics target_rows = row_count;
  if target_rows <> 1 then
    raise exception
      'Expected one canonical Search Platform results template, found % rows',
      target_rows;
  end if;

  update public.content_block_templates
  set
    config = jsonb_set(
      jsonb_set(
        config,
        '{filters}',
        '["content-type"]'::jsonb,
        true
      ),
      '{helpText}',
      to_jsonb('ابحث بالعنوان أو الملخص أو الرابط.'::text),
      true
    ),
    updated_at = now()
  where slug = 'search-platform'
    and variant = 'search-platform'
    and (
      config -> 'filters' is distinct from '["content-type"]'::jsonb
      or config ->> 'helpText' is distinct from 'ابحث بالعنوان أو الملخص أو الرابط.'
    );
end;
$$;

commit;
