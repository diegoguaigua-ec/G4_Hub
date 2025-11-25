#!/usr/bin/env node

/**
 * Script para crear un superadministrador en la base de datos
 *
 * Uso:
 *   node scripts/create-superadmin.js <email> <password> [nombre]
 *
 * Ejemplo:
 *   node scripts/create-superadmin.js admin@g4hub.com Admin123! "Super Admin"
 */

const crypto = require('crypto');
const util = require('util');
const scryptAsync = util.promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return buf.toString('hex') + '.' + salt;
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Error: Faltan argumentos');
    console.error('');
    console.error('Uso:');
    console.error('  node scripts/create-superadmin.js <email> <password> [nombre]');
    console.error('');
    console.error('Ejemplo:');
    console.error('  node scripts/create-superadmin.js admin@g4hub.com Admin123! "Super Admin"');
    process.exit(1);
  }

  const email = args[0];
  const password = args[1];
  const name = args[2] || 'Super Administrador';

  console.log('🔧 Generando credenciales...');
  console.log('');

  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();

  console.log('✅ Credenciales generadas. Copia y ejecuta este SQL en tu base de datos:');
  console.log('');
  console.log('─'.repeat(80));
  console.log('');
  console.log(`BEGIN;

-- 1. Crear tenant del superadmin
INSERT INTO tenants (name, subdomain, plan_type, account_status, status, api_key)
VALUES (
  'Sistema Administrativo',
  'admin',
  'enterprise',
  'approved',
  'active',
  '${apiKey}'
) RETURNING id;

-- ⚠️ IMPORTANTE: Anota el ID que se muestra arriba y reemplázalo en la siguiente query

-- 2. Crear usuario superadmin
INSERT INTO users (tenant_id, email, password_hash, name, role, email_verified)
VALUES (
  1,  -- ⚠️ REEMPLAZA este 1 con el ID del tenant del paso anterior
  '${email}',
  '${passwordHash}',
  '${name}',
  'admin',
  true
);

COMMIT;`);
  console.log('');
  console.log('─'.repeat(80));
  console.log('');
  console.log('📋 Resumen de Credenciales:');
  console.log('');
  console.log(`  Email:        ${email}`);
  console.log(`  Contraseña:   ${password}`);
  console.log(`  Nombre:       ${name}`);
  console.log(`  Rol:          admin`);
  console.log(`  Plan:         enterprise`);
  console.log(`  Estado:       approved`);
  console.log('');
  console.log('⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro.');
  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
