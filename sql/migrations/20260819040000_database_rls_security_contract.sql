-- Venesia public-table security contract, platform-aware revision.
-- Authored with Project Owner authorization on 2026-09-16.
-- The filename is a deliberate dependency-order version: after the historical
-- Tracking pagination migration and before the historical RLS ACL hardening.
-- It is NOT a claim that this migration existed or ran on 2026-08-19.
-- Creation receipt: .tmp-qa/rls-security-contract/migration-creation.json.
-- Existing-database / Production application requires separate authorization;
-- no earlier migration receipt is replayed, renamed, or rewritten by this file.
-- Revision 1 retains the historical 56-table/38-sequence snapshot. Its bounded
-- Existing-106 adoption branch accepts only the reviewed 61/40 evolution when
-- the exact registry, creator receipts and structural signatures match; it then
-- applies the same material security effect to the complete approved inventory.
--
-- The executable JSON literal below is the single migration-owned declaration.
-- The existing reconciliation verifier consumes this same literal. No persisted
-- metadata table, security function, optional event trigger, or second owner is
-- introduced. Publication predicates remain the existing three SQL policies.
--
-- Application access remains exact and fail-closed. Supabase/Postgres roles are
-- explicitly classified with bounded attributes and memberships instead of a
-- literal whole-platform snapshot. Unclassified roles still fail closed.
-- cli_login_postgres is conditional platform tooling: its exact attributes,
-- membership, credential state, active sessions, ownership and direct ACLs are
-- checked without changing or deleting the role.
-- The 24 service-role reductions retain source-proven direct CRUD and invoker
-- RPC requirements. Postgres ownership and the other 32 service ACLs are kept.
-- Client function EXECUTE and postgres/public function defaults are closed;
-- official platform creator defaults outside the public application schema are untouched.

begin;

do $venisia_security_adoption$
declare
  v_contract constant jsonb :=
  $venisia_security_contract$
{
  "formatVersion": 2,
  "contractId": "venisia-public-table-security",
  "revision": 1,
  "supersedes": null,
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
  },
  "existingDatabaseAdoption": {
    "mode": "approved-existing-database",
    "registry": {
      "count": 106,
      "head": "20260914151556",
      "identitySha256": "f410be65dbb575eb433fbdeec4e96e71feae155826213a678260dbbd2a6d99ef",
      "requiredReceipts": [
        {
          "version": "20260828233733",
          "name": "featured_page_composition_module",
          "sourceSha256": "0d38383d42e4f48bff01a9cd7c1a4dacf27d76c3202ae1273927c7ff6966373a",
          "productionWholeFileReceipt": {
            "statementCount": 1,
            "statementsSha256": "90dabbcba5bd2a797dfd17ef42dfeb42d5efa60d40177ca94577ebf2583114b6"
          },
          "supabaseCliV2116Receipt": {
            "statementCount": 32,
            "statementsSha256": "cd7142f45244cf23470d3a11f401cd20dcb73bea438509268694147a1729278f"
          }
        },
        {
          "version": "20260911194004",
          "name": "topic_view_integrity",
          "sourceSha256": "eb9157b854f70098e4e5137f90cf6174ea6981cee1b250b7d31c15a4817fcc58",
          "productionWholeFileReceipt": {
            "statementCount": 1,
            "statementsSha256": "a145bb8c4ce22bab969ed81b806d2af81cbc5b89cf9651f05ce720181a79ca85"
          },
          "supabaseCliV2116Receipt": {
            "statementCount": 26,
            "statementsSha256": "b317fdd7c09163649561d8ee7a5ac29b50f1499d11cd2b5d003c77033eecd5f2"
          }
        }
      ]
    },
    "tableStructureSha256": "caa51ae621cc5b1616a36a55ddc72dd13928b3c3ea46eed4b6a2951ff3d94f13",
    "sequenceStructureSha256": "6470bc044437ec26eaec110d423b848dce0dcd910fe95020623acd406eacd4ce",
    "extensionTables": [
      {
        "name": "featured_module_templates",
        "classification": "B",
        "owner": "postgres",
        "forceRls": false,
        "grants": {
          "PUBLIC": [],
          "anon": [],
          "authenticated": [],
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
        "name": "page_featured_module_assignments",
        "classification": "B",
        "owner": "postgres",
        "forceRls": false,
        "grants": {
          "PUBLIC": [],
          "anon": [],
          "authenticated": [],
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
        "name": "topic_view_deduplication",
        "classification": "B",
        "owner": "postgres",
        "forceRls": false,
        "grants": {
          "PUBLIC": [],
          "anon": [],
          "authenticated": [],
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
          "PUBLIC": [],
          "anon": [],
          "authenticated": [],
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
          "PUBLIC": [],
          "anon": [],
          "authenticated": [],
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
      }
    ],
    "extensionSequencePrivileges": [
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
      }
    ]
  }
}
  $venisia_security_contract$::jsonb;
  v_effective_contract jsonb;
  v_existing_adoption jsonb;
  v_adoption_mode text;
  v_registry_count integer;
  v_registry_head text;
  v_registry_identity_sha256 text;
  v_receipt record;
  v_required_receipt jsonb;
  v_extension_table_names text[];
  v_extension_sequence_names text[];
  v_structure_before jsonb;
  v_structure_after jsonb;
  v_table jsonb;
  v_role text;
  v_privilege text;
  v_relation oid;
  v_tooling_role oid;
  v_actual_policies jsonb;
  v_expected_policies jsonb;
  v_actual_grants jsonb;
  v_expected_grants jsonb;
  v_expected_names text[];
  v_actual_names text[];
  v_invariants_before jsonb;
  v_invariants_after jsonb;
  v_actual_list jsonb;
  v_expected_list jsonb;
  v_entry jsonb;
  v_sequence jsonb;
  v_default jsonb;
  v_immutable_before jsonb;
  v_immutable_after jsonb;
  v_immutable_catalog_sql constant text := $preserved_security_catalog$
    select jsonb_build_object(
      'roles', (select jsonb_agg(jsonb_build_object(
        'oid',oid,'name',rolname,'superuser',rolsuper,'inherit',rolinherit,
        'createRole',rolcreaterole,'createDb',rolcreatedb,'canLogin',rolcanlogin,
        'replication',rolreplication,'bypassRls',rolbypassrls
      ) order by rolname) from pg_catalog.pg_roles),
      'memberships', (select jsonb_agg(to_jsonb(m) order by roleid,member,grantor)
                      from pg_catalog.pg_auth_members as m),
      'schemas', (select jsonb_agg(jsonb_build_object('oid',oid,'name',nspname,'owner',nspowner,'acl',nspacl)
                                 order by nspname) from pg_catalog.pg_namespace),
      'otherDefaults', (select jsonb_agg(to_jsonb(d) order by defaclrole,defaclnamespace,defaclobjtype)
                       from pg_catalog.pg_default_acl as d
                       where not (defaclrole='postgres'::regrole::oid
                         and defaclnamespace='public'::regnamespace::oid and defaclobjtype in ('r','S'))),
      'functions', (select jsonb_agg(jsonb_build_object(
        'oid',p.oid,'owner',p.proowner,'acl',p.proacl,'securityDefiner',p.prosecdef,
        'config',p.proconfig,'sourceHash',md5(pg_catalog.pg_get_functiondef(p.oid))) order by p.oid)
        from pg_catalog.pg_proc as p
        where p.pronamespace='public'::regnamespace::oid and p.prokind in ('f','p')),
      'events', (select jsonb_agg(to_jsonb(e) order by evtname) from pg_catalog.pg_event_trigger as e),
      'sequenceProtectedAcl', (select jsonb_agg(jsonb_build_object(
        'oid',s.oid,'name',s.relname,'owner',s.relowner,
        'acl',(select coalesce(jsonb_agg(to_jsonb(a) order by a.grantor,a.grantee,a.privilege_type),'[]'::jsonb)
               from pg_catalog.aclexplode(coalesce(s.relacl,pg_catalog.acldefault('s',s.relowner))) as a
               where a.grantee<>0 and a.grantee not in ('anon'::regrole::oid,'authenticated'::regrole::oid))
      ) order by s.relname) from pg_catalog.pg_class as s
        where s.relnamespace='public'::regnamespace::oid and s.relkind='S')
    )
  $preserved_security_catalog$;
begin
  if v_contract->>'contractId' is distinct from 'venisia-public-table-security'
     or v_contract->>'formatVersion' is distinct from '2'
     or v_contract->>'revision' is distinct from '1'
     or v_contract->>'schema' is distinct from 'public'
     or v_contract->'supersedes' is distinct from 'null'::jsonb
     or jsonb_typeof(v_contract->'existingDatabaseAdoption') is distinct from 'object'
     or v_contract->'clientRoles' is distinct from '["anon","authenticated"]'::jsonb
     or v_contract->'ddlRoles' is distinct from '["postgres"]'::jsonb
     or jsonb_typeof(v_contract->'tables') is distinct from 'array'
     or jsonb_typeof(v_contract->'roles') is distinct from 'array'
     or jsonb_typeof(v_contract->'memberships') is distinct from 'array'
     or jsonb_typeof(v_contract->'schemaPrivileges') is distinct from 'array'
     or jsonb_typeof(v_contract->'defaultPrivileges') is distinct from 'array'
     or jsonb_typeof(v_contract->'columnPrivileges') is distinct from 'array'
     or jsonb_typeof(v_contract->'sequencePrivileges') is distinct from 'array'
     or jsonb_typeof(v_contract->'functionSecurity') is distinct from 'object'
     or jsonb_array_length(v_contract->'roles') = 0
     or jsonb_array_length(v_contract->'schemaPrivileges') = 0
     or jsonb_array_length(v_contract->'sequencePrivileges') = 0 then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_metadata_is_incomplete';
  end if;

  if current_user <> 'postgres' then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_requires_declared_migration_role';
  end if;

  if exists (select 1 from pg_catalog.pg_roles r where not exists (
       select 1 from jsonb_array_elements(v_contract->'roles') declared where declared->>'name'=r.rolname
     )) or exists (select 1 from jsonb_array_elements(v_contract->'roles') declared
       where declared->>'presence'='required' and not exists (
         select 1 from pg_catalog.pg_roles r where r.rolname=declared->>'name'
       )) then
    raise exception using errcode='P0001', message='venisia_security_contract_role_classification_mismatch';
  end if;
  for v_entry in select value from jsonb_array_elements(v_contract->'roles')
  loop
    select jsonb_build_object('superuser',rolsuper,'bypassRls',rolbypassrls,'inherit',rolinherit,
      'canLogin',rolcanlogin,'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication)
      into v_actual_list from pg_catalog.pg_roles where rolname=v_entry->>'name';
    if v_actual_list is null then continue; end if;
    if exists (select 1 from jsonb_each_text(v_entry->'attributeRules') rule
      where (rule.value='deny' and (v_actual_list->>rule.key)::boolean)
         or (rule.value='require' and not (v_actual_list->>rule.key)::boolean)
         or rule.value not in ('deny','require','allow')) then
      raise exception using errcode='P0001', message='venisia_security_contract_role_attribute_boundary';
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_auth_members m where not exists (
      select 1 from jsonb_array_elements(v_contract->'memberships') rule
      where rule->>'role'=pg_catalog.pg_get_userbyid(m.roleid)
        and rule->>'member'=pg_catalog.pg_get_userbyid(m.member)
        and (rule->>'inheritOption')::boolean=m.inherit_option
        and (rule->>'setOption')::boolean=m.set_option
        and (rule->>'adminOption')::boolean=m.admin_option
    )) or exists (select 1 from jsonb_array_elements(v_contract->'memberships') rule
      where rule->>'presence'='required' and not exists (
        select 1 from pg_catalog.pg_auth_members m
        where pg_catalog.pg_get_userbyid(m.roleid)=rule->>'role'
          and pg_catalog.pg_get_userbyid(m.member)=rule->>'member'
          and m.inherit_option=(rule->>'inheritOption')::boolean
          and m.set_option=(rule->>'setOption')::boolean
          and m.admin_option=(rule->>'adminOption')::boolean
    )) then
    raise exception using errcode='P0001', message='venisia_security_contract_role_membership_boundary';
  end if;
  if exists (with recursive reachable(client,reached_role) as (
      select value collate "C",value collate "C" from jsonb_array_elements_text(v_contract->'clientRoles')
      union
      select reachable.client collate "C",pg_catalog.pg_get_userbyid(m.roleid)::text collate "C"
      from reachable join pg_catalog.pg_auth_members m on pg_catalog.pg_get_userbyid(m.member)=reachable.reached_role
      where m.inherit_option or m.set_option or m.admin_option
    ) select 1 from reachable join pg_catalog.pg_roles r on r.rolname=reachable.reached_role
      where reachable.reached_role<>reachable.client
        and (r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolreplication or r.rolname='service_role')) then
    raise exception using errcode='P0001', message='venisia_security_contract_application_role_escalation_path';
  end if;
  select oid into v_tooling_role from pg_catalog.pg_roles where rolname='cli_login_postgres';
  if v_tooling_role is not null and (
      not exists(select 1 from pg_catalog.pg_authid where rolname='cli_login_postgres' and rolpassword is not null and rolvaliduntil is not null)
      or exists(select 1 from pg_catalog.pg_stat_activity where usename='cli_login_postgres')
      or exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relowner=v_tooling_role)
      or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proowner=v_tooling_role)
      or exists(select 1 from pg_catalog.pg_class c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a
        where c.relnamespace='public'::regnamespace and c.relkind in ('r','p','S') and a.grantee=v_tooling_role)
      or exists(select 1 from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        where p.pronamespace='public'::regnamespace and a.grantee=v_tooling_role)
    ) then
    raise exception using errcode='P0001', message='venisia_security_contract_conditional_tooling_boundary';
  end if;

  foreach v_role in array array['anon','authenticated']
  loop
    if not exists (select 1 from pg_catalog.pg_roles
                   where rolname=v_role and not rolsuper and not rolbypassrls)
       or pg_catalog.has_schema_privilege(v_role,'public','CREATE') then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_client_has_privileged_boundary';
    end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(v_contract->'schemaPrivileges')
  loop
    if v_entry->>'role' = 'PUBLIC' then
      select coalesce(jsonb_agg(a.privilege_type order by a.privilege_type),'[]'::jsonb)
        into v_actual_list
      from pg_catalog.pg_namespace as n
      cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) as a
      where n.nspname='public' and a.grantee=0;
    else
      select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb)
        into v_actual_list from (values ('CREATE'),('USAGE')) as privileges(privilege)
      where pg_catalog.has_schema_privilege(v_entry->>'role','public',privilege);
    end if;
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_expected_list
    from jsonb_array_elements(v_entry->'privileges');
    if v_actual_list is distinct from v_expected_list then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_schema_privileges_mismatch';
    end if;
  end loop;

  if v_contract->'columnPrivileges' is distinct from '[]'::jsonb
     or exists (
       select 1 from pg_catalog.pg_attribute as a
       join pg_catalog.pg_class as c on c.oid=a.attrelid
       cross join lateral pg_catalog.aclexplode(a.attacl) as acl
       where c.relnamespace='public'::regnamespace::oid
         and a.attnum>0 and not a.attisdropped
     ) then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_unreviewed_column_privileges';
  end if;

  -- A schema-specific REVOKE cannot subtract a global default grant. This
  -- checkpoint has no postgres global TABLE/SEQUENCE defaults; do not broaden
  -- the transition to Storage or other schemas if that prerequisite changes.
  if exists (select 1 from pg_catalog.pg_default_acl
             where defaclrole='postgres'::regrole::oid
               and defaclnamespace=0 and defaclobjtype in ('r','S'))
     or exists (select 1 from jsonb_array_elements(v_contract->'defaultPrivileges') as rows(item)
                where item->>'owner' is distinct from 'postgres'
                  or item->>'schema' is distinct from 'public'
                  or item->>'objectType' not in ('r','S')) then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_unreviewed_global_defaults';
  end if;

  if v_contract->'functionSecurity'->'clientRoles' is distinct from v_contract->'clientRoles'
     or v_contract->'functionSecurity'->'allowClientExecute' is distinct from '[]'::jsonb
     or v_contract->'functionSecurity'->>'forbidClientSecurityDefinerExecute' is distinct from 'true'
     or v_contract->'functionSecurity'->>'forbidClientGrantOptions' is distinct from 'true'
     or v_contract->'functionSecurity'->>'defaultClientExecute' is distinct from 'false' then
    raise exception using errcode='P0001', message='venisia_security_contract_function_boundary_invalid';
  end if;

  -- Revision 1 retains its exact historical 56-table/38-sequence declaration.
  -- A database that legitimately reached the reviewed 106 head before adopting
  -- this migration may use only the bounded evolution declared in the same
  -- executable contract. No inventory entry is inferred from the live catalog.
  v_existing_adoption := v_contract->'existingDatabaseAdoption';
  if v_existing_adoption->>'mode' is distinct from 'approved-existing-database'
     or jsonb_typeof(v_existing_adoption->'extensionTables') is distinct from 'array'
     or jsonb_typeof(v_existing_adoption->'extensionSequencePrivileges') is distinct from 'array'
     or jsonb_array_length(v_existing_adoption->'extensionTables') <> 5
     or jsonb_array_length(v_existing_adoption->'extensionSequencePrivileges') <> 2 then
    raise exception using errcode='P0001', message='venisia_security_contract_existing_adoption_metadata_invalid';
  end if;
  select array_agg(value->>'name' order by value->>'name' collate "C") into v_expected_names
  from jsonb_array_elements(v_contract->'tables');
  select array_agg(value->>'name' order by value->>'name' collate "C") into v_actual_names
  from jsonb_array_elements(v_existing_adoption->'extensionTables');
  if v_actual_names && v_expected_names then
    raise exception using errcode='P0001', message='venisia_security_contract_existing_adoption_duplicate_table';
  end if;
  v_extension_table_names := v_actual_names;
  select array_agg(value->>'name' order by value->>'name' collate "C") into v_extension_sequence_names
  from jsonb_array_elements(v_existing_adoption->'extensionSequencePrivileges');

  select array_agg(c.relname::text order by c.relname::text collate "C") into v_actual_names
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p');
  select array_agg(value->>'name' order by value->>'name' collate "C") into v_expected_names
  from jsonb_array_elements(v_contract->'tables');
  if v_actual_names = v_expected_names then
    v_adoption_mode := 'fresh-historical-checkpoint';
    v_effective_contract := v_contract;
  elsif v_actual_names = (
    select array_agg(name order by name collate "C") from (
      select value->>'name' name from jsonb_array_elements(v_contract->'tables')
      union all
      select value->>'name' from jsonb_array_elements(v_existing_adoption->'extensionTables')
    ) approved
  ) then
    v_adoption_mode := 'existing-approved-evolution';
    v_effective_contract := jsonb_set(v_contract,'{tables}',
      (v_contract->'tables') || (v_existing_adoption->'extensionTables'));
  else
    raise exception using errcode='P0001', message='venisia_security_contract_public_table_inventory_mismatch';
  end if;

  select array_agg(c.relname::text order by c.relname::text collate "C") into v_actual_names
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='S';
  select array_agg(value->>'name' order by value->>'name' collate "C") into v_expected_names
  from jsonb_array_elements(v_contract->'sequencePrivileges');
  if v_adoption_mode='fresh-historical-checkpoint' and v_actual_names is distinct from v_expected_names then
    raise exception using errcode='P0001', message='venisia_security_contract_sequence_inventory_mismatch';
  elsif v_adoption_mode='existing-approved-evolution' then
    if v_actual_names is distinct from (
      select array_agg(name order by name collate "C") from (
        select value->>'name' name from jsonb_array_elements(v_contract->'sequencePrivileges')
        union all
        select value->>'name' from jsonb_array_elements(v_existing_adoption->'extensionSequencePrivileges')
      ) approved
    ) then
      raise exception using errcode='P0001', message='venisia_security_contract_sequence_inventory_mismatch';
    end if;
    v_effective_contract := jsonb_set(v_effective_contract,'{sequencePrivileges}',
      (v_contract->'sequencePrivileges') || (v_existing_adoption->'extensionSequencePrivileges'));
  end if;

  if v_adoption_mode='existing-approved-evolution' then
    select count(*)::integer,max(version),
      encode(sha256(convert_to(jsonb_agg(jsonb_build_object('version',version,'name',name)
        order by version collate "C")::text,'UTF8')),'hex')
      into v_registry_count,v_registry_head,v_registry_identity_sha256
    from supabase_migrations.schema_migrations;
    if v_registry_count is distinct from (v_existing_adoption->'registry'->>'count')::integer
       or v_registry_head is distinct from v_existing_adoption->'registry'->>'head'
       or v_registry_identity_sha256 is distinct from v_existing_adoption->'registry'->>'identitySha256'
       or exists (select 1 from supabase_migrations.schema_migrations
         where statements is null or cardinality(statements)=0) then
      raise exception using errcode='P0001', message='venisia_security_contract_existing_adoption_registry_mismatch';
    end if;
    for v_required_receipt in select value
      from jsonb_array_elements(v_existing_adoption->'registry'->'requiredReceipts')
    loop
      select * into v_receipt from supabase_migrations.schema_migrations
      where version=v_required_receipt->>'version' and name=v_required_receipt->>'name';
      if not found or not exists (
        select 1 from (values
          (v_required_receipt->'productionWholeFileReceipt'),
          (v_required_receipt->'supabaseCliV2116Receipt')
        ) accepted(receipt)
        where cardinality(v_receipt.statements)=(accepted.receipt->>'statementCount')::integer
          and encode(sha256(convert_to(to_json(v_receipt.statements)::text,'UTF8')),'hex')
            =accepted.receipt->>'statementsSha256'
      ) then
        raise exception using errcode='P0001', message='venisia_security_contract_existing_adoption_receipt_mismatch';
      end if;
    end loop;

    with target_tables as (
      select c.oid,c.relname,pg_catalog.pg_get_userbyid(c.relowner) owner,c.relpersistence
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and c.relname=any(v_extension_table_names)
    ), table_docs as (
      select t.relname,jsonb_build_object('name',t.relname,'owner',t.owner,'persistence',t.relpersistence,
        'columns',(select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,
          'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
          'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid,false),'identity',a.attidentity::text,
          'generated',a.attgenerated::text,'collation',case when a.attcollation=0 then null else a.attcollation::regcollation::text end)
          order by a.attnum),'[]'::jsonb) from pg_catalog.pg_attribute a
          left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
          where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped),
        'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',con.conname,'type',con.contype::text,
          'definition',pg_catalog.pg_get_constraintdef(con.oid,true),'validated',con.convalidated,
          'deferrable',con.condeferrable,'deferred',con.condeferred) order by con.conname),'[]'::jsonb)
          from pg_catalog.pg_constraint con where con.conrelid=t.oid),
        'indexes',(select coalesce(jsonb_agg(jsonb_build_object('name',i.indexrelid::regclass::text,
          'definition',pg_catalog.pg_get_indexdef(i.indexrelid)) order by i.indexrelid::regclass::text),'[]'::jsonb)
          from pg_catalog.pg_index i where i.indrelid=t.oid),
        'triggers',(select coalesce(jsonb_agg(jsonb_build_object('name',tr.tgname,
          'definition',pg_catalog.pg_get_triggerdef(tr.oid,true)) order by tr.tgname),'[]'::jsonb)
          from pg_catalog.pg_trigger tr where tr.tgrelid=t.oid and not tr.tgisinternal)) doc
      from target_tables t
    ), target_sequences as (
      select c.oid,c.relname,pg_catalog.pg_get_userbyid(c.relowner) owner
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='S' and c.relname=any(v_extension_sequence_names)
    ), sequence_docs as (
      select s.relname,jsonb_build_object('name',s.relname,'owner',s.owner,
        'parameters',(select jsonb_build_object('type',pg_catalog.format_type(q.seqtypid,null),'start',q.seqstart,
          'increment',q.seqincrement,'max',q.seqmax,'min',q.seqmin,'cache',q.seqcache,'cycle',q.seqcycle)
          from pg_catalog.pg_sequence q where q.seqrelid=s.oid),
        'ownedBy',(select coalesce(jsonb_agg(jsonb_build_object('table',d.refobjid::regclass::text,
          'column',a.attname,'dependency',d.deptype::text) order by d.refobjid::regclass::text,a.attname),'[]'::jsonb)
          from pg_catalog.pg_depend d join pg_catalog.pg_attribute a on a.attrelid=d.refobjid and a.attnum=d.refobjsubid
          where d.objid=s.oid and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass
            and d.deptype in ('a','i'))) doc from target_sequences s
    ) select jsonb_build_object(
      'tables',(select jsonb_agg(doc order by relname) from table_docs),
      'sequences',(select jsonb_agg(doc order by relname) from sequence_docs)) into v_structure_before;
    if encode(sha256(convert_to((v_structure_before->'tables')::text,'UTF8')),'hex')
         is distinct from v_existing_adoption->>'tableStructureSha256'
       or encode(sha256(convert_to((v_structure_before->'sequences')::text,'UTF8')),'hex')
         is distinct from v_existing_adoption->>'sequenceStructureSha256' then
      raise exception using errcode='P0001', message='venisia_security_contract_existing_adoption_structure_mismatch';
    end if;
  end if;

  for v_entry in select jsonb_build_object('identity',format('%I.%I(%s)',n.nspname,p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)))
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind in ('f','p')
  loop
    execute format('revoke all privileges on function %s from public, anon, authenticated restrict',v_entry->>'identity');
  end loop;
  alter default privileges for role postgres in schema public
    revoke execute on functions from public, anon, authenticated;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind in ('f','p') and (
        pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')))
     or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
       cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
       where n.nspname='public' and a.is_grantable
         and (a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole)))
     or exists(select 1 from pg_catalog.pg_default_acl d
       cross join lateral pg_catalog.aclexplode(d.defaclacl) a
       where d.defaclrole='postgres'::regrole and d.defaclobjtype='f'
         and (d.defaclnamespace=0 or d.defaclnamespace='public'::regnamespace)
         and a.privilege_type='EXECUTE'
         and (a.grantee=0 or a.grantee in ('anon'::regrole,'authenticated'::regrole))) then
    raise exception using errcode='P0001', message='venisia_security_contract_function_execute_postcondition';
  end if;

  execute v_immutable_catalog_sql into v_immutable_before;

  select coalesce(jsonb_agg(jsonb_build_object(
    'owner',pg_catalog.pg_get_userbyid(d.defaclrole),
    'schema',n.nspname,'objectType',d.defaclobjtype,
    'grants',(select coalesce(jsonb_object_agg(grantee_name,privileges),'{}'::jsonb)
              from (
                select pg_catalog.pg_get_userbyid(a.grantee) as grantee_name,
                       jsonb_agg(a.privilege_type order by a.privilege_type) as privileges
                from pg_catalog.aclexplode(d.defaclacl) as a
                where a.grantee<>0
                  and a.grantee not in ('anon'::regrole::oid,'authenticated'::regrole::oid)
                group by a.grantee
              ) as retained)
  ) order by d.defaclobjtype::text collate "C"),'[]'::jsonb) into v_actual_list
  from pg_catalog.pg_default_acl as d
  join pg_catalog.pg_namespace as n on n.oid=d.defaclnamespace
  where d.defaclrole='postgres'::regrole::oid and n.nspname='public'
    and d.defaclobjtype in ('r','S');
  select coalesce(jsonb_agg(item order by (item->>'objectType') collate "C"),'[]'::jsonb)
    into v_expected_list
  from jsonb_array_elements(v_contract->'defaultPrivileges') as rows(item);
  if v_actual_list is distinct from v_expected_list
     or exists (
       select 1 from pg_catalog.pg_default_acl as d
       cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
       where d.defaclrole='postgres'::regrole::oid
         and d.defaclnamespace='public'::regnamespace::oid
         and d.defaclobjtype in ('r','S') and a.is_grantable
     ) then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_default_acl_precondition_failed';
  end if;

  select array_agg(c.relname::text order by c.relname::text)
    into v_actual_names from pg_catalog.pg_class as c
  where c.relnamespace='public'::regnamespace::oid and c.relkind='S';
  select array_agg(item->>'name' order by item->>'name') into v_expected_names
  from jsonb_array_elements(v_effective_contract->'sequencePrivileges') as rows(item);
  if v_actual_names is distinct from v_expected_names
     or cardinality(v_expected_names) <> (
       select count(distinct item->>'name')
       from jsonb_array_elements(v_effective_contract->'sequencePrivileges') as rows(item)
     ) then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_sequence_inventory_mismatch';
  end if;

  select array_agg(item->>'name' order by item->>'name')
    into v_expected_names
  from jsonb_array_elements(v_effective_contract->'tables') as entry(item);

  if v_expected_names is null
     or cardinality(v_expected_names) <> (
       select count(distinct item->>'name')
       from jsonb_array_elements(v_effective_contract->'tables') as entry(item)
     )
     or exists (
       select 1
       from jsonb_array_elements(v_effective_contract->'tables') as entry(item)
       where item->>'classification' not in ('A','B')
          or item->>'owner' is distinct from 'postgres'
          or item->'forceRls' is distinct from 'false'::jsonb
          or item->'exception' is distinct from 'null'::jsonb
          or jsonb_typeof(item->'policies') is distinct from 'array'
          or jsonb_typeof(item->'grants') is distinct from 'object'
          or item->'grants'->'PUBLIC' is distinct from '[]'::jsonb
          or (item->>'classification' = 'B' and (
            item->'policies' is distinct from '[]'::jsonb
            or item->'grants'->'anon' is distinct from '[]'::jsonb
            or item->'grants'->'authenticated' is distinct from '[]'::jsonb
          ))
     ) then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_table_classification_is_invalid';
  end if;

  -- The effective inventory is either the historical checkpoint or the exact
  -- source-declared Existing-106 extension proven above. No live object is
  -- silently ignored or inferred from its current grants.
  select array_agg(relation.relname::text order by relation.relname::text)
    into v_actual_names
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public' and relation.relkind in ('r','p');

  if v_actual_names is distinct from v_expected_names then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_public_table_inventory_mismatch';
  end if;

  for v_table in
    select item from jsonb_array_elements(v_effective_contract->'tables') as entry(item)
    order by item->>'name'
  loop
    execute format('lock table only public.%I in access exclusive mode', v_table->>'name');
    v_relation := pg_catalog.to_regclass(format('public.%I', v_table->>'name'));
    if not exists (
      select 1 from pg_catalog.pg_class as relation
      where relation.oid = v_relation
        and relation.relkind = 'r'
        and not relation.relispartition
        and pg_catalog.pg_get_userbyid(relation.relowner) = v_table->>'owner'
        and relation.relforcerowsecurity = (v_table->>'forceRls')::boolean
    ) or exists (
      select 1 from pg_catalog.pg_inherits
      where inhrelid = v_relation or inhparent = v_relation
    ) then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_relation_identity_mismatch';
    end if;
  end loop;

  -- Preserve policies, ownership, FORCE, column ACLs, triggers and every ACL
  -- entry except the explicitly declared client/service-role transition.
  select jsonb_agg(jsonb_build_object(
    'table', relation.relname,
    'owner', relation.relowner,
    'force', relation.relforcerowsecurity,
    'policies', (select coalesce(jsonb_agg(to_jsonb(policy) order by policy.oid),'[]'::jsonb)
                 from pg_catalog.pg_policy as policy where policy.polrelid = relation.oid),
    'protectedAcl', (select coalesce(jsonb_agg(to_jsonb(acl) order by acl.grantor,acl.grantee,acl.privilege_type),'[]'::jsonb)
                     from pg_catalog.aclexplode(coalesce(relation.relacl,pg_catalog.acldefault('r',relation.relowner))) as acl
                     where acl.grantee <> 0
                       and acl.grantee not in ('anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)),
    'columns', (select coalesce(jsonb_agg(jsonb_build_object('number',column_row.attnum,'acl',column_row.attacl) order by column_row.attnum),'[]'::jsonb)
                 from pg_catalog.pg_attribute as column_row
                 where column_row.attrelid = relation.oid and column_row.attnum > 0 and not column_row.attisdropped),
    'triggers', (select coalesce(jsonb_agg(to_jsonb(trigger_row) order by trigger_row.oid),'[]'::jsonb)
                 from pg_catalog.pg_trigger as trigger_row where trigger_row.tgrelid = relation.oid)
  ) order by relation.relname) into v_invariants_before
  from pg_catalog.pg_class as relation
  where relation.oid in (
    select pg_catalog.to_regclass(format('public.%I', item->>'name'))
    from jsonb_array_elements(v_effective_contract->'tables') as entry(item)
  );

  for v_table in
    select item from jsonb_array_elements(v_effective_contract->'tables') as entry(item)
    order by item->>'name'
  loop
    v_relation := pg_catalog.to_regclass(format('public.%I', v_table->>'name'));

    select coalesce(jsonb_agg(jsonb_build_object(
      'name', policy.polname,
      'command', case policy.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                    when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end,
      'roles', (select jsonb_agg(case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end
                               order by case when role_oid = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end)
                from unnest(policy.polroles) as roles(role_oid)),
      'permissive', policy.polpermissive,
      'using', pg_catalog.pg_get_expr(policy.polqual,policy.polrelid),
      'withCheck', pg_catalog.pg_get_expr(policy.polwithcheck,policy.polrelid)
    ) order by policy.polname),'[]'::jsonb)
      into v_actual_policies
    from pg_catalog.pg_policy as policy where policy.polrelid = v_relation;

    select coalesce(jsonb_agg(policy order by policy->>'name'),'[]'::jsonb)
      into v_expected_policies
    from jsonb_array_elements(v_table->'policies') as policies(policy);
    if v_actual_policies is distinct from v_expected_policies then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_existing_policy_mismatch';
    end if;

    if exists (
      select 1 from pg_catalog.pg_attribute as column_row
      cross join lateral pg_catalog.aclexplode(column_row.attacl) as acl
      where column_row.attrelid = v_relation
        and column_row.attnum > 0 and not column_row.attisdropped
        and (acl.grantee = 0 or acl.grantee in ('anon'::regrole::oid,'authenticated'::regrole::oid))
    ) then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_unreviewed_client_column_acl';
    end if;

    if exists (
      select 1 from pg_catalog.pg_class as relation
      cross join lateral pg_catalog.aclexplode(coalesce(relation.relacl,pg_catalog.acldefault('r',relation.relowner))) as acl
      where relation.oid=v_relation and acl.is_grantable
        and (acl.grantee=0 or acl.grantee in (
          'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid
        ))
    ) then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_unreviewed_grant_options';
    end if;

    if not (select relrowsecurity from pg_catalog.pg_class where oid = v_relation) then
      execute format('alter table public.%I enable row level security', v_table->>'name');
    end if;
    execute format('revoke all privileges on table public.%I from public, anon, authenticated restrict', v_table->>'name');

    foreach v_role in array array['anon','authenticated']
    loop
      for v_privilege in select jsonb_array_elements_text(v_table->'grants'->v_role)
      loop
        if v_privilege <> 'SELECT' or v_table->>'classification' <> 'A' then
          raise exception using errcode = 'P0001',
            message = 'venisia_security_contract_client_grant_is_not_approved';
        end if;
        execute format('grant select on table public.%I to %I',v_table->>'name',v_role);
      end loop;
    end loop;

    -- Narrow service-role grants only where its reviewed target differs. Never
    -- promote an absent privilege or alter owner grants as a side effect.
    select coalesce(jsonb_agg(acl.privilege_type order by acl.privilege_type),'[]'::jsonb)
      into v_actual_list
    from pg_catalog.pg_class as relation
    cross join lateral pg_catalog.aclexplode(coalesce(relation.relacl,pg_catalog.acldefault('r',relation.relowner))) as acl
    where relation.oid=v_relation and acl.grantee='service_role'::regrole::oid;
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_expected_list
    from jsonb_array_elements(v_table->'grants'->'service_role');
    if not (v_actual_list @> v_expected_list) then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_service_privilege_expansion_not_approved';
    end if;
    if v_actual_list is distinct from v_expected_list then
      execute format('revoke all privileges on table public.%I from service_role restrict',v_table->>'name');
      for v_privilege in select jsonb_array_elements_text(v_expected_list)
      loop
        if v_privilege not in ('SELECT','INSERT','UPDATE','DELETE') then
          raise exception using errcode = 'P0001',
            message = 'venisia_security_contract_service_reduction_not_reviewed';
        end if;
        execute format('grant %s on table public.%I to service_role',v_privilege,v_table->>'name');
      end loop;
    end if;

    select coalesce(jsonb_object_agg(grantee_name,privileges),'{}'::jsonb)
      into v_actual_grants
    from (
      select case when acl.grantee = 0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee_name,
             jsonb_agg(acl.privilege_type order by acl.privilege_type) as privileges
      from pg_catalog.pg_class as relation
      cross join lateral pg_catalog.aclexplode(coalesce(relation.relacl,pg_catalog.acldefault('r',relation.relowner))) as acl
      where relation.oid = v_relation
      group by acl.grantee
    ) as actual;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
      into v_expected_grants from jsonb_each(v_table->'grants')
    where value <> '[]'::jsonb;
    if v_actual_grants is distinct from v_expected_grants
       or exists (
         select 1 from pg_catalog.pg_class
         where oid = v_relation and (not relrowsecurity or relforcerowsecurity)
       ) then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_table_postcondition_failed';
    end if;

    foreach v_role in array array['anon','authenticated','service_role']
    loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
      loop
        if pg_catalog.has_table_privilege(v_role,v_relation,v_privilege)
           is distinct from ((v_table->'grants'->v_role) ? v_privilege) then
          raise exception using errcode = 'P0001',
            message = 'venisia_security_contract_inherited_declared_privilege';
        end if;
      end loop;
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','REFERENCES']
      loop
        if pg_catalog.has_any_column_privilege(v_role,v_relation,v_privilege)
           is distinct from ((v_table->'grants'->v_role) ? v_privilege) then
          raise exception using errcode = 'P0001',
            message = 'venisia_security_contract_inherited_declared_column_privilege';
        end if;
      end loop;
    end loop;
  end loop;

  -- Sequences do not have RLS. Remove only client access; keep the reviewed
  -- privileged ACL, owner and sequence identity without reading sequence values.
  for v_sequence in
    select item from jsonb_array_elements(v_effective_contract->'sequencePrivileges') as rows(item)
    order by item->>'name'
  loop
    v_relation := pg_catalog.to_regclass(format('public.%I',v_sequence->>'name'));
    if not exists (
      select 1 from pg_catalog.pg_class as c
      where c.oid=v_relation and c.relkind='S'
        and pg_catalog.pg_get_userbyid(c.relowner)=v_sequence->>'owner'
    ) or exists (
      select 1 from pg_catalog.pg_class as c
      cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('s',c.relowner))) as a
      where c.oid=v_relation and a.is_grantable
    ) then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_sequence_identity_mismatch';
    end if;

    select coalesce(jsonb_object_agg(grantee_name,privileges),'{}'::jsonb)
      into v_actual_grants from (
        select pg_catalog.pg_get_userbyid(a.grantee) as grantee_name,
               jsonb_agg(a.privilege_type order by a.privilege_type) as privileges
        from pg_catalog.pg_class as c
        cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('s',c.relowner))) as a
        where c.oid=v_relation and a.grantee<>0
          and a.grantee not in ('anon'::regrole::oid,'authenticated'::regrole::oid)
        group by a.grantee
      ) as retained;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
      into v_expected_grants from jsonb_each(v_sequence->'grants')
      where value <> '[]'::jsonb;
    if v_actual_grants is distinct from v_expected_grants then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_sequence_privileged_acl_mismatch';
    end if;

    execute format('revoke all privileges on sequence public.%I from public, anon, authenticated restrict',v_sequence->>'name');
    select coalesce(jsonb_object_agg(grantee_name,privileges),'{}'::jsonb)
      into v_actual_grants from (
        select case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee_name,
               jsonb_agg(a.privilege_type order by a.privilege_type) as privileges
        from pg_catalog.pg_class as c
        cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('s',c.relowner))) as a
        where c.oid=v_relation group by a.grantee
      ) as actual;
    if v_actual_grants is distinct from v_expected_grants then
      raise exception using errcode = 'P0001',
        message = 'venisia_security_contract_sequence_postcondition_failed';
    end if;
    foreach v_role in array array['anon','authenticated']
    loop
      foreach v_privilege in array array['SELECT','UPDATE','USAGE']
      loop
        if pg_catalog.has_sequence_privilege(v_role,v_relation,v_privilege) then
          raise exception using errcode = 'P0001',
            message = 'venisia_security_contract_inherited_sequence_privilege';
        end if;
      end loop;
    end loop;
  end loop;

  -- The current creator has no global TABLE/SEQUENCE defaults. These scoped
  -- revokes therefore close future client exposure without touching official
  -- platform creators, other schemas, or function EXECUTE defaults.
  alter default privileges for role postgres in schema public
    revoke all privileges on tables from public, anon, authenticated;
  alter default privileges for role postgres in schema public
    revoke all privileges on sequences from public, anon, authenticated;

  select coalesce(jsonb_agg(jsonb_build_object(
    'owner',pg_catalog.pg_get_userbyid(d.defaclrole),
    'schema',n.nspname,'objectType',d.defaclobjtype,
    'grants',(select coalesce(jsonb_object_agg(grantee_name,privileges),'{}'::jsonb)
              from (
                select case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as grantee_name,
                       jsonb_agg(a.privilege_type order by a.privilege_type) as privileges
                from pg_catalog.aclexplode(d.defaclacl) as a group by a.grantee
              ) as actual)
  ) order by d.defaclobjtype::text collate "C"),'[]'::jsonb) into v_actual_list
  from pg_catalog.pg_default_acl as d
  join pg_catalog.pg_namespace as n on n.oid=d.defaclnamespace
  where d.defaclrole='postgres'::regrole::oid and n.nspname='public'
    and d.defaclobjtype in ('r','S');
  select coalesce(jsonb_agg(item order by (item->>'objectType') collate "C"),'[]'::jsonb)
    into v_expected_list
  from jsonb_array_elements(v_contract->'defaultPrivileges') as rows(item);
  if v_actual_list is distinct from v_expected_list then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_default_acl_postcondition_failed';
  end if;

  select jsonb_agg(jsonb_build_object(
    'table', relation.relname,
    'owner', relation.relowner,
    'force', relation.relforcerowsecurity,
    'policies', (select coalesce(jsonb_agg(to_jsonb(policy) order by policy.oid),'[]'::jsonb)
                 from pg_catalog.pg_policy as policy where policy.polrelid = relation.oid),
    'protectedAcl', (select coalesce(jsonb_agg(to_jsonb(acl) order by acl.grantor,acl.grantee,acl.privilege_type),'[]'::jsonb)
                     from pg_catalog.aclexplode(coalesce(relation.relacl,pg_catalog.acldefault('r',relation.relowner))) as acl
                     where acl.grantee <> 0
                       and acl.grantee not in ('anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)),
    'columns', (select coalesce(jsonb_agg(jsonb_build_object('number',column_row.attnum,'acl',column_row.attacl) order by column_row.attnum),'[]'::jsonb)
                 from pg_catalog.pg_attribute as column_row
                 where column_row.attrelid = relation.oid and column_row.attnum > 0 and not column_row.attisdropped),
    'triggers', (select coalesce(jsonb_agg(to_jsonb(trigger_row) order by trigger_row.oid),'[]'::jsonb)
                 from pg_catalog.pg_trigger as trigger_row where trigger_row.tgrelid = relation.oid)
  ) order by relation.relname) into v_invariants_after
  from pg_catalog.pg_class as relation
  where relation.oid in (
    select pg_catalog.to_regclass(format('public.%I', item->>'name'))
    from jsonb_array_elements(v_effective_contract->'tables') as entry(item)
  );
  if v_invariants_after is distinct from v_invariants_before then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_preserved_catalog_changed';
  end if;
  execute v_immutable_catalog_sql into v_immutable_after;
  if v_immutable_after is distinct from v_immutable_before then
    raise exception using errcode = 'P0001',
      message = 'venisia_security_contract_protected_platform_catalog_changed';
  end if;
end;
$venisia_security_adoption$;

commit;
