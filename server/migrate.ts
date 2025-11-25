import 'dotenv/config';
import { db } from './db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Read all migration files
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration files`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(filePath, 'utf-8');

      // Split by statement breakpoint
      const statements = migrationSql
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`  ⚡ Running ${file} (${statements.length} statements)...`);

      for (const statement of statements) {
        try {
          await db.execute(sql.raw(statement));
        } catch (error: any) {
          // Ignore "already exists" errors
          // 42P07 = table already exists
          // 42710 = function already exists
          // 42701 = column already exists
          // 42P16 = index already exists
          // 23505 = unique constraint violation (for CREATE ... IF NOT EXISTS workarounds)
          if (error.code === '42P07' || error.code === '42710' || error.code === '42701' || error.code === '42P16' || error.code === '23505') {
            console.log(`    ⏭️  Skipped (already exists)`);
          } else {
            throw error;
          }
        }
      }

      console.log(`    ✅ Completed ${file}`);
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

export { runMigrations };
