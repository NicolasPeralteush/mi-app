# Chatbot de WhatsApp - Il Milano

## Descripción
Chatbot automatizado para el restaurante Il Milano utilizando Node.js, WhatsApp Web API y Gemini AI de Google.

## Características
- ✅ Conexión con WhatsApp mediante Baileys
- ✅ Integración con Gemini IA para respuestas inteligentes
- ✅ Personalidad de chef italiano-cordobés
- ✅ Gestión completa de pedidos y reservas
- ✅ Registro de conversaciones
- ✅ Reconexión automática

## Requisitos Previos
- Node.js instalado
- Cuenta de WhatsApp para el bot
- API Key de Google Gemini

## Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   - Editar el archivo `.env`
   - Agregar tu API Key de Gemini:
   ```
   GEMINI_API_KEY=tu_api_key_aqui
   ```

3. **Personalizar el prompt del bot:**
   - Editar el archivo `prompt.txt` según tus necesidades

## Uso

### Iniciar el Bot
```bash
node index.js
```

### Primer Escaneo (Solo la primera vez)
1. Al iniciar, aparecerá un código QR en la terminal
2. Escanear el QR con WhatsApp Web en tu teléfono
3. El bot se conectará automáticamente y guardará la sesión

### Mensajes Automáticos
El bot responderá automáticamente a todos los mensajes entrantes con:
- Personalidad de chef italiano-cordobés
- Información del menú y precios
- Gestión de pedidos y delivery
- Horarios y contacto del local

## Estructura del Proyecto

```
milano/
├── index.js              # Código principal del bot
├── package.json          # Dependencias del proyecto
├── .env                  # Variables de entorno (API Key)
├── prompt.txt            # Personalidad y conocimiento del bot
├── registro_chats.txt    # Historial de conversaciones
├── auth_info_baileys/    # Sesión de WhatsApp (se crea automáticamente)
└── README.md            # Este archivo
```

## Funcionalidades del Bot

### 🍕 Menú Completo
- Milanesas (terna/pollo) con todas las variantes
- Pizzas al forno
- Hamburguesas y sándwiches
- Bebidas y vinos
- Postres (Dolci)

### 📦 Gestión de Pedidos
1. **Tipo de servicio:** Envío o retiro
2. **Toma de pedido:** Venta cruzada natural
3. **Datos del cliente:** Nombre, teléfono, dirección
4. **Confirmación:** Resumen completo
5. **Pago y tiempo:** Formas de pago y estimación

### 📅 Reservas
- Recopilación de datos completos
- Verificación de horarios
- Confirmación automática

### 🛠️ Soporte y Reclamos
- Detección automática de tipos de reclamos
- Respuestas empáticas y profesionales
- Derivación al equipo correspondiente

## Configuración de WhatsApp

### Número del Bot
El bot utiliza el número configurado en la sesión de WhatsApp.

### Mensajes de Ejemplo
- Cliente: "Hola, quiero pedir una milanesa"
- Bot: "¡Bene! ¿La querés de ternera o de pollo? Te aclaro que vienen con papas fritas incluidas 🤌"

## Archivos de Registro

### registro_chats.txt
Se guardan automáticamente todas las conversaciones:
```
[07/05/2026 23:12:45] 👤 Juan Pérez: Hola, quiero pedir una milanesa
🤖 Bot: ¡Bene! ¿La querés de ternera o de pollo? Te aclaro que vienen con papas fritas incluidas 🤌
---
```

## Solución de Problemas

### Conexión
- Si se pierde la conexión, el bot reconecta automáticamente
- Para nueva sesión, eliminar la carpeta `auth_info_baileys`

### API Gemini
- Verificar que la API Key sea válida
- Revisar cuota de uso de la API

### Mensajes no Responden
- Revisar la consola para errores
- Verificar conexión a internet

## Comandos Útiles

```bash
# Iniciar el bot
node index.js

# Ver logs en tiempo real
node index.js | tail -f

# Instalar nuevas dependencias
npm install nombre_paquete
```

## Información del Local

- **Nombre:** Il Milano
- **Dirección:** Av. Marcelo T. de Alvear 1150, Río Cuarto
- **Teléfono:** 358 4750808 / 358 4750909
- **WhatsApp:** 358 4175777
- **Horarios:** 11:30-14:30 y 19:30-00:00 todos los días
- **Slogan:** ¡Amore per i milanesi!

## Soporte Técnico

Para problemas técnicos:
1. Revisar este README
2. Verificar logs en la consola
3. Revisar el archivo `registro_chats.txt`
4. Comprobar configuración de `.env`

---

**¡Amore per i milanesi!** 🍝🤌
