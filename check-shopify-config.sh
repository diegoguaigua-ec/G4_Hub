#!/bin/bash

echo "🔍 Verificando configuración de Shopify..."
echo ""

# 1. Verificar URL de Replit
echo "1️⃣ URL de Replit:"
if [ -n "$REPL_SLUG" ] && [ -n "$REPL_OWNER" ]; then
  REPL_URL="https://${REPL_SLUG}.${REPL_OWNER}.repl.co"
  echo "   $REPL_URL"
else
  echo "   ⚠️ Variables REPL_SLUG o REPL_OWNER no configuradas"
  echo "   Esta es tu URL pública:"
  curl -s https://api.replit.com/v0/repls/@$USER/$(basename $(pwd))/url 2>/dev/null || echo "   No se pudo obtener automáticamente"
fi
echo ""

# 2. Verificar acceso público
echo "2️⃣ Verificando acceso público al servidor:"
if [ -n "$REPL_URL" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${REPL_URL}/api/webhooks/health" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "   ✅ Servidor accesible públicamente"
  else
    echo "   ❌ Servidor no accesible (HTTP $STATUS)"
  fi
else
  echo "   ⏩ Saltando (URL no disponible)"
fi
echo ""

# 3. Instrucciones para verificar permisos de Shopify
echo "3️⃣ Verificar permisos del Access Token de Shopify:"
echo ""
echo "   📝 Tu access token debe tener estos permisos:"
echo "   - ✅ write_products (para actualizar stock)"
echo "   - ✅ read_products (para leer productos)"
echo "   - ✅ write_inventory (para actualizar inventario)"
echo "   - ✅ read_inventory (para leer inventario)"
echo "   - ✅ write_orders (para webhooks de órdenes)"
echo "   - ✅ read_orders (para webhooks de órdenes)"
echo ""
echo "   🔧 Cómo verificar/configurar:"
echo "   1. Ve a Shopify Admin > Settings > Apps and sales channels"
echo "   2. Click en 'Develop apps'"
echo "   3. Selecciona tu app o crea una nueva"
echo "   4. Ve a 'Configuration' > 'Admin API integration'"
echo "   5. Marca todos los permisos listados arriba"
echo "   6. Guarda y regenera el access token si es necesario"
echo ""

# 4. URL del webhook que se configurará
echo "4️⃣ URL del webhook que se configurará en Shopify:"
if [ -n "$REPL_URL" ]; then
  echo "   ${REPL_URL}/api/webhooks/shopify/[STORE_ID]"
  echo ""
  echo "   Ejemplo para tienda 8:"
  echo "   ${REPL_URL}/api/webhooks/shopify/8"
else
  echo "   https://[TU-REPL-URL]/api/webhooks/shopify/[STORE_ID]"
fi
echo ""

echo "✅ Verificación completada"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Copia la URL de Replit mostrada arriba"
echo "   2. Verifica que tu access token tenga todos los permisos necesarios"
echo "   3. Reconecta la tienda en el dashboard para que use la URL correcta"
echo "   4. Los webhooks se crearán automáticamente con los permisos correctos"
