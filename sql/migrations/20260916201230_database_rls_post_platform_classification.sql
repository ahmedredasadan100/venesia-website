-- Venesia public-table security declaration, platform-aware revision 2.
-- Official CLI-created identity: 20260916201230 (2026-09-16); no backdating.
-- This follows the existing application suffix through Entity SEO enforcement.
-- Captured isolated catalog: 61 tables / A3 + B58 and 40 sequences.
-- Preserve revision 1's 56 table entries, policies and protected metadata exactly.
-- Add only the five existing server-only tables and two Featured sequences.
--
-- This is declaration and read-only verification only. It does not grant or
-- revoke privileges, alter RLS/policies, rewrite prior receipts, or create a
-- persistent table/function/runtime. Featured service-role ALL privileges are
-- recorded as observed existing grants, not asserted to be newly minimized.
-- Existing-database / Production application is not authorized by this source.
-- The existing reconciliation loader consumes this full explicit revision.

begin;

do $database_security_revision2$
declare
  v_contract constant jsonb :=
  $venisia_security_contract$
{
  "formatVersion": 2,
  "contractId": "venisia-public-table-security",
  "revision": 2,
  "supersedes": {
    "revision": 1,
    "migrationVersion": "20260819040000",
    "migrationSourceSha256": "a904a37e1c52ea13fe891b3698d606e7536b1f7cffe0346ef7c62cc8e24f8ce2"
  },
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
  v_prior_record record;
  v_prior jsonb;
  v_parts text[];
  v_tag constant text := chr(36) || 'venisia_security_contract' || chr(36);
  v_snapshot jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_table jsonb;
  v_observed_table jsonb;
  v_sequence jsonb;
  v_field text;
  v_role text;
  v_access_roles text[];
  v_client_roles text[];
  v_ddl_roles text[];
  v_tooling_roles text[];
  v_table_privileges constant text[] := array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
  v_column_privileges constant text[] := array['SELECT','INSERT','UPDATE','REFERENCES'];
  -- Verbatim read-only projection from captureDatabaseSecurityCatalog in
  -- scripts/lib/database-rls-security-contract.mts; source guard binds it there.
  v_catalog_projection constant text := $security_catalog_projection$
    with roles as (select oid,rolname from pg_catalog.pg_roles),
    relations as (select c.* from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname=$1 and c.relkind in ('r','p','S')),
    table_acl as (select c.oid,c.relowner,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,
      a.privilege_type,a.is_grantable from relations c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a),
    acl_group as (select oid,role,jsonb_agg(privilege_type order by privilege_type) as privileges,
      coalesce(jsonb_agg(privilege_type order by privilege_type) filter(where is_grantable),'[]'::jsonb) as grantable
      from table_acl group by oid,role),
    acl_maps as (select oid,jsonb_object_agg(role,privileges) as grants,jsonb_object_agg(role,grantable) as grant_options from acl_group group by oid),
    policy_rows as (select p.polrelid,jsonb_build_object('name',p.polname,'command',case p.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' when '*' then 'ALL' end,
      'roles',(select jsonb_agg(case when role_oid=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role_oid) end order by role_oid) from unnest(p.polroles) role_oid),
      'permissive',p.polpermissive,'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'withCheck',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) as policy
      from pg_catalog.pg_policy p),
    column_acl as (select c.relname,a.attname,case when x.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(x.grantee) end as role,
      x.privilege_type,x.is_grantable from relations c join pg_catalog.pg_attribute a on a.attrelid=c.oid
      cross join lateral pg_catalog.aclexplode(a.attacl) x where a.attnum>0 and not a.attisdropped),
    column_group as (select relname,attname,role,jsonb_agg(privilege_type order by privilege_type) as privileges,
      coalesce(jsonb_agg(privilege_type order by privilege_type) filter(where is_grantable),'[]'::jsonb) as grantable from column_acl group by relname,attname,role),
    default_acl as (select d.oid,pg_catalog.pg_get_userbyid(d.defaclrole) as owner,n.nspname as schema,d.defaclobjtype::text as object_type,
      case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,a.privilege_type
      from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
      cross join lateral pg_catalog.aclexplode(d.defaclacl) a
      where pg_catalog.pg_get_userbyid(d.defaclrole)=any($2::text[]) and d.defaclobjtype in ('r','S') and (d.defaclnamespace=0 or n.nspname=$1)),
    default_group as (select oid,owner,schema,object_type,role,jsonb_agg(privilege_type order by privilege_type) as privileges from default_acl group by oid,owner,schema,object_type,role),
    default_maps as (select oid,owner,schema,object_type,jsonb_object_agg(role,privileges) as grants from default_group group by oid,owner,schema,object_type),
    function_rows as (select p.oid,p.proowner,p.prosecdef,p.proacl,p.oid::regprocedure::text as identity
      from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.prokind in ('f','p')),
    function_acl as (select f.oid,f.identity,f.prosecdef,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,
      a.privilege_type,a.is_grantable from function_rows f cross join lateral
      pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) a),
    default_function_acl as (select pg_catalog.pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'') schema,
      case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end role,a.privilege_type
      from pg_catalog.pg_default_acl d left join pg_catalog.pg_namespace n on n.oid=d.defaclnamespace
      cross join lateral pg_catalog.aclexplode(d.defaclacl) a where d.defaclobjtype='f'
      and pg_catalog.pg_get_userbyid(d.defaclrole)=any($2::text[]) and (d.defaclnamespace=0 or n.nspname=$1)),
    schema_acl as (select n.oid,case when a.grantee=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(a.grantee) end as role,a.privilege_type
      from pg_catalog.pg_namespace n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where n.nspname=$1)
    select jsonb_build_object('schema',$1::text,
      'tables',coalesce((select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),
        'rlsEnabled',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'grants',coalesce(a.grants,'{}'::jsonb),'grantOptions',coalesce(a.grant_options,'{}'::jsonb),
        'policies',coalesce((select jsonb_agg(policy order by policy->>'name') from policy_rows where polrelid=c.oid),'[]'::jsonb),
        'effectivePrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest($3::text[]) privilege where pg_catalog.has_table_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($5::text[])),
        'effectiveColumnPrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest($4::text[]) privilege where pg_catalog.has_any_column_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($5::text[]))) order by c.relname)
        from relations c left join acl_maps a on a.oid=c.oid where c.relkind in ('r','p')),'[]'::jsonb),
      'roles',(select coalesce(jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls,'inherit',rolinherit,'canLogin',rolcanlogin,
        'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication) order by rolname),'[]'::jsonb) from pg_catalog.pg_roles),
      'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',pg_catalog.pg_get_userbyid(roleid),'member',pg_catalog.pg_get_userbyid(member),'inheritOption',inherit_option,'setOption',set_option,'adminOption',admin_option) order by roleid,member),'[]'::jsonb) from pg_catalog.pg_auth_members),
      'schemaPrivileges',(select jsonb_agg(jsonb_build_object('role',role,'privileges',privileges) order by role) from (
        select r.rolname as role,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest(array['CREATE','USAGE']) privilege where pg_catalog.has_schema_privilege(r.oid,$1,privilege)) as privileges from roles r where r.rolname=any($5::text[])
        union all select 'PUBLIC',coalesce((select jsonb_agg(privilege_type order by privilege_type) from schema_acl where role='PUBLIC'),'[]'::jsonb)) all_schema_roles),
      'defaultPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('owner',owner,'schema',schema,'objectType',object_type,'grants',grants) order by owner,schema,object_type),'[]'::jsonb) from default_maps),
      'columnPrivileges',(select coalesce(jsonb_agg(jsonb_build_object('table',relname,'column',attname,'role',role,'privileges',privileges,'grantable',grantable) order by relname,attname,role),'[]'::jsonb) from column_group),
      'sequencePrivileges',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_catalog.pg_get_userbyid(c.relowner),'grants',coalesce(a.grants,'{}'::jsonb),
        'effectivePrivileges',(select jsonb_object_agg(r.rolname,(select coalesce(jsonb_agg(privilege order by privilege),'[]'::jsonb) from unnest(array['SELECT','UPDATE','USAGE']) privilege where pg_catalog.has_sequence_privilege(r.oid,c.oid,privilege))) from roles r where r.rolname=any($6::text[]))) order by c.relname),'[]'::jsonb) from relations c left join acl_maps a on a.oid=c.oid where c.relkind='S')
      ,'functionSecurity',jsonb_build_object(
        'clientExecutable',(select coalesce(jsonb_agg(identity order by identity),'[]'::jsonb) from function_rows f
          where exists(select 1 from roles r where r.rolname=any($6::text[]) and pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE'))),
        'securityDefinerClientExecutable',(select coalesce(jsonb_agg(identity order by identity),'[]'::jsonb) from function_rows f where f.prosecdef
          and exists(select 1 from roles r where r.rolname=any($6::text[]) and pg_catalog.has_function_privilege(r.oid,f.oid,'EXECUTE'))),
        'clientGrantOptions',(select coalesce(jsonb_agg(distinct identity order by identity),'[]'::jsonb) from function_acl
          where (role='PUBLIC' or role=any($6::text[])) and is_grantable),
        'defaultClientExecute',(select coalesce(jsonb_agg(distinct owner||'/'||schema||'/'||role order by owner||'/'||schema||'/'||role),'[]'::jsonb)
          from default_function_acl where privilege_type='EXECUTE' and (role='PUBLIC' or role=any($6::text[])))
      ),
      'toolingRoles',(select coalesce(jsonb_agg(jsonb_build_object('name',a.rolname,'passwordConfigured',a.rolpassword is not null,
        'validUntil',a.rolvaliduntil::text,'activeSessions',(select count(*) from pg_catalog.pg_stat_activity s where s.usename=a.rolname),
        'ownsApplicationObjects',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relowner=a.oid)
          +(select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.proowner=a.oid),
        'directApplicationAclEntries',(select count(*) from relations c cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) x where x.grantee=a.oid)
          +(select count(*) from function_rows f cross join lateral pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) x where x.grantee=a.oid)
      ) order by a.rolname),'[]'::jsonb) from pg_catalog.pg_authid a where a.rolname=any($7::text[]))
    ) as document
  $security_catalog_projection$;
begin
  if current_user <> 'postgres' then
    raise exception using errcode='P0001', message='database_security_revision2_requires_migration_role';
  end if;
  if v_contract->>'formatVersion' is distinct from '2'
    or v_contract->>'contractId' is distinct from 'venisia-public-table-security'
    or v_contract->>'revision' is distinct from '2'
    or v_contract->>'schema' is distinct from 'public'
    or v_contract->'supersedes' is distinct from jsonb_build_object(
      'revision',1,'migrationVersion','20260819040000',
      'migrationSourceSha256','a904a37e1c52ea13fe891b3698d606e7536b1f7cffe0346ef7c62cc8e24f8ce2') then
    raise exception using errcode='P0001', message='database_security_revision2_identity_mismatch';
  end if;
  -- Require the actual reviewed predecessor, never a metadata-only claim that
  -- an unrelated database previously applied the declared security contract.
  lock table supabase_migrations.schema_migrations in share mode;
  select * into v_prior_record from supabase_migrations.schema_migrations
  where version='20260819040000' and name='database_rls_security_contract';
  if not found then
    raise exception using errcode='P0001', message='database_security_revision2_predecessor_missing';
  end if;
  if v_prior_record.statements is null or cardinality(v_prior_record.statements)=0 then
    raise exception using errcode='P0001', message='database_security_revision2_predecessor_receipt_mismatch';
  end if;
  v_parts := string_to_array(array_to_string(v_prior_record.statements,E'\n'),v_tag);
  if cardinality(v_parts) is distinct from 3 then
    raise exception using errcode='P0001', message='database_security_revision2_predecessor_declaration_ambiguous';
  end if;
  v_prior := v_parts[2]::jsonb;
  if v_prior->>'revision' is distinct from '1'
    or v_prior->'supersedes' is distinct from 'null'::jsonb
    or (v_contract - array['revision','supersedes','tables','sequencePrivileges']) is distinct from
      (v_prior - array['revision','supersedes','tables','sequencePrivileges']) then
    raise exception using errcode='P0001', message='database_security_revision2_prior_metadata_changed';
  end if;

  -- The full new declaration may append classifications only. Every prior
  -- table/sequence entry must remain exactly the same source-owned JSON value.
  foreach v_field in array array['tables','sequencePrivileges']
  loop
    select coalesce(jsonb_agg(next_entry order by (next_entry->>'name') collate "C"),'[]'::jsonb)
      into v_actual
    from jsonb_array_elements(v_contract->v_field) next_entry
    where exists (select 1 from jsonb_array_elements(v_prior->v_field) prior_entry
      where prior_entry->>'name'=next_entry->>'name');
    select coalesce(jsonb_agg(value order by (value->>'name') collate "C"),'[]'::jsonb)
      into v_expected from jsonb_array_elements(v_prior->v_field);
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='database_security_revision2_prior_entry_changed';
    end if;
  end loop;
  if jsonb_array_length(v_contract->'tables') <> jsonb_array_length(v_prior->'tables') + 5
    or jsonb_array_length(v_contract->'sequencePrivileges') <> jsonb_array_length(v_prior->'sequencePrivileges') + 2
    or exists (select 1 from jsonb_array_elements(v_contract->'tables') next_entry
      where not exists (select 1 from jsonb_array_elements(v_prior->'tables') prior_entry
          where prior_entry->>'name'=next_entry->>'name')
        and (next_entry->>'classification' is distinct from 'B'
          or next_entry->'policies' is distinct from '[]'::jsonb
          or next_entry->'exception' is distinct from 'null'::jsonb
          or exists (select 1 from jsonb_each(next_entry->'grants')
            where key in ('PUBLIC','anon','authenticated') and value<>'[]'::jsonb))) then
    raise exception using errcode='P0001', message='database_security_revision2_unreviewed_extension';
  end if;

  select array_agg(value order by value collate "C") into v_client_roles
  from jsonb_array_elements_text(v_contract->'clientRoles');
  select array_agg(value order by value collate "C") into v_ddl_roles
  from jsonb_array_elements_text(v_contract->'ddlRoles');
  select coalesce(array_agg(value->>'name' order by (value->>'name') collate "C"),array[]::text[]) into v_tooling_roles
  from jsonb_array_elements(v_contract->'roles') where value->>'classification'='conditional-platform-tooling';
  select array_agg(role order by role collate "C") into v_access_roles from (
    select unnest(v_client_roles) as role union select unnest(v_ddl_roles)
    union select key from jsonb_array_elements(v_contract->'tables') t
      cross join lateral jsonb_each(t->'grants') where key<>'PUBLIC'
  ) as access;
  execute v_catalog_projection into v_snapshot using v_contract->>'schema',v_ddl_roles,
    v_table_privileges,v_column_privileges,v_access_roles,v_client_roles,v_tooling_roles;
  if v_snapshot->>'schema' is distinct from v_contract->>'schema' then
    raise exception using errcode='P0001', message='database_security_revision2_security_catalog_unavailable';
  end if;

  if exists (select 1 from jsonb_array_elements(v_snapshot->'roles') observed where not exists (
      select 1 from jsonb_array_elements(v_contract->'roles') declared where declared->>'name'=observed->>'name'
    )) or exists (select 1 from jsonb_array_elements(v_contract->'roles') declared
      where declared->>'presence'='required' and not exists (
        select 1 from jsonb_array_elements(v_snapshot->'roles') observed where observed->>'name'=declared->>'name'
      )) then
    raise exception using errcode='P0001', message='database_security_revision2_role_classification_drift';
  end if;
  for v_table in select value from jsonb_array_elements(v_contract->'roles')
  loop
    select value into v_observed_table from jsonb_array_elements(v_snapshot->'roles') where value->>'name'=v_table->>'name';
    if v_observed_table is null then continue; end if;
    if exists(select 1 from jsonb_each_text(v_table->'attributeRules') rule
      where (rule.value='deny' and (v_observed_table->>rule.key)::boolean)
         or (rule.value='require' and not (v_observed_table->>rule.key)::boolean)
         or rule.value not in ('deny','require','allow')) then
      raise exception using errcode='P0001', message='database_security_revision2_role_attribute_drift';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(v_snapshot->'memberships') observed where not exists (
      select 1 from jsonb_array_elements(v_contract->'memberships') rule
      where (observed-array['presence','classification'])=(rule-array['presence','classification'])
    )) or exists(select 1 from jsonb_array_elements(v_contract->'memberships') rule
      where rule->>'presence'='required' and not exists (
        select 1 from jsonb_array_elements(v_snapshot->'memberships') observed
        where observed=(rule-array['presence','classification'])
      )) then
    raise exception using errcode='P0001', message='database_security_revision2_role_membership_drift';
  end if;
  if exists (with recursive reachable(client,reached_role) as (
      select value collate "C",value collate "C" from jsonb_array_elements_text(v_contract->'clientRoles')
      union
      select reachable.client collate "C",(membership->>'role') collate "C" from reachable
      join lateral jsonb_array_elements(v_snapshot->'memberships') membership
        on membership->>'member'=reachable.reached_role
      where (membership->>'inheritOption')::boolean or (membership->>'setOption')::boolean or (membership->>'adminOption')::boolean
    ) select 1 from reachable join lateral (
      select value from jsonb_array_elements(v_snapshot->'roles') where value->>'name'=reachable.reached_role
    ) role on true where reachable.reached_role<>reachable.client and (
      (role.value->>'superuser')::boolean or (role.value->>'bypassRls')::boolean
      or (role.value->>'createRole')::boolean or (role.value->>'createDb')::boolean
      or (role.value->>'replication')::boolean or reachable.reached_role='service_role'
    )) then
    raise exception using errcode='P0001', message='database_security_revision2_application_role_escalation_path';
  end if;
  if exists(select 1 from jsonb_array_elements(v_snapshot->'roles') where value->>'name'='cli_login_postgres')
    and not exists(select 1 from jsonb_array_elements(v_snapshot->'toolingRoles') tooling
      where tooling->>'name'='cli_login_postgres'
        and (tooling->>'passwordConfigured')::boolean
        and tooling->>'validUntil' is not null
        and (tooling->>'activeSessions')::integer=0
        and (tooling->>'ownsApplicationObjects')::integer=0
        and (tooling->>'directApplicationAclEntries')::integer=0) then
    raise exception using errcode='P0001', message='database_security_revision2_conditional_tooling_drift';
  end if;
  if v_snapshot->'functionSecurity'->'clientExecutable' is distinct from v_contract->'functionSecurity'->'allowClientExecute'
    or v_snapshot->'functionSecurity'->'securityDefinerClientExecutable' is distinct from '[]'::jsonb
    or v_snapshot->'functionSecurity'->'clientGrantOptions' is distinct from '[]'::jsonb
    or v_snapshot->'functionSecurity'->'defaultClientExecute' is distinct from '[]'::jsonb then
    raise exception using errcode='P0001', message='database_security_revision2_function_security_drift';
  end if;
  foreach v_field in array array['schemaPrivileges','defaultPrivileges','columnPrivileges']
  loop
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_actual from jsonb_array_elements(v_snapshot->v_field);
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_expected from jsonb_array_elements(v_contract->v_field);
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='database_security_revision2_security_metadata_drift';
    end if;
  end loop;
  select coalesce(jsonb_agg(value->'name' order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_actual from jsonb_array_elements(v_snapshot->'tables');
  select coalesce(jsonb_agg(value->'name' order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_expected from jsonb_array_elements(v_contract->'tables');
  if v_actual is distinct from v_expected then
    raise exception using errcode='P0001', message='database_security_revision2_unclassified_or_missing_table';
  end if;

  for v_table in select value from jsonb_array_elements(v_contract->'tables')
  loop
    select value into strict v_observed_table from jsonb_array_elements(v_snapshot->'tables')
    where value->>'name'=v_table->>'name';
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_expected
    from jsonb_each(v_table->'grants') where value<>'[]'::jsonb;
    if v_observed_table->>'owner' is distinct from v_table->>'owner'
      or v_observed_table->'forceRls' is distinct from v_table->'forceRls'
      or v_observed_table->>'rlsEnabled' is distinct from 'true'
      or v_observed_table->'grants' is distinct from v_expected
      or exists (select 1 from jsonb_each(v_observed_table->'grantOptions')
        where key<>v_table->>'owner' and value<>'[]'::jsonb) then
      raise exception using errcode='P0001', message='database_security_revision2_table_security_drift';
    end if;
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_actual from jsonb_array_elements(v_observed_table->'policies');
    select coalesce(jsonb_agg(value order by value::text collate "C"),'[]'::jsonb)
      into v_expected from jsonb_array_elements(v_table->'policies');
    if v_actual is distinct from v_expected then
      raise exception using errcode='P0001', message='database_security_revision2_policy_definition_drift';
    end if;
    foreach v_role in array v_access_roles
    loop
      select coalesce(jsonb_agg(privilege order by privilege collate "C"),'[]'::jsonb)
        into v_expected from (
          select jsonb_array_elements_text(coalesce(v_table->'grants'->v_role,'[]'::jsonb)) as privilege
          union select jsonb_array_elements_text(coalesce(v_table->'grants'->'PUBLIC','[]'::jsonb))
        ) as allowed;
      if v_observed_table->'effectivePrivileges'->v_role is distinct from v_expected then
        raise exception using errcode='P0001', message='database_security_revision2_effective_table_privilege_drift';
      end if;
      select coalesce(jsonb_agg(value order by value collate "C"),'[]'::jsonb)
        into v_expected from jsonb_array_elements_text(v_expected)
        where value=any(v_column_privileges);
      if v_observed_table->'effectiveColumnPrivileges'->v_role is distinct from v_expected then
        raise exception using errcode='P0001', message='database_security_revision2_effective_column_privilege_drift';
      end if;
    end loop;
  end loop;

  select coalesce(jsonb_agg(value-'effectivePrivileges' order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_actual from jsonb_array_elements(v_snapshot->'sequencePrivileges');
  select coalesce(jsonb_agg(value order by (value->>'name') collate "C"),'[]'::jsonb)
    into v_expected from jsonb_array_elements(v_contract->'sequencePrivileges');
  if v_actual is distinct from v_expected then
    raise exception using errcode='P0001', message='database_security_revision2_sequence_security_drift';
  end if;
  for v_sequence in select value from jsonb_array_elements(v_snapshot->'sequencePrivileges')
  loop
    foreach v_role in array v_client_roles
    loop
      if v_sequence->'effectivePrivileges'->v_role is distinct from '[]'::jsonb then
        raise exception using errcode='P0001', message='database_security_revision2_effective_sequence_privilege_drift';
      end if;
    end loop;
  end loop;
  if exists (select 1 from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) a
    where pg_catalog.pg_get_userbyid(d.defaclrole)=any(v_ddl_roles)
      and d.defaclobjtype in ('r','S')
      and (d.defaclnamespace=0 or d.defaclnamespace='public'::regnamespace::oid)
      and a.is_grantable)
    or exists (select 1 from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('s',c.relowner))) a
      where c.relnamespace='public'::regnamespace::oid and c.relkind='S' and a.is_grantable) then
    raise exception using errcode='P0001', message='database_security_revision2_default_or_sequence_grant_option_drift';
  end if;

  -- No catalog or data write follows. The official CLI records only this new
  -- successful declaration revision; earlier provenance remains unchanged.
end;
$database_security_revision2$;

commit;
