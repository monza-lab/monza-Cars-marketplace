# Correos transaccionales — MonzaHaus

Plantillas HTML de los correos de autenticación de Supabase.

## Plantillas

| Archivo | Plantilla en Supabase | Cuándo llega |
|---------|-----------------------|--------------|
| `magic-link.html` | **Magic Link** | Cuando un cliente se registra / inicia sesión con el enlace por email. **Este es el método por defecto del signup** (ver `AuthModal.tsx`: Google, o enlace por email; la contraseña está detrás de un toggle). |
| _(pendiente)_ | **Confirm signup** | Solo si el cliente se registra con **contraseña**. Hoy usa la plantilla default de Supabase. Se puede clonar `magic-link.html` cambiando el título/copy a "confirma tu correo". |

Variables de Supabase Auth: `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .SiteURL }}`.

## El logo va como imagen (PNG), no SVG

Gmail, Outlook, Yahoo y casi todos los webmail **eliminan el `<svg>` inline**. Antes el wordmark
y el ícono del sobre eran SVG → el casco-"O" desaparecía ("M NZAHAUS") y el círculo quedaba vacío.

Ahora el wordmark es un PNG hospedado:
- Archivo: `public/email/monzahaus-wordmark.png` (transparente, alta resolución)
- URL pública: `https://www.monzahaus.com/email/monzahaus-wordmark.png` (usar **www**: el apex redirige 307 y varios clientes no siguen redirects en imágenes)
- Se muestra a 160px de ancho (alto automático); `alt="MONZAHAUS"` es el respaldo si el cliente bloquea imágenes.

### Regenerar el logo
```bash
node scripts/gen-email-wordmark.mjs
```
Renderiza el wordmark oficial (M + casco + NZAHAUS, Saira 600, casco shell `#D6BEDC` sobre cream)
a PNG transparente con Playwright. Fuente desde `public/fonts/monzahaus/`.

## Publicar cambios (para que lleguen a los correos reales)

1. **Deploy** de esta rama a producción → así la imagen queda viva en
   `https://www.monzahaus.com/email/monzahaus-wordmark.png` (verificar abriéndola en el navegador).
2. Supabase → **Authentication → Emails → Templates → Magic Link** → pegar el contenido de
   `magic-link.html` → Save.

> Mientras el deploy no esté, el correo muestra el texto "MONZAHAUS" (el respaldo), no se rompe.

## Cambiar el remitente — "MonzaHaus &lt;hello@monzalab.com&gt;"

> **Decisión:** todos los correos salen de **`hello@monzalab.com`** con nombre visible **MonzaHaus**.
> (Regla de marca: lo público sale de `@monzalab.com`, no de monzahaus.com.)

Por defecto Supabase envía desde su propio dominio (genérico + cae en spam). Para enviar desde
`hello@monzalab.com` hay que configurar **SMTP propio** una sola vez:

### 1. Resend (servicio de envío)
1. Crear cuenta en resend.com.
2. **Domains → Add Domain →** `monzalab.com`.
3. Agregar en el DNS de `monzalab.com` los registros que muestra Resend (SPF + DKIM) → **Verify**.
4. **API Keys → Create** (acceso de envío) → guardar la key.

### 2. Supabase → SMTP propio
Authentication → Emails → **SMTP Settings** → Enable Custom SMTP:
| Campo | Valor |
|-------|-------|
| Sender email | `hello@monzalab.com` |
| Sender name | `MonzaHaus` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | _(la API key de Resend)_ |

Guardar. Luego subir el límite en Authentication → **Rate Limits** (el default del SMTP integrado es bajo).

> El dominio de envío es `monzalab.com`, así que los registros DNS van en **monzalab.com**, no en monzahaus.com.
