#!/bin/bash

# Script para debuggear webhooks de Shopify
echo "🔍 Debuggeando configuración de webhooks..."
echo ""

STORE_ID=8
BASE_URL="https://workspace.diegoguaigua.repl.co"

# 1. Verificar salud del servidor
echo "1️⃣ Verificando que el servidor está accesible..."
curl -s "${BASE_URL}/api/webhooks/health" | jq . 2>/dev/null || echo "❌ Servidor no accesible"
echo ""

# 2. Probar endpoint de test
echo "2️⃣ Probando endpoint de webhook de test..."
curl -s -X POST "${BASE_URL}/api/webhooks/shopify/${STORE_ID}/test" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 999999,
    "order_number": 1234,
    "name": "#TEST-1234",
    "email": "test@example.com",
    "line_items": [
      {
        "sku": "TEST-SKU-001",
        "name": "Producto de Prueba",
        "quantity": 2
      }
    ]
  }' | jq . 2>/dev/null || echo "❌ Error en endpoint de test"
echo ""

# 3. Simular webhook real de Shopify
echo "3️⃣ Simulando webhook real de Shopify (sin HMAC - solo para verificar)..."
curl -s -X POST "${BASE_URL}/api/webhooks/shopify/${STORE_ID}" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/paid" \
  -H "X-Shopify-Shop-Domain: g4-hub-test.myshopify.com" \
  -H "X-Shopify-Hmac-Sha256: fake-hmac-for-testing" \
  -d '{
    "id": 5555555,
    "order_number": 1001,
    "name": "#1001",
    "email": "customer@example.com",
    "line_items": [
      {
        "id": 111111,
        "variant_id": 222222,
        "sku": "REAL-SKU-001",
        "name": "Producto Real",
        "title": "Producto Real",
        "quantity": 1
      }
    ]
  }'
echo ""
echo ""

echo "✅ Tests completados. Revisa la consola del servidor para ver los logs."
echo ""
echo "📝 Próximos pasos:"
echo "   1. Si el endpoint de test funciona, el código está bien"
echo "   2. Si el servidor no es accesible, verifica la configuración de Replit"
echo "   3. Ve a Shopify Admin > Settings > Notifications > Webhooks"
echo "   4. Revisa si hay errores en las entregas de webhooks"
echo "   5. Asegúrate de crear un pedido PAGADO en Shopify (no draft)"
