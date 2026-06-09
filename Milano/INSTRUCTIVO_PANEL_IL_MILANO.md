# Instructivo Basico - Panel Il Milano

Este instructivo esta pensado para alguien que sabe poco o nada de programacion.
Segui los pasos en orden.

---

## 1) Que hace el panel

Con el panel podes:

- Ver conversaciones de WhatsApp.
- Tomar un chat (asignartelo).
- Pausar y reactivar el bot en ese chat.
- Responder manualmente.
- Marcar el chat como procesado.
- Ver reportes (hoy, semana, mes).

---

## 2) Requisitos minimos

Necesitas:

- Tener instalado Node.js.
- Tener el proyecto en tu PC (carpeta `Milano`).
- Tener acceso al archivo `.env`.

---

## 3) Configurar usuario admin (login)

El login del panel usa usuario y contrasena.

### Paso 3.1 - Abrir el archivo `.env`

En la raiz del proyecto (`Milano`) abri el archivo:

- `.env`

### Paso 3.2 - Agregar estas lineas

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=PEGAR_HASH_AQUI
```

> `ADMIN_PASSWORD_HASH` NO es la contrasena en texto plano.
> Es el hash SHA256 de tu contrasena.

### Paso 3.3 - Generar el hash de tu contrasena (PowerShell)

Ejemplo (cambia `TuClave123` por la clave real):

```powershell
$pwd="TuClave123"
$bytes=[System.Text.Encoding]::UTF8.GetBytes($pwd)
$hash=[BitConverter]::ToString((New-Object Security.Cryptography.SHA256Managed).ComputeHash($bytes)).Replace("-","").ToLower()
$hash
```

Copias el resultado y lo pegas en:

- `ADMIN_PASSWORD_HASH=...`

---

## 4) Iniciar el sistema

En una terminal, dentro de la carpeta del proyecto:

```bash
node index.js
```

Si todo esta bien, el panel queda en:

- `http://localhost:3000`

---

## 5) Usar el panel (muy simple)

1. Abri `http://localhost:3000`
2. Inicia sesion con tu usuario admin.
3. Elegi un chat de la lista.
4. Hace clic en **Tomar chat**.
5. Si queres escribir vos:
   - Hace clic en **Pausar bot**.
   - Escribi en el cuadro.
   - Hace clic en **Enviar**.
6. Cuando termines el pedido:
   - Hace clic en **Marcar procesado**.
7. Si queres soltar el chat:
   - Hace clic en **Liberar**.

---

## 6) Reportes

Arriba vas a ver:

- Pedidos procesados dia
- Pedidos procesados semana
- Pedidos procesados mes

Importante:

- En este sistema, un "pedido entrado/procesado" se cuenta cuando marcas el chat como **Procesado**.

---

## 7) Agregar mas usuarios admin

Tambien podes cargar varios admins usando `ADMIN_USERS_JSON` en `.env`.

Ejemplo:

```env
ADMIN_USERS_JSON=[{"username":"admin1","passwordHash":"HASH1"},{"username":"admin2","passwordHash":"HASH2"}]
```

Cada `passwordHash` se genera igual que en el paso 3.3.

---

## 8) Usuarios sin rol de admin (importante)

En la version actual del panel:

- **No existe rol "usuario comun" o "solo lectura"**.
- Los usuarios definidos en login son admins.
- Si una persona no esta en admins, no puede entrar al panel.

### Entonces, como agregar usuarios sin admin hoy?

No se puede de forma real con esta version.

Opciones:

1. **Practica recomendada ahora**: no darle acceso al panel.
2. **Si queres, se puede implementar** en una mejora:
   - Rol `viewer` (solo ver)
   - Rol `admin` (operar chats)

Si queres, te lo puedo dejar implementado en una segunda etapa.

---

## 9) Exportarlo a PDF (editable primero)

Este archivo `.md` es editable con cualquier editor de texto.

Para pasarlo a PDF facil:

1. Abri este archivo en Cursor o VS Code.
2. Usa la vista previa de Markdown.
3. Imprimir -> Guardar como PDF.

Tambien podes copiar el contenido a Word y guardarlo como PDF.

---

## 10) Errores comunes

- "No puedo loguear":
  - Revisar `ADMIN_USERNAME`.
  - Revisar `ADMIN_PASSWORD_HASH`.
  - Volver a generar hash de la clave.

- "No puedo pausar/enviar":
  - Primero tenes que hacer **Tomar chat**.
  - Si el chat lo tiene otro admin, no te deja operar.

- "No veo reportes":
  - Se actualizan cuando marcas chats como **Procesado**.

