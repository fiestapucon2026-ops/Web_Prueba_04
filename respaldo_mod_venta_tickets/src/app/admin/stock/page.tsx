'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'admin_stock_key';

type InventoryItem = {
  id: string;
  event_date: string;
  ticket_type_name: string;
  ticket_type_id: string;
  nominal_stock: number;
  price: number;
  fomo_threshold: number;
  overbooking_tolerance: number;
  total_capacity: number;
  sold: number;
  available: number;
  occupied_pct: number;
};

type ApiResponse = {
  event_days: Array<{ id: string; event_date: string; event_id: string }>;
  items: InventoryItem[];
};

function getStoredKey(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

function setStoredKey(key: string) {
  sessionStorage.setItem(STORAGE_KEY, key);
}

function clearStoredKey() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function formatDate(d: string): string {
  const date = new Date(d + 'T12:00:00.000Z');
  return date.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function AdminStockPage() {
  const [key, setKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<InventoryItem>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const k = key || getStoredKey();
    if (!k) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory', {
        headers: { 'x-admin-key': k },
      });
      if (res.status === 401) {
        clearStoredKey();
        setKey('');
        setError('Sesión expirada. Ingresa la clave nuevamente.');
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error || 'Error al cargar');
        return;
      }
      const json = await res.json() as ApiResponse;
      setData(json);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    const k = getStoredKey();
    if (k) {
      setKey(k);
    }
  }, []);

  useEffect(() => {
    if (key) fetchData();
  }, [key, fetchData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!inputKey.trim()) {
      setLoginError('Ingresa la clave de administrador');
      return;
    }
    setStoredKey(inputKey.trim());
    setKey(inputKey.trim());
    setInputKey('');
  };

  const handleLogout = () => {
    clearStoredKey();
    setKey('');
    setData(null);
  };

  const startEdit = (item: InventoryItem) => {
    setEditing(item.id);
    setEditValues({
      nominal_stock: item.nominal_stock,
      price: item.price,
      fomo_threshold: item.fomo_threshold,
      overbooking_tolerance: item.overbooking_tolerance,
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editing || !key) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/inventory/${editing}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': key,
        },
        body: JSON.stringify(editValues),
      });
      if (res.status === 401) {
        clearStoredKey();
        setKey('');
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert((json as { error?: string }).error || 'Error al guardar');
        return;
      }
      setEditing(null);
      setEditValues({});
      fetchData();
    } catch {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (!key) {
    return (
      <main className="min-h-screen bg-slate-900 px-4 py-12">
        <div className="mx-auto max-w-sm">
          <h1 className="mb-6 text-xl font-bold text-white">
            Admin — Gestión de Stock
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-key" className="mb-1 block text-sm text-slate-300">
                Clave de administrador
              </label>
              <input
                id="admin-key"
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                placeholder="ADMIN_SECRET"
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="text-sm text-red-400">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              Entrar
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-500">
            Configura ADMIN_SECRET en .env.local para acceder.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Gestión de Stock y Valores</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cerrar sesión
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-slate-400">Cargando...</p>
        )}

        {!loading && data && (
          <div className="space-y-8">
            {data.event_days.map((day) => {
              const dayItems = data.items.filter((i) => i.event_date === day.event_date);
              if (!dayItems.length) return null;
              return (
                <section key={day.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <h2 className="mb-4 text-lg font-semibold text-slate-200">
                    {formatDate(day.event_date)}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-600 text-left text-slate-400">
                          <th className="pb-2 pr-4">Tipo</th>
                          <th className="pb-2 pr-4">Stock nominal</th>
                          <th className="pb-2 pr-4">Precio (CLP)</th>
                          <th className="pb-2 pr-4">% FOMO</th>
                          <th className="pb-2 pr-4">Overbook %</th>
                          <th className="pb-2 pr-4">Cap. total</th>
                          <th className="pb-2 pr-4">Vendidos</th>
                          <th className="pb-2 pr-4">Disponibles</th>
                          <th className="pb-2 pr-4">Ocupación %</th>
                          <th className="pb-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-700/50">
                            <td className="py-3 pr-4 font-medium">{item.ticket_type_name}</td>
                            {editing === item.id ? (
                              <>
                                <td className="py-3 pr-4">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editValues.nominal_stock ?? ''}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        nominal_stock: parseInt(e.target.value, 10) || 0,
                                      }))
                                    }
                                    className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <input
                                    type="number"
                                    min={0}
                                    value={editValues.price ?? ''}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        price: parseInt(e.target.value, 10) || 0,
                                      }))
                                    }
                                    className="w-24 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editValues.fomo_threshold ?? ''}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        fomo_threshold: parseInt(e.target.value, 10) || 0,
                                      }))
                                    }
                                    className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editValues.overbooking_tolerance ?? ''}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        overbooking_tolerance: parseInt(e.target.value, 10) || 0,
                                      }))
                                    }
                                    className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
                                  />
                                </td>
                                <td colSpan={5} className="py-3">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={saveEdit}
                                      disabled={saving}
                                      className="rounded bg-green-600 px-3 py-1 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {saving ? 'Guardando…' : 'Guardar'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEdit}
                                      className="rounded border border-slate-600 px-3 py-1 text-sm hover:bg-slate-700"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 pr-4">{item.nominal_stock}</td>
                                <td className="py-3 pr-4">
                                  ${item.price.toLocaleString('es-CL')}
                                </td>
                                <td className="py-3 pr-4">{item.fomo_threshold}%</td>
                                <td className="py-3 pr-4">{item.overbooking_tolerance}%</td>
                                <td className="py-3 pr-4">{item.total_capacity}</td>
                                <td className="py-3 pr-4">{item.sold}</td>
                                <td className="py-3 pr-4">{item.available}</td>
                                <td className="py-3 pr-4">
                                  <span
                                    className={
                                      item.occupied_pct >= item.fomo_threshold
                                        ? 'font-semibold text-amber-400'
                                        : ''
                                    }
                                  >
                                    {item.occupied_pct}%
                                  </span>
                                </td>
                                <td className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(item)}
                                    className="rounded bg-blue-600 px-3 py-1 text-sm font-medium hover:bg-blue-700"
                                  >
                                    Editar
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
