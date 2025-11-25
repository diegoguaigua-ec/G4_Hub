# Configuración del Superadministrador

## ⚠️ Importante: Flujo de Aprobación de Cuentas

Todos los usuarios que se registran en el sistema **inician con estado "pending"** y **NO tienen acceso** al dashboard hasta que sean aprobados por un administrador.

Para que el sistema funcione correctamente, **DEBES crear manualmente el primer superadministrador** directamente en la base de datos.

## 📋 Pasos para Crear el Superadministrador

### Opción 1: Usar script SQL directo

1. **Conéctate a tu base de datos PostgreSQL/Neon**

2. **Ejecuta el siguiente script SQL** (reemplaza los valores según tus necesidades):

```sql
-- 1. Crear el tenant del superadmin (aprobado automáticamente)
INSERT INTO tenants (
  name,
  subdomain,
  plan_type,
  account_status,
  status,
  api_key
) VALUES (
  'Sistema Administrativo',           -- Nombre de la empresa
  'admin',                             -- Subdominio (será admin.g4hub.com)
  'enterprise',                        -- Plan (starter, professional, enterprise)
  'approved',                          -- ⚠️ IMPORTANTE: Debe ser 'approved'
  'active',
  encode(gen_random_bytes(32), 'hex') -- Genera API key automáticamente
) RETURNING id;

-- 2. Anotar el ID del tenant creado (ej: 1)
-- Úsalo en el siguiente paso

-- 3. Crear el usuario superadmin
INSERT INTO users (
  tenant_id,
  email,
  password_hash,
  name,
  role,
  email_verified
) VALUES (
  1,                                   -- ⚠️ Reemplazar con el tenant_id del paso 1
  'admin@g4hub.com',                  -- ⚠️ Email del superadmin
  -- Password hash for 'Admin123!' (cambiar según tu necesidad)
  '3f3e9b5d4c2a1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b.1234567890abcdef',
  'Super Administrador',               -- ⚠️ Nombre del admin
  'admin',                             -- ⚠️ IMPORTANTE: Debe ser 'admin'
  true                                 -- Email verificado
);
```

### Opción 2: Crear contraseña hasheada con Node.js

Si quieres usar tu propia contraseña, ejecuta este script de Node.js para generar el hash:

```bash
cd /home/user/G4_Hub
node -e "
const crypto = require('crypto');
const util = require('util');
const scryptAsync = util.promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return buf.toString('hex') + '.' + salt;
}

hashPassword('TU_CONTRASEÑA_AQUI').then(hash => {
  console.log('Password hash:', hash);
  console.log('');
  console.log('Usa este valor en el campo password_hash de la query SQL');
});
"
```

Luego usa el hash generado en el INSERT del usuario.

### Opción 3: Script completo automatizado

Guarda este script como `create-superadmin.sql` y ejecútalo:

```sql
-- Crear superadmin con contraseña 'Admin123!'
-- ⚠️ CAMBIA LA CONTRASEÑA en producción

BEGIN;

-- Crear tenant
INSERT INTO tenants (name, subdomain, plan_type, account_status, status, api_key)
VALUES (
  'Sistema Administrativo',
  'admin',
  'enterprise',
  'approved',
  'active',
  encode(gen_random_bytes(32), 'hex')
) RETURNING id INTO @tenant_id;

-- Crear usuario (la contraseña es 'Admin123!' - CAMBIAR en producción)
INSERT INTO users (tenant_id, email, password_hash, name, role, email_verified)
VALUES (
  @tenant_id,
  'admin@g4hub.com',
  'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2.0123456789abcdef',
  'Super Administrador',
  'admin',
  true
);

COMMIT;
```

## 🔐 Credenciales por Defecto

Si usas el script SQL de ejemplo:
- **Email**: `admin@g4hub.com`
- **Contraseña**: `Admin123!` (si usaste el hash de ejemplo)

⚠️ **IMPORTANTE**: Cambia estas credenciales inmediatamente después del primer login.

## 🚀 Flujo de Trabajo Completo

### 1. Crear el Superadmin (Pasos Anteriores)

### 2. Iniciar el Sistema

```bash
npm run dev
```

### 3. Ingresar como Superadmin

1. Ve a: `http://localhost:5000/auth`
2. Ingresa las credenciales del superadmin
3. Deberías ser redirigido al dashboard
4. En el sidebar verás la sección **ADMINISTRACIÓN**

### 4. Aprobar Nuevos Usuarios

Cuando alguien se registre:

1. El usuario verá un mensaje: "¡Registro exitoso! Tu cuenta está pendiente de aprobación"
2. Si intenta hacer login, verá: "Tu cuenta está pendiente de aprobación"
3. Como superadmin, ve a: `/dashboard/admin/users`
4. Verás el usuario en estado "Pendiente"
5. Haz clic en el menú (⋮) y selecciona "Aprobar"
6. El usuario recibirá acceso y podrás convertirlo en admin si es necesario

## 📊 Estructura de Roles

### Superadmin (role = 'admin')
- Tiene acceso a **TODAS** las rutas del sistema
- Puede acceder a `/dashboard/admin/*` (Panel Administrativo)
- Puede aprobar/rechazar/suspender cuentas
- Puede cambiar planes de usuarios
- **NO está sujeto** a verificación de `accountStatus` del tenant
- Puede aprobar otros tenants aunque su propio tenant esté "pending"

### Usuario Regular (role = 'user')
- Solo accede a rutas de su tenant
- **NO** puede acceder a `/dashboard/admin/*`
- **SÍ está sujeto** a verificación de `accountStatus`
- Si su tenant está "pending", es redirigido a `/pending`
- Si su tenant está "rejected" o "suspended", es redirigido a `/pending`

## 🔍 Verificar que Todo Funciona

### Test 1: Login como Superadmin
```
✓ Puedes hacer login
✓ Ves el dashboard
✓ Ves la sección "ADMINISTRACIÓN" en el sidebar
✓ Puedes acceder a /dashboard/admin
```

### Test 2: Registro de Usuario Normal
```
✓ Usuario se registra
✓ Ve mensaje de "pendiente de aprobación"
✓ NO puede hacer login (error 403)
✓ Aparece en /dashboard/admin/users como "Pendiente"
```

### Test 3: Aprobación de Usuario
```
✓ Superadmin aprueba la cuenta
✓ Usuario puede hacer login exitosamente
✓ Usuario ve el dashboard (sin sección admin)
✓ Acción queda registrada en logs de auditoría
```

## 🐛 Troubleshooting

### Error: "column account_status already exists"

La migración 0005 debería manejar esto automáticamente. Si persiste:

```sql
-- Verificar si la columna existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'account_status';

-- Si existe, la migración 0005 la omitirá automáticamente
```

### No puedo hacer login como superadmin

1. Verifica que el tenant tenga `account_status = 'approved'`:
```sql
SELECT id, name, subdomain, account_status FROM tenants WHERE subdomain = 'admin';
```

2. Verifica que el usuario tenga `role = 'admin'`:
```sql
SELECT id, email, role FROM users WHERE email = 'admin@g4hub.com';
```

3. Verifica la contraseña hasheada (debe tener formato: `hash.salt`)

### El usuario aprobado no puede hacer login

1. Verifica el `account_status` del tenant:
```sql
SELECT t.name, t.account_status, u.email, u.role
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'email@usuario.com';
```

2. Debe estar en `'approved'` para usuarios regulares

### No veo la sección de administración en el sidebar

1. Verifica que tu usuario tenga `role = 'admin'`
2. Refresca la página
3. Verifica en las DevTools que `user.role === "admin"`

## 📝 Cambiar Contraseña del Superadmin

Para cambiar la contraseña después del primer login:

1. Genera el nuevo hash (ver Opción 2 arriba)
2. Actualiza en la base de datos:

```sql
UPDATE users
SET password_hash = 'NUEVO_HASH_AQUI'
WHERE email = 'admin@g4hub.com';
```

## 🔒 Seguridad

- **NUNCA** uses las credenciales de ejemplo en producción
- **CAMBIA** la contraseña inmediatamente después del primer login
- **USA** contraseñas fuertes (mínimo 8 caracteres, mayúsculas, minúsculas, números)
- **ROTACIÓN**: Cambia la contraseña periódicamente
- **2FA**: Considera implementar autenticación de dos factores en el futuro

## 📚 Recursos Adicionales

- **Migraciones**: `/migrations/`
- **Schema**: `/shared/schema.ts`
- **Auth**: `/server/auth.ts`
- **Storage**: `/server/storage.ts`
- **Admin Routes**: `/server/routes/admin.ts`
