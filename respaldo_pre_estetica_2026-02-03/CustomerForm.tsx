'use client';

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { validateRutMod11, cleanRutInput, formatRutDisplay } from '@/lib/rut';

const STORAGE_KEY = 'checkout_customer_form';

const CustomerFormSchema = z
  .object({
    name: z.string().min(1, 'Nombre requerido').min(3, 'Mínimo 3 caracteres'),
    email: z.string().min(1, 'Email requerido').email('Email inválido'),
    emailConfirmation: z.string().min(1, 'Confirma tu email'),
    phone: z
      .string()
      .min(1, 'Teléfono requerido')
      .refine((s) => /^9\d{8}$/.test(s.replace(/\s/g, '')), '9 dígitos, comenzando con 9'),
    rut: z
      .string()
      .min(1, 'RUT requerido')
      .refine((s) => {
        const c = cleanRutInput(s);
        const body = c.endsWith('K') ? c.slice(0, -1) : c.slice(0, -1);
        return body.length <= 9;
      }, 'RUT: máximo 9 dígitos')
      .refine(validateRutMod11, 'RUT inválido (Módulo 11)'),
  })
  .refine((d) => d.email === d.emailConfirmation, {
    message: 'Los correos no coinciden',
    path: ['emailConfirmation'],
  });

export type CustomerFormValues = z.infer<typeof CustomerFormSchema>;

interface CustomerFormProps {
  onSubmit: (values: CustomerFormValues) => void;
  disabled?: boolean;
}

const initialValues: CustomerFormValues = {
  name: '',
  email: '',
  emailConfirmation: '',
  phone: '',
  rut: '',
};

function loadPersisted(): Partial<CustomerFormValues> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      emailConfirmation: typeof parsed.emailConfirmation === 'string' ? parsed.emailConfirmation : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      rut: typeof parsed.rut === 'string' ? parsed.rut : '',
    };
  } catch {
    return {};
  }
}

function persist(values: CustomerFormValues) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (_) {}
}

export function CustomerForm({ onSubmit, disabled = false }: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(() => ({
    ...initialValues,
    ...loadPersisted(),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormValues, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof CustomerFormValues, boolean>>>({});

  useEffect(() => {
    persist(values);
  }, [values]);

  const validateField = useCallback((field: keyof CustomerFormValues, value: string) => {
    const next = { ...values, [field]: value };
    const result = CustomerFormSchema.safeParse(next);
    if (result.success) {
      setErrors((e) => ({ ...e, [field]: undefined }));
      return;
    }
    const issue = result.error.issues.find((i) => i.path.includes(field));
    setErrors((e) => ({ ...e, [field]: issue?.message ?? undefined }));
  }, [values]);

  const handleChange = useCallback(
    (field: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (field === 'phone') {
        const digitsOnly = v.replace(/\D/g, '');
        if (digitsOnly.length <= 9) setValues((s) => ({ ...s, phone: digitsOnly }));
      } else if (field === 'rut') {
        setValues((s) => ({ ...s, rut: cleanRutInput(v) }));
      } else {
        setValues((s) => ({ ...s, [field]: v }));
      }
      if (touched[field]) validateField(field, field === 'phone' ? (v.replace(/\D/g, '') || values.phone) : field === 'rut' ? cleanRutInput(v) : v);
    },
    [touched, validateField, values.phone]
  );

  const handleBlur = useCallback(
    (field: keyof CustomerFormValues) => () => {
      setTouched((t) => ({ ...t, [field]: true }));
      if (field === 'rut') {
        setValues((s) => ({ ...s, rut: formatRutDisplay(s.rut) }));
        validateField('rut', formatRutDisplay(values.rut));
      } else {
        validateField(field, values[field]);
      }
    },
    [values, validateField]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setTouched({ name: true, email: true, emailConfirmation: true, phone: true, rut: true });
      const result = CustomerFormSchema.safeParse(values);
      if (!result.success) {
        const next: Partial<Record<keyof CustomerFormValues, string>> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof CustomerFormValues;
          if (key && !next[key]) next[key] = issue.message;
        }
        setErrors(next);
        return;
      }
      setErrors({});
      onSubmit(result.data);
    },
    [values, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="customer-name" className="mb-1 block font-semibold text-slate-200">
          Nombre completo
        </label>
        <input
          id="customer-name"
          type="text"
          value={values.name}
          onChange={handleChange('name')}
          onBlur={handleBlur('name')}
          disabled={disabled}
          placeholder="Nombre y apellido"
          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          autoComplete="name"
        />
        {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="customer-email" className="mb-1 block font-semibold text-slate-200">
          Email
        </label>
        <p className="mb-2 text-sm font-medium text-amber-400">
          IMPORTANTE: A este correo llegarán tus entradas.
        </p>
        <input
          id="customer-email"
          type="email"
          value={values.email}
          onChange={handleChange('email')}
          onBlur={handleBlur('email')}
          disabled={disabled}
          placeholder="tu@email.com"
          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          autoComplete="email"
        />
        {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="customer-email-confirm" className="mb-1 block font-semibold text-slate-200">
          Confirmar email
        </label>
        <input
          id="customer-email-confirm"
          type="email"
          value={values.emailConfirmation}
          onChange={handleChange('emailConfirmation')}
          onBlur={handleBlur('emailConfirmation')}
          disabled={disabled}
          placeholder="repite tu email"
          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          autoComplete="email"
        />
        {errors.emailConfirmation && <p className="mt-1 text-sm text-red-400">{errors.emailConfirmation}</p>}
      </div>

      <div>
        <label htmlFor="customer-phone" className="mb-1 block font-semibold text-slate-200">
          Teléfono
        </label>
        <input
          id="customer-phone"
          type="tel"
          value={values.phone}
          onChange={handleChange('phone')}
          onBlur={handleBlur('phone')}
          disabled={disabled}
          placeholder="9 1234 5678"
          maxLength={9}
          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          autoComplete="tel"
        />
        {errors.phone && <p className="mt-1 text-sm text-red-400">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="customer-rut" className="mb-1 block font-semibold text-slate-200">
          RUT
        </label>
        <input
          id="customer-rut"
          type="text"
          value={values.rut}
          onChange={handleChange('rut')}
          onBlur={handleBlur('rut')}
          disabled={disabled}
          placeholder="12345678-9"
          className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
          autoComplete="off"
          inputMode="numeric"
        />
        {errors.rut && <p className="mt-1 text-sm text-red-400">{errors.rut}</p>}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
      >
        Continuar
      </button>
    </form>
  );
}
