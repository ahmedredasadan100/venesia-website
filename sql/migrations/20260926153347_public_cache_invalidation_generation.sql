begin;

-- Public cache coordination only. Domain writes commit before this generation advances.
-- Never reset this value while external cache entries for this database can survive.
create table public.public_cache_generation (
  singleton boolean primary key default true check (singleton),
  generation bigint not null default 0 check (generation >= 0)
);
insert into public.public_cache_generation(singleton, generation) values (true, 0);
alter table public.public_cache_generation enable row level security;
revoke all on table public.public_cache_generation from public, anon, authenticated, service_role;

create function public.read_public_cache_generation()
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare current_generation text;
begin
  if pg_catalog.pg_is_in_recovery() or pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25006', message = 'PUBLIC_CACHE_PRIMARY_REQUIRED';
  end if;
  select generation::text into strict current_generation from public.public_cache_generation where singleton;
  return current_generation;
end;
$$;

create function public.advance_public_cache_generation()
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare next_generation text;
begin
  if pg_catalog.pg_is_in_recovery() or pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25006', message = 'PUBLIC_CACHE_PRIMARY_REQUIRED';
  end if;
  update public.public_cache_generation set generation = generation + 1 where singleton
    returning generation::text into strict next_generation;
  return next_generation;
end;
$$;

revoke all on function public.read_public_cache_generation() from public, anon, authenticated, service_role;
revoke all on function public.advance_public_cache_generation() from public, anon, authenticated, service_role;
grant execute on function public.read_public_cache_generation() to service_role;
grant execute on function public.advance_public_cache_generation() to service_role;
comment on table public.public_cache_generation is 'Durable cache invalidation generation; not publication state. Only advance after a committed immediate invalidation. External cache namespace must be cleared after restoring an older generation.';

-- Extend the existing authoritative classification; verify without changing older ACLs.
do $public_cache_security_revision$
declare
  v_contract jsonb := $venisia_security_contract$
{
  "formatVersion": 2,
  "contractId": "venisia-public-table-security",
  "revision": 4,
  "supersedes": {
    "revision": 3,
    "migrationVersion": "20260920011000",
    "migrationSourceSha256": "f024e3fda109b47c2251fc5ef6d4da49f2b4142fa697a5c50629d7241ec1c67c"
  },
  "existingDatabaseAdoption": null,
  "schema": "public",
  "clientRoles": [
    "anon",
    "authenticated"
  ],
  "ddlRoles": [
    "postgres"
  ],
  "tables": [
    {
      "name": "admin_audit_logs",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "INSERT",
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "admin_user_preferences",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "admin_users",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "analytics_provider_read_models",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "breadcrumb_block_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "cards_block_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "content_block_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "cta_block_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "featured_module_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "feed_module_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "hero_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "hero_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_app_configuration_entries",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_app_configuration_groups",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_app_configuration_validations",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_authorization_attempts",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_connection_assets",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_connections",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_credentials",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "integration_sync_runs",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_assets",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_delete_reservations",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_folders",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_hub_module_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_reference_provider_revisions",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_reference_write_leases",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_references",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "media_sidebar_module_templates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "menu_items",
      "classification": "A",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [
          "SELECT"
        ],
        "authenticated": [
          "SELECT"
        ],
        "service_role": [
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [
        {
          "name": "Public can read visible menu items",
          "command": "SELECT",
          "roles": [
            "PUBLIC"
          ],
          "permissive": true,
          "using": "((is_visible = true) AND (EXISTS ( SELECT 1\n   FROM menus\n  WHERE ((menus.id = menu_items.menu_id) AND (menus.is_active = true)))))",
          "withCheck": null
        }
      ],
      "exception": null
    },
    {
      "name": "menus",
      "classification": "A",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [
          "SELECT"
        ],
        "authenticated": [
          "SELECT"
        ],
        "service_role": [
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [
        {
          "name": "Public can read active menus",
          "command": "SELECT",
          "roles": [
            "PUBLIC"
          ],
          "permissive": true,
          "using": "(is_active = true)",
          "withCheck": null
        }
      ],
      "exception": null
    },
    {
      "name": "page_breadcrumb_block_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_cards_block_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_composition_layouts",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_composition_regions",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_content_block_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_cta_block_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_featured_module_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_feed_module_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_media_hub_module_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "page_media_sidebar_module_assignments",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "pages",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_delivery_items",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_features",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_floor_plan_details",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_floor_plans",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_location_points",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_locations",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_media",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_tracking_items",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_tracking_profiles",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_tracking_stages",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_tracking_update_media",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_tracking_updates",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "project_videos",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "projects",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "SELECT"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "public_cache_generation",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "site_settings",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "topic_categories",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "topic_series",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "topic_view_deduplication",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "topic_view_policy",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "service_role": [
          "SELECT"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "topic_view_request_limits",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "service_role": [
          "DELETE",
          "INSERT",
          "SELECT",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    },
    {
      "name": "topics",
      "classification": "A",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [
          "SELECT"
        ],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [
        {
          "name": "topics_anon_published_read",
          "command": "SELECT",
          "roles": [
            "anon"
          ],
          "permissive": true,
          "using": "((status = 'published'::text) AND (deleted_at IS NULL))",
          "withCheck": null
        }
      ],
      "exception": null
    },
    {
      "name": "url_redirects",
      "classification": "B",
      "owner": "postgres",
      "forceRls": false,
      "grants": {
        "PUBLIC": [],
        "anon": [],
        "authenticated": [],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      },
      "policies": [],
      "exception": null
    }
  ],
  "roles": [
    {
      "name": "anon",
      "classification": "application-public",
      "presence": "required",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "require",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "authenticated",
      "classification": "application-public",
      "presence": "required",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "require",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "authenticator",
      "classification": "platform-managed",
      "presence": "required",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "deny",
        "canLogin": "allow",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "cli_login_postgres",
      "classification": "conditional-platform-tooling",
      "presence": "optional",
      "managedBy": "supabase-cli-login-role",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "deny",
        "canLogin": "require",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "dashboard_user",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "allow",
        "createDb": "allow",
        "replication": "allow"
      }
    },
    {
      "name": "pg_checkpoint",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_create_subscription",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_database_owner",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_execute_server_program",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_maintain",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_monitor",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_read_all_data",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_read_all_settings",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_read_all_stats",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_read_server_files",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_signal_backend",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_stat_scan_tables",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_use_reserved_connections",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_write_all_data",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pg_write_server_files",
      "classification": "postgres-built-in",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "pgbouncer",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "allow",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "postgres",
      "classification": "platform-administration",
      "presence": "required",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "require",
        "inherit": "require",
        "canLogin": "require",
        "createRole": "require",
        "createDb": "require",
        "replication": "require"
      }
    },
    {
      "name": "service_role",
      "classification": "application-server",
      "presence": "required",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "require",
        "inherit": "require",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "supabase_admin",
      "classification": "platform-administration",
      "presence": "required",
      "attributeRules": {
        "superuser": "require",
        "bypassRls": "require",
        "inherit": "require",
        "canLogin": "require",
        "createRole": "require",
        "createDb": "require",
        "replication": "require"
      }
    },
    {
      "name": "supabase_auth_admin",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "deny",
        "canLogin": "allow",
        "createRole": "allow",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "supabase_etl_admin",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "allow",
        "inherit": "allow",
        "canLogin": "allow",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "allow"
      }
    },
    {
      "name": "supabase_functions_admin",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "deny",
        "canLogin": "allow",
        "createRole": "allow",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "supabase_privileged_role",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "supabase_read_only_user",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "allow",
        "inherit": "allow",
        "canLogin": "allow",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "supabase_realtime_admin",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "deny",
        "canLogin": "deny",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "deny"
      }
    },
    {
      "name": "supabase_replication_admin",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "allow",
        "canLogin": "allow",
        "createRole": "deny",
        "createDb": "deny",
        "replication": "allow"
      }
    },
    {
      "name": "supabase_storage_admin",
      "classification": "platform-managed",
      "presence": "optional",
      "attributeRules": {
        "superuser": "deny",
        "bypassRls": "deny",
        "inherit": "deny",
        "canLogin": "allow",
        "createRole": "allow",
        "createDb": "deny",
        "replication": "deny"
      }
    }
  ],
  "memberships": [
    {
      "role": "anon",
      "member": "authenticator",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "required"
    },
    {
      "role": "anon",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "anon",
      "member": "supabase_realtime_admin",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "optional",
      "classification": "platform-managed"
    },
    {
      "role": "authenticated",
      "member": "authenticator",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "required"
    },
    {
      "role": "authenticated",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "authenticated",
      "member": "supabase_realtime_admin",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "optional",
      "classification": "platform-managed"
    },
    {
      "role": "authenticator",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "authenticator",
      "member": "supabase_storage_admin",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_create_subscription",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "pg_monitor",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "pg_monitor",
      "member": "supabase_etl_admin",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_monitor",
      "member": "supabase_read_only_user",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_read_all_data",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "pg_read_all_data",
      "member": "supabase_etl_admin",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_read_all_data",
      "member": "supabase_read_only_user",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_read_all_settings",
      "member": "pg_monitor",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_read_all_stats",
      "member": "pg_monitor",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "pg_signal_backend",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "pg_stat_scan_tables",
      "member": "pg_monitor",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "postgres",
      "member": "cli_login_postgres",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "optional",
      "classification": "conditional-platform-tooling"
    },
    {
      "role": "service_role",
      "member": "authenticator",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "required"
    },
    {
      "role": "service_role",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": true,
      "presence": "optional"
    },
    {
      "role": "service_role",
      "member": "supabase_realtime_admin",
      "inheritOption": false,
      "setOption": true,
      "adminOption": false,
      "presence": "optional",
      "classification": "platform-managed"
    },
    {
      "role": "supabase_functions_admin",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "supabase_privileged_role",
      "member": "postgres",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    },
    {
      "role": "supabase_privileged_role",
      "member": "supabase_etl_admin",
      "inheritOption": true,
      "setOption": true,
      "adminOption": false,
      "presence": "optional"
    }
  ],
  "schemaPrivileges": [
    {
      "role": "PUBLIC",
      "privileges": [
        "USAGE"
      ]
    },
    {
      "role": "anon",
      "privileges": [
        "USAGE"
      ]
    },
    {
      "role": "authenticated",
      "privileges": [
        "USAGE"
      ]
    },
    {
      "role": "postgres",
      "privileges": [
        "CREATE",
        "USAGE"
      ]
    },
    {
      "role": "service_role",
      "privileges": [
        "USAGE"
      ]
    }
  ],
  "defaultPrivileges": [
    {
      "owner": "postgres",
      "schema": "public",
      "objectType": "S",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "owner": "postgres",
      "schema": "public",
      "objectType": "r",
      "grants": {
        "postgres": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ],
        "service_role": [
          "DELETE",
          "INSERT",
          "MAINTAIN",
          "REFERENCES",
          "SELECT",
          "TRIGGER",
          "TRUNCATE",
          "UPDATE"
        ]
      }
    }
  ],
  "columnPrivileges": [],
  "sequencePrivileges": [
    {
      "name": "admin_audit_logs_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "admin_users_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "breadcrumb_block_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "cards_block_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "content_block_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "cta_block_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "featured_module_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "feed_module_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "hero_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "hero_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "media_hub_module_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "media_sidebar_module_templates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "menu_items_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "menus_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_breadcrumb_block_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_cards_block_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_composition_layouts_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_content_block_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_cta_block_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_featured_module_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_feed_module_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_media_hub_module_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "page_media_sidebar_module_assignments_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "pages_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_delivery_items_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_features_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_floor_plan_details_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_floor_plans_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_location_points_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_locations_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_media_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_tracking_items_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_tracking_stages_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_tracking_update_media_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_tracking_updates_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "project_videos_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "projects_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "topic_categories_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "topic_series_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "topics_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    },
    {
      "name": "url_redirects_id_seq",
      "owner": "postgres",
      "grants": {
        "postgres": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ],
        "service_role": [
          "SELECT",
          "UPDATE",
          "USAGE"
        ]
      }
    }
  ],
  "functionSecurity": {
    "clientRoles": [
      "anon",
      "authenticated"
    ],
    "allowClientExecute": [],
    "forbidClientSecurityDefinerExecute": true,
    "forbidClientGrantOptions": true,
    "defaultClientExecute": false
  }
}
  $venisia_security_contract$::jsonb;
  v_entry jsonb;
  v_relation oid;
  v_actual jsonb;
  v_expected jsonb;
  v_actual_names text[];
  v_expected_names text[];
begin
  if v_contract->>'contractId' is distinct from 'venisia-public-table-security'
     or v_contract->>'formatVersion' is distinct from '2'
     or v_contract->>'revision' is distinct from '4'
     or v_contract->'supersedes' is distinct from jsonb_build_object(
       'revision',3,'migrationVersion','20260920011000',
       'migrationSourceSha256','f024e3fda109b47c2251fc5ef6d4da49f2b4142fa697a5c50629d7241ec1c67c') then
    raise exception using errcode='P0001', message='database_security_revision4_provenance_drift';
  end if;

  select array_agg(c.relname::text order by c.relname::text collate "C") into v_actual_names
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p');
  select array_agg(value->>'name' order by (value->>'name') collate "C") into v_expected_names
  from jsonb_array_elements(v_contract->'tables');
  if v_actual_names is distinct from v_expected_names then
    raise exception using errcode='P0001', message='database_security_revision4_table_inventory_drift';
  end if;

  for v_entry in select value from jsonb_array_elements(v_contract->'tables')
  loop
    v_relation := pg_catalog.to_regclass(format('public.%I',v_entry->>'name'));
    if not exists(select 1 from pg_catalog.pg_class where oid=v_relation
      and pg_catalog.pg_get_userbyid(relowner)=v_entry->>'owner'
      and relrowsecurity=(v_entry->>'classification'<>'C')
      and relforcerowsecurity=(v_entry->>'forceRls')::boolean) then
      raise exception using errcode='P0001', message='database_security_revision4_table_identity_drift';
    end if;
    select coalesce(jsonb_object_agg(role,privileges),'{}'::jsonb) into v_actual from (
      select case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end role,
        jsonb_agg(a.privilege_type order by a.privilege_type) privileges
      from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(
        coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      where c.oid=v_relation group by a.grantee
    ) grants;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_expected
    from jsonb_each(v_entry->'grants') where value<>'[]'::jsonb;
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='database_security_revision4_table_grant_drift';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'name',p.polname,'command',case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
        when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end,
      'roles',(select jsonb_agg(case when role_oid=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end order by role_oid)
        from unnest(p.polroles) role_oid),'permissive',p.polpermissive,
      'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),
      'withCheck',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) order by p.polname),'[]'::jsonb)
      into v_actual from pg_catalog.pg_policy p where p.polrelid=v_relation;
    select coalesce(jsonb_agg(value order by value->>'name'),'[]'::jsonb) into v_expected
    from jsonb_array_elements(v_entry->'policies');
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='database_security_revision4_policy_drift';
    end if;
  end loop;

  select array_agg(c.relname::text order by c.relname::text collate "C") into v_actual_names
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='S';
  select array_agg(value->>'name' order by (value->>'name') collate "C") into v_expected_names
  from jsonb_array_elements(v_contract->'sequencePrivileges');
  if v_actual_names is distinct from v_expected_names then
    raise exception using errcode='P0001', message='database_security_revision4_sequence_inventory_drift';
  end if;
  for v_entry in select value from jsonb_array_elements(v_contract->'sequencePrivileges')
  loop
    v_relation := pg_catalog.to_regclass(format('public.%I',v_entry->>'name'));
    select coalesce(jsonb_object_agg(role,privileges),'{}'::jsonb) into v_actual from (
      select pg_catalog.pg_get_userbyid(a.grantee) role,
        jsonb_agg(a.privilege_type order by a.privilege_type) privileges
      from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(
        coalesce(c.relacl,pg_catalog.acldefault('s',c.relowner))) a
      where c.oid=v_relation and a.grantee<>0 group by a.grantee
    ) grants;
    if v_actual is distinct from v_entry->'grants' or not exists(
      select 1 from pg_catalog.pg_class where oid=v_relation
        and pg_catalog.pg_get_userbyid(relowner)=v_entry->>'owner') then
      raise exception using errcode='P0001', message='database_security_revision4_sequence_grant_drift';
    end if;
  end loop;

  if exists(select 1 from pg_catalog.pg_roles r where not exists(
      select 1 from jsonb_array_elements(v_contract->'roles') d where d->>'name'=r.rolname))
     or exists(select 1 from jsonb_array_elements(v_contract->'roles') d
       where d->>'presence'='required' and not exists(select 1 from pg_catalog.pg_roles r where r.rolname=d->>'name')) then
    raise exception using errcode='P0001', message='database_security_revision4_role_classification_drift';
  end if;
  for v_entry in select value from jsonb_array_elements(v_contract->'roles')
  loop
    select jsonb_build_object('superuser',rolsuper,'bypassRls',rolbypassrls,'inherit',rolinherit,
      'canLogin',rolcanlogin,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication)
      into v_actual from pg_catalog.pg_roles where rolname=v_entry->>'name';
    if v_actual is null then continue; end if;
    if exists(select 1 from jsonb_each_text(v_entry->'attributeRules') rule
      where (rule.value='deny' and (v_actual->>rule.key)::boolean)
         or (rule.value='require' and not (v_actual->>rule.key)::boolean)
         or rule.value not in ('deny','require','allow')) then
      raise exception using errcode='P0001', message='database_security_revision4_role_attribute_drift';
    end if;
  end loop;
  if exists(select 1 from pg_catalog.pg_auth_members m where not exists(
      select 1 from jsonb_array_elements(v_contract->'memberships') rule
      where rule->>'role'=pg_catalog.pg_get_userbyid(m.roleid)
        and rule->>'member'=pg_catalog.pg_get_userbyid(m.member)
        and (rule->>'inheritOption')::boolean=m.inherit_option
        and (rule->>'setOption')::boolean=m.set_option
        and (rule->>'adminOption')::boolean=m.admin_option))
     or exists(select 1 from jsonb_array_elements(v_contract->'memberships') rule
      where rule->>'presence'='required' and not exists(select 1 from pg_catalog.pg_auth_members m
        where pg_catalog.pg_get_userbyid(m.roleid)=rule->>'role'
          and pg_catalog.pg_get_userbyid(m.member)=rule->>'member'
          and m.inherit_option=(rule->>'inheritOption')::boolean
          and m.set_option=(rule->>'setOption')::boolean
          and m.admin_option=(rule->>'adminOption')::boolean)) then
    raise exception using errcode='P0001', message='database_security_revision4_role_membership_drift';
  end if;
  if exists(with recursive reachable(client,reached_role) as (
      select value collate "C",value collate "C" from jsonb_array_elements_text(v_contract->'clientRoles')
      union select reachable.client collate "C",pg_catalog.pg_get_userbyid(m.roleid)::text collate "C"
      from reachable join pg_catalog.pg_auth_members m on pg_catalog.pg_get_userbyid(m.member)=reachable.reached_role
      where m.inherit_option or m.set_option or m.admin_option)
    select 1 from reachable join pg_catalog.pg_roles r on r.rolname=reachable.reached_role
    where reachable.reached_role<>reachable.client and
      (r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolreplication or r.rolname='service_role')) then
    raise exception using errcode='P0001', message='database_security_revision4_application_role_escalation_path';
  end if;

  if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and (pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')))
     or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
       cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
       where n.nspname='public' and a.is_grantable
         and (a.grantee=0 or pg_catalog.pg_get_userbyid(a.grantee) in ('anon','authenticated')))
     or exists(select 1 from pg_catalog.pg_default_acl d
       left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
       cross join lateral pg_catalog.aclexplode(d.defaclacl) a
       where d.defaclobjtype='f' and pg_catalog.pg_get_userbyid(d.defaclrole)=any(array['postgres'])
         and (d.defaclnamespace=0 or n.nspname='public') and a.privilege_type='EXECUTE'
         and (a.grantee=0 or pg_catalog.pg_get_userbyid(a.grantee) in ('anon','authenticated'))) then
    raise exception using errcode='P0001', message='database_security_revision4_function_execute_drift';
  end if;
  if exists(select 1 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join lateral pg_catalog.aclexplode(a.attacl) acl
      where n.nspname='public' and a.attnum>0 and not a.attisdropped) then
    raise exception using errcode='P0001', message='database_security_revision4_column_acl_drift';
  end if;
end;
$public_cache_security_revision$;

notify pgrst, 'reload schema';
commit;
