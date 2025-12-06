'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const COLORS = [
  { name: 'Morado', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Amarillo', value: '#f59e0b' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Índigo', value: '#6366f1' },
];

const ICONS = ['📚', '🧮', '🔬', '🌍', '💻', '🎨', '⚖️', '🏛️', '🎭', '🎵', '⚡', '🚀'];

export default function EditSubjectPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string;

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [icon, setIcon] = useState(ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos de la materia
  useEffect(() => {
    async function loadSubject() {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('id', subjectId)
          .single();

        if (error) throw error;

        if (data) {
          setName(data.name);
          setColor(data.color);
          setIcon(data.icon);
        }
      } catch (error) {
        console.error('Error cargando materia:', error);
        setError('No se pudo cargar la materia');
      } finally {
        setLoadingData(false);
      }
    }

    loadSubject();
  }, [subjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('subjects')
        .update({
          name,
          color,
          icon,
        })
        .eq('id', subjectId);

      if (error) throw error;

      router.push(`/dashboard/subjects/${subjectId}`);
      router.refresh();
    } catch (error: any) {
      setError(error.message || 'Error al actualizar materia');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/dashboard/subjects/${subjectId}`}>
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Editar Materia</h1>
          <p className="text-gray-400">
            Actualiza la información de tu materia
          </p>
        </div>

        {/* Form */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Información de la Materia</CardTitle>
            <CardDescription>
              Modifica nombre, color e ícono
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-200">
                  Nombre de la Materia
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ej: Cálculo, Física, Historia..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              {/* Color */}
              <div className="space-y-2">
                <Label className="text-gray-200">Color</Label>
                <div className="grid grid-cols-4 gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`h-12 rounded-lg transition-all ${
                        color === c.value
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Ícono */}
              <div className="space-y-2">
                <Label className="text-gray-200">Ícono</Label>
                <div className="grid grid-cols-6 gap-3">
                  {ICONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIcon(i)}
                      className={`h-12 text-2xl rounded-lg transition-all ${
                        icon === i
                          ? 'bg-purple-600 ring-2 ring-purple-400'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-gray-200">Vista Previa</Label>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: color + '20' }}
                    >
                      {icon}
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {name || 'Nombre de la materia'}
                      </p>
                      <p className="text-sm text-gray-400">0 documentos</p>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading || !name}
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
                <Link href={`/dashboard/subjects/${subjectId}`}>
                  <Button type="button" variant="outline" className="border-gray-600 text-gray-300">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}