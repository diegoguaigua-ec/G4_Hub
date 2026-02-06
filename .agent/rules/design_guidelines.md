---
trigger: model_decision
---

# G4 Hub - Diseño de Plataforma SaaS

## Enfoque de Diseño

**Sistema Seleccionado**: Inspiración en Linear + Stripe Dashboard
- Linear: Tipografía limpia, espaciado consistente, interfaces enfocadas en eficiencia
- Stripe: Profesionalismo, jerarquía clara de información, formularios impecables
- Justificación: Herramienta B2B que prioriza productividad y claridad de datos sobre creatividad visual

## Tipografía

**Familias de Fuentes** (Google Fonts CDN):
- Primary: Inter (400, 500, 600, 700) - UI, navegación, datos
- Monospace: JetBrains Mono (400, 500) - códigos de API, IDs, logs técnicos

**Escala Tipográfica**:
- Display: 32px/40px (Headlines principales)
- H1: 24px/32px semibold (Títulos de página)
- H2: 20px/28px semibold (Secciones)
- H3: 16px/24px semibold (Subsecciones)
- Body: 14px/20px regular (Contenido general)
- Small: 12px/16px regular (Labels, metadatos)
- Caption: 11px/14px medium (Badges, timestamps)

## Sistema de Espaciado

**Primitivas Tailwind**: Usar exclusivamente 2, 3, 4, 6, 8, 12, 16, 24
- Componentes densos: p-2, gap-3, m-4
- Secciones estándar: py-8, px-6
- Separadores grandes: py-16, gap-12
- Márgenes de página: p-6 en mobile, p-8 en desktop

## Biblioteca de Componentes

### Navegación
**Sidebar Principal** (240px fijo desktop):
- Logo G4 Hub arriba
- Menú items: Py-3, px-4, gap-3, íconos 20px izquierda
- Secciones: Dashboard, Integraciones, Automatizaciones, Pedidos, Inventario, Reportes, Configuración
- Avatar usuario + nombre abajo
- Collapse en tablet/mobile a hamburger

**Topbar** (64px altura):
- Breadcrumbs izquierda
- Search bar centro (max-w-md)
- Notificaciones + perfil derecha

### Formularios de Autenticación

**Login/Registro Layout**:
- Split screen: 50% branding izquierda (hero image), 50% formulario derecha
- Formulario: max-w-sm, centrado vertical y horizontalmente
- Logo G4 Hub arriba del formulario
- Título claro ("Inicia sesión" / "Crear cuenta")

**Password Input con Toggle**:
- Input height: h-12
- Toggle button: absolute right-3, Heroicons eye/eye-slash 20px
- Estados: outlined default, focus ring-2
- Helper text debajo si necesario

**Campos de Formulario**:
- Labels: text-sm, medium, mb-2
- Inputs: h-12, px-4, rounded-lg, border
- Spacing entre campos: space-y-4
- Botón submit: full width, h-12, semibold

### Dashboard Components

**Cards de Métrica**:
- Padding: p-6
- Estructura: Título + valor grande + cambio porcentual + sparkline opcional
- Border radius: rounded-xl
- Sombra sutil

**Tablas de Datos**:
- Headers: sticky top, bg separate, text-xs uppercase semibold
- Rows: h-14, border-b, hover state
- Acciones: iconos derecha, dropdown menu
- Paginación abajo

**Estado Badges**:
- Tamaños: px-3, py-1, rounded-full, text-xs medium
- Estados: Activo, Pausado, Error, Sincronizando, Completado

### Integraciones

**Integration Cards** (Grid 2 columnas desktop):
- Logo servicio (Shopify/WooCommerce/Contífico) 48px
- Estado conexión con badge
- Última sincronización timestamp
- Botón "Configurar" o "Conectar"
- Padding: p-6, gap-4

### Botones

**Jerarquía**:
- Primary: h-10, px-6, rounded-lg, medium
- Secondary: h-10, px-6, rounded-lg, border, medium
- Ghost: h-10, px-3, no border
- Icon only: w-10, h-10, rounded-lg

**Botones sobre imágenes** (Hero/Cards):
- Backdrop blur: backdrop-blur-md
- Semi-transparent background
- Border sutil
- Padding: px-6, py-3

## Iconografía

**Librería**: Heroicons (outline primary, solid para estados activos)
- Navegación: 20px
- Actions/Buttons: 20px
- Inline icons: 16px
- Status indicators: 12px

## Layout General

**Container System**:
- Dashboard content: max-w-7xl, mx-auto
- Formularios: max-w-sm centrado
- Tablas: full width con padding horizontal

**Responsive Breakpoints**:
- Mobile: Sidebar collapse, stack cards
- Tablet (md): 2 columnas grids
- Desktop (lg): Layout completo, sidebar fijo

## Páginas Específicas

### Landing Page (Marketing)

**Estructura** (7 secciones):

1. **Hero** (90vh):
   - Split: 60% izquierda contenido, 40% derecha dashboard preview image
   - Headline: "Automatiza tu e-commerce LATAM con un solo clic"
   - Subheadline + 2 CTAs (Comenzar gratis + Ver demo)
   - Trust badge: "Conectado con Contífico, Shopify y WooCommerce"

2. **Integraciones** (py-20):
   - Grid 3 columnas con logos grandes de plataformas
   - Cada card: Logo + descripción breve + "Conectar"

3. **Features Grid** (py-24):
   - 2x3 grid (6 features)
   - Iconos 32px, títulos H3, descripciones
   - Features: Sincronización automática, Multi-tienda, Inventario tiempo real, Facturación integrada, Reportes analytics, Soporte 24/7

4. **Dashboard Preview** (py-20):
   - Screenshot grande del dashboard con anotaciones
   - Highlight: métricas en vivo, automatizaciones, integraciones

5. **Pricing** (py-24):
   - 3 columnas: Básico, Profesional, Empresarial
   - Cards con features list + CTA
   - Badge "Más popular" en Profesional

6. **Testimonios** (py-20):
   - 3 cards con cliente photo, quote, nombre + empresa
   - Logos de empresas clientes debajo

7. **CTA Final** (py-32):
   - Centrado, headline bold
   - "Empieza tu prueba gratuita de 14 días"
   - Formulario email inline + botón
   - Texto pequeño: "No requiere tarjeta de crédito"

**Footer** (py-16):
- 4 columnas: Producto, Recursos, Empresa, Legal
- Newsletter signup
- Social icons
- Copyright + idioma selector

## Imágenes Requeridas

1. **Hero Landing**: Dashboard screenshot profesional mostrando métricas, gráficas y panel de integraciones (1200x800px mínimo)
2. **Dashboard Preview Section**: Vista amplia del dashboard con datos ficticios (1400x900px)
3. **Login Split Screen**: Abstract tech/network visual profesional (800x1000px vertical)
4. **Cliente Testimonios**: 3 fotos profesionales de personas (200x200px circular)

## Animaciones

**Uso Mínimo**:
- Hover states en cards: lift sutil (scale-102, sombra)
- Skeleton loaders en tablas
- Success/error toasts: slide-in desde top
- NO scroll-triggered animations
- NO parallax effects