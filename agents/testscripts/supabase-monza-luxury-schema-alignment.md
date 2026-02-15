## Testscript: Supabase luxury schema alignment (garage-advisory)

Objective: Verify the Monza luxury-car tables + FKs exist and match the docs.

Prereqs:
- Supabase access to project `garage-advisory` (`xgtlnyemulgdebyweqlf`).

Run (via SQL editor, `supabase_execute_sql`, or psql):

```sql
-- 1) Expected tables present
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name in (
    'listings',
    'vehicle_specs',
    'pricing',
    'auction_info',
    'location_data',
    'provenance_data',
    'vehicle_history',
    'photos_media',
    'price_history',
    'condition_history',
    'market_segments',
    'market_analytics'
  )
order by table_name;

-- 2) FK integrity checks (should return 0 rows)
select conname, conrelid::regclass as child_table
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
  and conrelid::regclass::text in (
    'public.vehicle_specs',
    'public.pricing',
    'public.auction_info',
    'public.location_data',
    'public.provenance_data',
    'public.vehicle_history',
    'public.photos_media',
    'public.price_history',
    'public.condition_history',
    'public.market_analytics'
  )
  and confrelid::regclass::text not in (
    'public.listings',
    'public.market_segments'
  );

-- 3) Listings uniqueness constraints (should return 2 rows)
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.listings'::regclass
  and contype = 'u'
order by conname;

-- 4) Price history composite PK (should show listing_id,time)
select a.attname
from pg_index i
join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
where i.indrelid = 'public.price_history'::regclass
  and i.indisprimary
order by a.attnum;
```

Expected observations:
- All 12 tables appear in step (1).
- Step (2) returns 0 rows.
- Step (3) shows unique constraints on `(source_url)` and `(source, source_id)`.
- Step (4) shows PK columns include `listing_id` and `time`.

Notes:
- TimescaleDB hypertables are not enabled in Supabase by default; `price_history` and `condition_history` are regular Postgres tables.
