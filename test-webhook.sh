#!/bin/bash

# Script para probar el webhook de Shopify manualmente
# Simula una orden pagada con un producto
# Este endpoint NO requiere HMAC (solo para desarrollo/pruebas)

# URL del webhook de prueba
WEBHOOK_URL="http://localhost:5000/api/webhooks/shopify/5/test"

# Opción 1: Enviar con payload personalizado
# Payload de ejemplo (orden pagada con 1 producto)
PAYLOAD='{
  "id": 999999,
  "order_number": 1234,
  "name": "#TEST-1234",
  "email": "test@example.com",
  "line_items": [
    {
      "id": 111111,
      "variant_id": 222222,
      "sku": "TEST-SKU-001",
      "name": "Producto de Prueba",
      "title": "Producto de Prueba",
      "quantity": 2
    }
  ]
}'

echo "🧪 Enviando webhook de prueba a: $WEBHOOK_URL"
echo "📦 Payload:"
echo "$PAYLOAD" | jq . 2>/dev/null || echo "$PAYLOAD"
echo ""

# Enviar webhook
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo ""
echo "✅ Webhook enviado. Revisa la consola del servidor para ver:"
echo "   - [Webhook][Test] 🧪 Prueba de webhook..."
echo "   - [Webhook][Test] ✅ X movimientos encolados..."
echo ""
echo "💡 Opción 2: Puedes enviar sin payload (usará uno por defecto):"
echo "   curl -X POST $WEBHOOK_URL -H 'Content-Type: application/json' -d '{}'"
