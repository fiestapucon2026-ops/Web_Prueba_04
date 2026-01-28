# Desarrollo Local - Mercado Pago

## Comandos útiles (Terminal / Cursor Agent)

```bash
# Verificar que el proyecto compila
npm run build

# Desarrollo local (requiere .env.local con credenciales)
npm run dev

# Verificar variables de entorno (requiere cargar .env.local antes)
npm run check:env

# Verificar API (con servidor corriendo en localhost:3000)
npm run verify:api

# Verificar API en Preview de Vercel
VERIFY_URL=https://tu-preview.vercel.app npm run verify:api
```

## Primera vez

1. Copiar credenciales:
   ```bash
   cp .env.example .env.local
   ```
2. Editar `.env.local` con valores de Supabase, MP, etc.
3. Ejecutar:
   ```bash
   npm run dev
   ```
4. En otra terminal (o cuando el servidor esté listo):
   ```bash
   npm run verify:api
   ```

## Scripts añadidos

| Script        | Descripción                                      |
|---------------|---------------------------------------------------|
| `npm run build`       | Build de producción                              |
| `npm run verify:build`| Alias de build                                   |
| `npm run verify:api`  | Comprueba que `/api/tickets/types` responde OK   |
| `npm run check:env`   | Lista variables requeridas/opcionales (sin .env) |

## Branch y deploy

- **Branch:** `feature/mercado-pago-payment`
- **Producción:** www.festivalpucon.cl (branch `main`)
- **Preview:** URL de Vercel del branch (para pruebas MP)

Documentación completa: `PASOS_FINALES_VERCEL.md`, `PLAN_PRUEBAS_MP.md`.
