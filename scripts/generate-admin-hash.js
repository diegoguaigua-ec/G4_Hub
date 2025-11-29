#!/usr/bin/env node

/**
 * Script para generar hash de password para usuario administrador
 * Uso: node scripts/generate-admin-hash.js "TuPasswordAqui"
 */

import bcrypt from 'bcryptjs';

async function generateHash() {
  const password = process.argv[2];

  if (!password) {
    console.error('❌ Error: Debes proporcionar un password');
    console.log('\nUso:');
    console.log('  node scripts/generate-admin-hash.js "TuPasswordSeguro123!"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Error: El password debe tener al menos 8 caracteres');
    process.exit(1);
  }

  console.log('🔐 Generando hash de password...\n');

  try {
    // Generar hash con bcryptjs (10 rounds)
    const hash = await bcrypt.hash(password, 10);

    console.log('✅ Hash generado exitosamente!\n');
    console.log('━'.repeat(80));
    console.log('📋 HASH DEL PASSWORD:');
    console.log('━'.repeat(80));
    console.log(hash);
    console.log('━'.repeat(80));
    console.log('\n📝 Usa este hash en tu query SQL:\n');
    console.log(`INSERT INTO users (
  tenant_id,
  email,
  password_hash,
  name,
  role,
  email_verified
) VALUES (
  1,  -- ⚠️ Reemplaza con el ID de tu tenant
  'admin@g4hub.com',
  '${hash}',  -- ← Hash generado
  'Administrador Sistema',
  'admin',
  true
);`);
    console.log('\n✨ ¡Listo para usar en producción!\n');

  } catch (error) {
    console.error('❌ Error al generar hash:', error.message);
    process.exit(1);
  }
}

generateHash();
