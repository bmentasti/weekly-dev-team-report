# Guía: token de Airtable para que se vean los nombres reales

Esta guía resuelve el problema por el que en los reportes aparecen **record IDs**
(ej. `recAmn3IscQ6lE7Dl`) en lugar de los nombres reales de las personas.

## Por qué pasa

Cuando el campo de responsable en Airtable es un **registro vinculado** (link a
otra tabla de personas), la API de Airtable devuelve el *record id* del registro,
no su nombre. Para mostrar el nombre real, la app necesita poder leer la tabla de
personas. Eso se habilita de **una** de estas dos formas:

- **Opción A (recomendada):** darle al token el permiso de leer el esquema de la
  base → resolución 100% automática, sin configurar nada más.
- **Opción B:** decirle a la app, en la configuración de la integración, cuál es
  la tabla de personas → funciona sin el permiso de esquema.

Con cualquiera de las dos, los nombres salen automáticamente.

---

## Opción A — Token con permiso de esquema (recomendada)

### 1. Crear el Personal Access Token

1. Entrá a **https://airtable.com/create/tokens**.
2. Tocá **"Create new token"**.
3. Ponele un nombre, por ejemplo `DevMetrics`.

### 2. Agregar los scopes (permisos)

En la sección **Scopes**, agregá estos dos:

| Scope | Para qué sirve |
|-------|----------------|
| `data.records:read` | Leer las tareas/registros (obligatorio). |
| `schema.bases:read` | Leer el esquema para resolver los nombres de personas vinculadas (**este es el que faltaba**). |

### 3. Dar acceso a la base

En la sección **Access**:

1. Tocá **"Add a base"**.
2. Elegí la base donde están tus tareas.

> Sin este paso, el token no ve tus datos aunque tenga los scopes.

### 4. Generar y copiar el token

1. Tocá **"Create token"**.
2. Copiá el token (empieza con `pat...`). **Se muestra una sola vez.**

---

## Opción B — Sin el scope de esquema

Si no podés/querés agregar `schema.bases:read`, alcanza con `data.records:read`,
pero tenés que indicarle a la app cuál es la tabla de personas:

1. Creá el token solo con `data.records:read` + acceso a la base (pasos 3 y 4 de arriba).
2. Al conectar Airtable en la app, completá los campos opcionales:
   - **Tabla de personas vinculada:** el nombre exacto de tu tabla de personas
     (ej. `People`, `Equipo`, `Team`).
   - **Campo de nombre en esa tabla:** por defecto `Name` (cambialo si el tuyo se
     llama distinto, ej. `Nombre`).

---

## Conectar y verificar en la app

1. Andá a **Integraciones → Airtable** y pegá:
   - **Personal Access Token** (el `pat...`).
   - **Base ID** (empieza con `app...`; está en la URL de tu base o en
     airtable.com/api).
   - **Nombre de la tabla** de tareas (ej. `Tasks`).
2. Tocá **probar conexión**. El detalle te va a decir:
   - ✅ *"nombres de personas: automáticos"* → todo listo (Opción A funcionando).
   - ⚠️ *"agregá el scope schema.bases:read…"* → todavía falta el permiso
     (revisá el scope, o usá la Opción B).

---

## Último paso: regenerar el reporte

Los reportes ya generados quedaron guardados **con los record IDs viejos**. Para
verlos con nombres reales:

1. Generá el reporte de nuevo (o esperá al próximo envío programado).
2. A partir de ahí, **cada reporte nuevo sale unificado y con nombres reales**
   automáticamente.

> Bonus: si tu tabla de personas tiene una columna de **email**, la app lo usa
> como identificador único y unifica a esa persona con cualquier otra app que
> comparta el mismo email (Jira, Slack, Linear, etc.).

---

## Resumen rápido

1. Token en airtable.com/create/tokens con **`data.records:read`** + **`schema.bases:read`**.
2. Darle **acceso a la base**.
3. Pegarlo en la app y **probar conexión** (debe decir "nombres: automáticos").
4. **Regenerar** el reporte.
