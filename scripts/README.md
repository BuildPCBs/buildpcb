# Scripts Directory

This directory contains utility scripts for managing BuildPCB data and database operations.

## Available Scripts

### `migrate_symbols_to_supabase.ts`

Migrates KiCad symbol data from local files to Supabase database.

```bash
npm run migrate:symbols
```

### `parse_kicad_symbols.ts`

Parses KiCad symbol files to extract pins, bbox, and inheritance relationships.

```bash
npm run parse:symbols
```

### `update_component_data.ts`

Updates existing components in the database with new metadata (bbox, extends relationships).

```bash
npm run update:components
```

### `check_components.ts`

Analyzes component data and provides detailed migration status report.

```bash
npm run check:components
```

### `populate-svg-symbols.ts`

Populates SVG symbol data in the database.

```bash
npm run populate:svgs
```

### `test_migration.ts`

Tests database migration operations.

```bash
npm run test:migration
```

## Usage

All scripts use environment variables from `.env.local` for Supabase configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Make sure these are set before running any database scripts.
