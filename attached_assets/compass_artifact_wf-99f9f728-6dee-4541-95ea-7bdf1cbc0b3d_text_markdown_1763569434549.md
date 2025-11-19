# Guía Técnica: Webhooks Programáticos y Seguridad HMAC en Shopify

**La implementación de webhooks en Shopify requiere usar la API GraphQL Admin (recomendada desde octubre 2024), autenticación OAuth 2.0, y validación HMAC obligatoria para seguridad.** Los webhooks de inventario tienen limitaciones importantes: solo los cambios en estados `available` y `on_hand` disparan notificaciones. El sistema soporta 150+ eventos diferentes, con límites estrictos de tiempo de respuesta (5 segundos) y reintentos automáticos (8 intentos en 4 horas). La documentación oficial en shopify.dev proporciona dos APIs principales para creación programática: REST Admin API (legacy) y GraphQL Admin API (actual estándar), ambas requiriendo permisos de lectura específicos según el recurso monitoreado. Para sincronización de inventario, implementar verificación HMAC-SHA256 es crítico para prevenir webhooks maliciosos, mientras que la gestión de duplicados mediante `X-Shopify-Event-Id` garantiza procesamiento idempotente.

## Creación programática de webhooks: dos APIs disponibles

Shopify ofrece dos métodos principales para crear webhooks automáticamente cuando un usuario conecta su tienda. **La API GraphQL Admin es ahora el enfoque recomendado** desde octubre 2024, mientras que la REST Admin API se considera legacy aunque sigue totalmente funcional. Ambas APIs permiten crear suscripciones webhook mediante código, con capacidades similares pero sintaxis diferente.

La **REST Admin API** utiliza endpoints HTTP tradicionales con el formato `POST https://{shop}.myshopify.com/admin/api/2025-10/webhooks.json`. Este método requiere un token de acceso enviado en el header `X-Shopify-Access-Token` y acepta payloads JSON que especifican el topic (evento), address (URL destino), y formato. El endpoint retorna un objeto webhook con ID único y metadatos de creación. Aunque funcional, Shopify indica que nuevas aplicaciones deberían preferir GraphQL.

La **GraphQL Admin API** representa el estándar actual, utilizando la mutación `webhookSubscriptionCreate` enviada al endpoint `/admin/api/2025-10/graphql.json`. Este enfoque ofrece ventajas significativas: filtrado avanzado de eventos mediante expresiones booleanas, modificación de payloads para incluir solo campos necesarios, y mejor integración con sistemas de entrega cloud como Google Pub/Sub y Amazon EventBridge. La sintaxis GraphQL también proporciona tipado fuerte y documentación auto-generada mediante introspección.

**Ambas APIs soportan tres métodos de entrega**: endpoints HTTPS (tradicional), Google Cloud Pub/Sub (recomendado para alto volumen), y Amazon EventBridge (ideal para arquitecturas AWS). La elección depende de la infraestructura existente y los requisitos de escalabilidad del sistema de sincronización de inventario.

## Autenticación OAuth 2.0 y gestión de permisos

El proceso de autenticación comienza con el **flujo OAuth 2.0 Authorization Code Grant**, donde la aplicación redirige al comerciante a Shopify para autorización. La URL de autorización incluye el client_id de la app, los scopes solicitados (permisos), una URI de redirección, y un nonce de seguridad. Shopify valida la solicitud, muestra al comerciante qué permisos se solicitan, y tras aprobación redirige con un código de autorización temporal.

El segundo paso requiere **intercambiar el código de autorización por un access token permanente**. La aplicación realiza una solicitud POST a `/admin/oauth/access_token` incluyendo el client_id, client_secret, y el código recibido. Shopify responde con un access token (formato `shpat_xxxxx`) que debe almacenarse de forma segura. Este token permite realizar llamadas API autenticadas indefinidamente hasta que el comerciante desinstale la aplicación.

Los **permisos necesarios para webhooks siguen una regla simple**: se requiere acceso de LECTURA al recurso monitoreado. Para crear un webhook de `orders/create`, la app necesita el scope `read_orders`. Para `inventory_levels/update`, se requiere `read_inventory`. Esto contradice algunos errores de documentación antigua que sugerían necesitar permisos de escritura. La validación de scopes ocurre al crear el webhook; solicitudes sin permisos adecuados son rechazadas con error 403.

**Tres tipos de aplicaciones manejan autenticación diferente**: aplicaciones embebidas usan session tokens y token exchange para obtener tokens online/offline; aplicaciones no-embebidas usan el flujo completo de authorization code grant; aplicaciones custom instaladas directamente desde el admin de Shopify reciben tokens inmediatamente sin OAuth. Para aplicaciones embebidas modernas, el patrón recomendado es usar session tokens JWT con el grant type `urn:ietf:params:oauth:grant-type:token-exchange`.

## Webhooks de inventario: eventos disponibles y limitaciones críticas

El sistema de webhooks de Shopify para inventario ofrece **seis eventos principales** divididos en dos categorías. Los webhooks de **Inventory Items** (`inventory_items/create`, `inventory_items/update`, `inventory_items/delete`) se disparan cuando se crean, modifican o eliminan ítems de inventario, requiriendo scope `read_inventory` o `read_products`. Los webhooks de **Inventory Levels** (`inventory_levels/connect`, `inventory_levels/disconnect`, `inventory_levels/update`) notifican cuando se conecta/desconecta inventario de una ubicación o cuando las cantidades cambian, requiriendo `read_inventory`.

**Una limitación crítica afecta directamente sistemas de sincronización**: el webhook `inventory_levels/update` solo se dispara para cambios en los estados `available` (disponible para venta) y `on_hand` (cantidad física total). Los cambios a otros estados de inventario NO generan webhooks, incluyendo `committed` (comprometido a órdenes), `reserved` (reservado temporalmente), `damaged` (dañado), `safety_stock` (stock de seguridad), y `quality_control` (en inspección). Esta restricción requiere estrategias alternativas como polling periódico para rastrear estos estados.

Para sincronización avanzada, Shopify también ofrece **webhooks de Inventory Transfers** (transferencias entre ubicaciones) e **Inventory Shipments** (envíos de inventario), cada uno con múltiples sub-eventos como `create`, `update`, `complete`, `cancel`, etc. Estos requieren scopes adicionales específicos (`read_inventory_transfers`, `read_inventory_shipments`) y son útiles para rastrear movimiento de inventario entre almacenes.

El payload de cada webhook incluye **datos completos del objeto modificado** en formato JSON, con la versión API especificada en el header `X-Shopify-API-Version`. Para inventario, esto incluye inventory_item_id, location_id, available quantity, updated_at timestamp, y otros campos relevantes. Los payloads pueden ser filtrados para incluir solo campos necesarios, reduciendo ancho de banda.

## HMAC: verificación criptográfica obligatoria de webhooks

**HMAC (Hash-based Message Authentication Code) es una firma criptográfica** que Shopify incluye en cada webhook para garantizar autenticidad e integridad. Cada solicitud webhook contiene el header `X-Shopify-Hmac-SHA256` con un valor base64 que actúa como firma digital. Este mecanismo previene ataques de terceros que intenten inyectar datos falsos enviando webhooks fraudulentos a su endpoint.

El algoritmo funciona así: Shopify toma el **raw request body completo** (sin parsear), calcula un hash HMAC-SHA256 usando el client secret de la aplicación como llave, codifica el resultado en base64, y envía este valor en el header. Para validar, la aplicación debe repetir exactamente el mismo proceso: extraer el body sin parsear, calcular HMAC-SHA256 con el mismo secret, codificar en base64, y comparar el resultado con el header recibido usando comparación timing-safe.

**El pitfall más común es el body parsing prematuro**. Frameworks como Express.js con middleware `express.json()` parsean el body antes de que el código de verificación pueda acceder al contenido raw. Esto hace imposible calcular el HMAC correctamente porque la re-serialización de JSON nunca produce exactamente el mismo string. La solución es usar `express.raw()` o `express.text()` para capturar el body sin modificar, validar HMAC primero, y solo después parsear el JSON.

La **comparación debe usar funciones timing-safe** para prevenir timing attacks. Node.js provee `crypto.timingSafeEqual()`, Ruby tiene `ActiveSupport::SecurityUtils.secure_compare()`, Python ofrece `hmac.compare_digest()`. Comparaciones simples con `==` o `===` son vulnerables porque el tiempo de ejecución varía según cuántos caracteres coinciden, permitiendo a atacantes deducir el hash correcto carácter por carácter.

**Consideraciones de seguridad adicionales** incluyen: nunca almacenar el client secret en código fuente (usar variables de entorno), rotar secrets periódicamente (toma hasta 1 hora que Shopify use el nuevo secret), responder siempre con 200 OK independientemente del resultado de validación (para no dar información a atacantes), y usar HTTPS con certificado válido (obligatorio por Shopify). Las aplicaciones distribuidas en el App Store deben implementar verificación HMAC obligatoriamente; es parte del proceso de revisión automatizado.

## Ejemplos de código para implementación práctica

### Crear webhook con GraphQL Admin API (Node.js)

```javascript
import { authenticate } from "../shopify.server";

export const createInventoryWebhook = async (request) => {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(
    `#graphql
    mutation webhookSubscriptionCreate(
      $topic: WebhookSubscriptionTopic!, 
      $webhookSubscription: WebhookSubscriptionInput!
    ) {
      webhookSubscriptionCreate(
        topic: $topic, 
        webhookSubscription: $webhookSubscription
      ) {
        webhookSubscription {
          id
          topic
          uri
          filter
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        "topic": "INVENTORY_LEVELS_UPDATE",
        "webhookSubscription": {
          "uri": "https://tu-dominio.com/webhooks/inventory",
          "filter": "location_id:12345"  // Opcional: filtrar por ubicación
        }
      },
    },
  );
  
  const json = await response.json();
  
  if (json.data.webhookSubscriptionCreate.userErrors.length > 0) {
    throw new Error(json.data.webhookSubscriptionCreate.userErrors[0].message);
  }
  
  return json.data.webhookSubscriptionCreate.webhookSubscription;
}
```

### Crear webhook con REST Admin API (Python)

```python
import requests
import json
import os

def create_inventory_webhook(shop_url, access_token):
    endpoint = f"{shop_url}/admin/api/2025-10/webhooks.json"
    
    headers = {
        "X-Shopify-Access-Token": access_token,
        "Content-Type": "application/json"
    }
    
    webhook_data = {
        "webhook": {
            "topic": "inventory_levels/update",
            "address": "https://tu-dominio.com/webhooks/inventory",
            "format": "json"
        }
    }
    
    response = requests.post(
        endpoint,
        headers=headers,
        data=json.dumps(webhook_data)
    )
    
    if response.status_code == 201:
        return response.json()["webhook"]
    else:
        raise Exception(f"Error creando webhook: {response.text}")

# Uso
shop = "https://tu-tienda.myshopify.com"
token = os.environ.get("SHOPIFY_ACCESS_TOKEN")
webhook = create_inventory_webhook(shop, token)
print(f"Webhook creado con ID: {webhook['id']}")
```

### Verificar firma HMAC (Node.js/Express)

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

// Middleware para capturar body raw
app.post('/webhooks/inventory', 
  express.raw({type: 'application/json'}), 
  (req, res) => {
    // 1. Extraer header HMAC
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    
    if (!hmacHeader) {
      return res.status(401).send('Missing HMAC header');
    }
    
    // 2. Calcular HMAC del body raw
    const calculatedHmac = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(req.body, 'utf8')  // req.body es Buffer
      .digest('base64');
    
    // 3. Comparación timing-safe
    const isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHmac, 'base64'),
      Buffer.from(hmacHeader, 'base64')
    );
    
    if (!isValid) {
      console.error('HMAC validation failed');
      return res.status(401).send('Invalid HMAC');
    }
    
    // 4. Parsear JSON solo después de validar
    const webhookData = JSON.parse(req.body.toString('utf8'));
    
    // 5. Verificar duplicados con Event ID
    const eventId = req.headers['x-shopify-event-id'];
    if (isDuplicate(eventId)) {
      return res.status(200).send('Duplicate webhook, ignored');
    }
    
    // 6. Procesar webhook (idealmente en cola asíncrona)
    processInventoryWebhook(webhookData)
      .then(() => {
        console.log('Webhook procesado exitosamente');
      })
      .catch(error => {
        console.error('Error procesando webhook:', error);
        // Aún así devolver 200 para evitar reintentos
      });
    
    // 7. Responder inmediatamente con 200
    res.status(200).send('Webhook received');
  }
);

function isDuplicate(eventId) {
  // Implementar lógica de verificación de duplicados
  // Por ejemplo, verificar en cache Redis o base de datos
  return false;
}

async function processInventoryWebhook(data) {
  // Implementar lógica de sincronización de inventario
  console.log('Actualizando inventario:', data);
}
```

### Verificar HMAC (Ruby)

```ruby
require 'openssl'
require 'base64'
require 'active_support/security_utils'

def verify_webhook_hmac(request)
  # Extraer datos del request
  hmac_header = request.headers['X-Shopify-Hmac-SHA256']
  body = request.body.read
  secret = ENV['SHOPIFY_API_SECRET']
  
  # Calcular HMAC
  calculated_hmac = Base64.strict_encode64(
    OpenSSL::HMAC.digest('sha256', secret, body)
  )
  
  # Comparación timing-safe
  ActiveSupport::SecurityUtils.secure_compare(calculated_hmac, hmac_header)
end

# En tu controller
post '/webhooks/inventory' do
  unless verify_webhook_hmac(request)
    halt 401, 'Invalid HMAC signature'
  end
  
  # Parsear JSON
  payload = JSON.parse(request.body.read)
  
  # Procesar webhook
  InventorySync.process(payload)
  
  status 200
  body 'OK'
end
```

### Registrar múltiples webhooks automáticamente (Shopify App Remix)

```javascript
import {shopifyApp, DeliveryMethod} from '@shopify/shopify-app-remix/server';

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  
  webhooks: {
    // Webhooks de inventario
    INVENTORY_LEVELS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks/inventory-levels',
    },
    INVENTORY_ITEMS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks/inventory-items',
    },
    
    // Webhooks obligatorios
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks/app-uninstalled',
    },
    
    // Webhooks de compliance GDPR
    CUSTOMERS_DATA_REQUEST: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks/gdpr/data-request',
    },
    CUSTOMERS_REDACT: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks/gdpr/redact',
    },
    SHOP_REDACT: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: '/webhooks/gdpr/shop-redact',
    },
  },
  
  hooks: {
    // Registrar webhooks automáticamente después de OAuth
    afterAuth: async ({session}) => {
      await shopify.registerWebhooks({session});
      console.log('Webhooks registrados para:', session.shop);
    },
  },
});

export default shopify;
```

## Rate limits y requisitos técnicos del endpoint

**Los límites de tasa de API varían según el tipo**: la GraphQL Admin API usa sistema de costos con 50 puntos/segundo para tiendas estándar y 500 puntos/segundo para Shopify Plus (10x mayor). Cada query GraphQL tiene un costo calculado basado en complejidad, con máximo 1,000 puntos por consulta individual. La REST Admin API usa límites más simples: 2 solicitudes/segundo para tiendas estándar (bucket de 40 requests) y 20 requests/segundo para Plus. Ambas APIs usan el algoritmo "leaky bucket" donde el bucket se rellena continuamente.

Los **límites específicos de webhooks son estrictos temporalmente**: Shopify requiere que el endpoint acepte la conexión en 1 segundo máximo y responda con código 200 en máximo 5 segundos totales. Si el endpoint falla estas restricciones, Shopify considera la entrega fallida. El sistema implementa 8 reintentos automáticos distribuidos durante 4 horas con intervalos crecientes. Después del octavo fallo consecutivo, Shopify elimina automáticamente la suscripción webhook (solo para webhooks creados vía Admin API).

**Requisitos obligatorios del endpoint HTTPS** incluyen: certificado SSL válido verificado por Shopify, aceptar solicitudes POST, responder con código 200 (no 201, 202, u otros 2xx), no retornar redirects 3xx (considerados errores), URL públicamente accesible (no localhost), y no terminar en "internal". Shopify verifica activamente certificados SSL al entregar webhooks; certificados inválidos o expirados causan fallos de entrega.

**Cada webhook incluye headers estándar** que la aplicación debe procesar: `X-Shopify-Topic` identifica el evento (ej: "inventory_levels/update"), `X-Shopify-Hmac-SHA256` contiene la firma HMAC para validación, `X-Shopify-Shop-Domain` indica la tienda origen, `X-Shopify-Webhook-Id` es un identificador único del webhook, `X-Shopify-Event-Id` permite detectar duplicados, `X-Shopify-Triggered-At` timestamp ISO 8601 de cuando ocurrió el evento, y `X-Shopify-API-Version` indica la versión API usada para serialización. Los nombres de headers son case-insensitive; el código debe manejar cualquier capitalización.

Para **alto volumen de webhooks**, Shopify recomienda usar Google Cloud Pub/Sub o Amazon EventBridge en lugar de HTTPS directo. Pub/Sub requiere configurar proyecto Google Cloud y cuenta de servicio, mientras EventBridge necesita cuenta AWS y configuración de event source partner. Estos métodos proveen mejor escalabilidad, reliability, y facilitan arquitecturas serverless.

## Mejores prácticas para sistemas de sincronización robustos

**La arquitectura de procesamiento debe separar recepción y procesamiento**: el endpoint webhook debe responder inmediatamente con 200 OK (en menos de 5 segundos) después de validar HMAC, luego encolar el payload en un sistema de colas asíncrono como Redis, RabbitMQ, o AWS SQS. Workers separados procesan la cola sin presión temporal, permitiendo operaciones complejas como actualizar bases de datos, sincronizar con sistemas externos, o hacer llamadas API adicionales. Este patrón evita timeouts y garantiza que Shopify no marque webhooks como fallidos.

**Implementar deduplicación es crítico** porque Shopify puede enviar el mismo webhook múltiples veces. Usar el header `X-Shopify-Event-Id` para rastrear eventos ya procesados, típicamente almacenando IDs en cache Redis con TTL de 24 horas o en tabla de base de datos con índice único. El procesamiento debe ser idempotente: ejecutar el mismo webhook dos veces debe producir el mismo resultado sin efectos secundarios duplicados. Esto protege contra actualizaciones dobles de inventario o notificaciones duplicadas.

**El ordenamiento de webhooks no está garantizado**: Shopify advierte explícitamente que webhooks pueden llegar desordenados. Un `inventory_levels/update` de incremento puede llegar antes que el `inventory_items/create` correspondiente. Usar timestamps del header `X-Shopify-Triggered-At` o del payload para ordenar eventos correctamente. Implementar lógica de reconciliación que maneje dependencias entre eventos, potencialmente encolando eventos "futuros" temporalmente hasta que sus prerequisitos lleguen.

**Construir jobs de reconciliación periódicos** es una best practice esencial. Webhooks usan "best effort delivery" y no son 100% garantizados. Un job cron que ejecuta cada hora puede llamar a las APIs de Shopify para verificar que el estado local coincide con el estado real, detectando cualquier webhook perdido. Para inventario, esto significa consultar `/admin/api/2025-10/inventory_levels.json` periódicamente y comparar con la base de datos local.

**Monitorear la salud de webhooks** mediante el dashboard de Partners de Shopify muestra métricas de entrega de los últimos 7 días. Si la tasa de éxito baja de 95%, investigar logs para identificar causas: timeouts, errores de validación HMAC, problemas de certificado SSL, o excepciones no manejadas. Configurar alertas cuando webhooks comienzan a fallar, porque 8 fallos consecutivos resultan en eliminación automática de la suscripción.

**Seguridad adicional incluye** almacenar el client secret en gestor de secretos (AWS Secrets Manager, Google Secret Manager, HashiCorp Vault) en lugar de variables de entorno simples, rotar secrets periódicamente (planear 1 hora de downtime porque Shopify tarda en adoptar el nuevo secret), validar también el header `X-Shopify-Shop-Domain` para confirmar que el webhook proviene de una tienda que tu app conoce, implementar rate limiting en el endpoint webhook para prevenir ataques DDoS, y usar TLS 1.2+ con cipher suites fuertes.

**Para desarrollo y testing**, Shopify CLI provee comando `shopify app webhook trigger --topic inventory_levels/update` que envía un webhook de prueba con payload de ejemplo al endpoint configurado. Usar túneles como ngrok o cloudflare tunnel para exponer localhost durante desarrollo. Los webhooks generados automáticamente en el admin de Shopify (no vía API) no pueden validarse correctamente con HMAC, por lo que siempre crear webhooks programáticamente para desarrollo y producción.

## Webhooks obligatorios de compliance GDPR

**Tres webhooks son mandatorios para todas las aplicaciones** distribuidas en el Shopify App Store, relacionados con regulaciones GDPR y protección de datos: `customers/data_request` notifica cuando un cliente solicita sus datos personales (derecho de acceso), `customers/redact` indica que datos de cliente deben ser eliminados (derecho al olvido), y `shop/redact` se dispara cuando una tienda desinstala la app y requiere eliminar todos sus datos después de 48 horas.

La **implementación de estos webhooks es verificada** durante el proceso de revisión automatizado de apps. El endpoint debe responder correctamente y la lógica de procesamiento debe cumplir con los requisitos legales. Para `customers/data_request`, la app debe recopilar todos los datos del cliente almacenados y enviarlos a Shopify dentro de 30 días. Para `customers/redact`, eliminar o anonimizar datos del cliente específico. Para `shop/redact`, eliminar completamente todos los datos de la tienda.

Estos webhooks se configuran típicamente en el archivo `shopify.app.toml` o mediante la sección de webhooks del Partner Dashboard, no necesariamente vía API programática. Sin embargo, la lógica de validación HMAC y procesamiento debe implementarse con el mismo rigor que otros webhooks.

## Configuración mediante archivo TOML para deployment automatizado

El **archivo de configuración shopify.app.toml** permite definir webhooks de forma declarativa que se registran automáticamente en todas las tiendas donde se instala la app. Este approach es ideal para webhooks estándar que todas las instalaciones necesitan, como eventos de inventario, productos, u órdenes.

```toml
# Configuración de scopes requeridos
[access_scopes]
scopes = "read_products,read_inventory,read_orders"
optional_scopes = ["read_customers"]

# Configuración de webhooks
[webhooks]
api_version = "2025-10"

# Webhooks de inventario
[[webhooks.subscriptions]]
topics = ["inventory_levels/update", "inventory_items/update"]
uri = "https://api.tu-empresa.com/shopify/webhooks/inventory"

# Webhooks de productos
[[webhooks.subscriptions]]
topics = ["products/update"]
uri = "https://api.tu-empresa.com/shopify/webhooks/products"
filter = "status:active"

# Webhooks GDPR obligatorios
[[webhooks.subscriptions]]
topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://api.tu-empresa.com/shopify/webhooks/gdpr"
```

Este archivo vive en el repositorio de código, permitiendo version control de la configuración de webhooks. Cambios al archivo requieren redesplegar la app. Para webhooks específicos por tienda (como filtros personalizados por ubicación de inventario), usar la GraphQL Admin API para crear suscripciones dinámicas después de la instalación.

## Conclusión: implementación lista para producción

Implementar webhooks de Shopify para sincronización de inventario requiere combinar varios componentes técnicos críticos. **La estrategia recomendada** es usar GraphQL Admin API para crear suscripciones webhook después del flujo OAuth, implementar validación HMAC rigurosa con comparación timing-safe sobre el body raw, responder inmediatamente con 200 OK mientras se encola el procesamiento asíncrono, detectar duplicados mediante Event ID, y construir jobs de reconciliación periódicos que detecten webhooks perdidos.

Las **limitaciones de webhooks de inventario** (solo estados `available` y `on_hand` generan notificaciones) requieren estrategia híbrida: usar webhooks para actualizaciones en tiempo real de disponibilidad y polling periódico via API REST o GraphQL para otros estados como `committed` o `reserved`. Esta combinación garantiza sincronización completa sin sobrecarga innecesaria de requests.

**Seguridad es no-negociable**: validación HMAC debe implementarse correctamente con el body sin parsear, client secrets deben almacenarse en gestores de secretos seguros, endpoints deben usar HTTPS con certificados válidos, y el sistema debe manejar apropiadamente duplicados y eventos desordenados. Estos requisitos son verificados durante app review y son críticos para proteger datos de comerciantes.

Finalmente, **monitoreo continuo y alertas** previenen problemas de producción. Configurar alertas cuando webhooks comienzan a fallar, revisar el dashboard de Partners regularmente, implementar logging detallado de validaciones HMAC y procesamiento de webhooks, y mantener métricas de latencia de procesamiento. Un sistema robusto de sincronización de inventario combina webhooks tiempo-real, reconciliación periódica, y respuestas resilientes a fallos.