import { z } from 'zod';

// Schemas compartidos para validación frontend y backend
// Garantiza consistencia entre cliente y servidor

// Schema para creación de preferencia de pago
export const CreatePreferenceSchema = z.object({
  event_id: z.string().uuid('event_id debe ser un UUID válido'),
  ticket_type_id: z.string().uuid('ticket_type_id debe ser un UUID válido'),
  // IMPORTANTE: el schema SQL actual no tiene campo quantity en orders.
  // Para evitar inconsistencias y sobreventa, por ahora soportamos 1 ticket por orden.
  quantity: z
    .number()
    .int('quantity debe ser un entero')
    .positive('quantity debe ser positivo')
    .max(1, 'quantity máximo es 1 (schema actual no soporta múltiples tickets por orden)'),
  payer_email: z.string().email('payer_email debe ser un email válido'),
});

// Schema para validación de email
export const EmailSchema = z.string().email('Debe ser un email válido');

// Schema para validación de cantidad
export const QuantitySchema = z
  .number()
  .int('Debe ser un entero')
  .positive('Debe ser positivo')
  .max(1, 'Máximo 1 ticket por orden (schema actual)');

// Schema para validación de UUID
export const UUIDSchema = z.string().uuid('Debe ser un UUID válido');

// Tipo TypeScript derivado del schema
export type CreatePreferenceRequest = z.infer<typeof CreatePreferenceSchema>;
