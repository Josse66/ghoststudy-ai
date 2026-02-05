import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function SubjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Obtener materias del usuario
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
<div className="min-h-screen bg-gray-900 text-white p-8">
  <div className="max-w-7xl mx-auto">
    {/* Header */}
    <div className="mb-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold mb-2">Mis Materias</h1>
        <p className="text-gray-400">
          Organiza tus estudios por materia
        </p>
      </div>
      
      {/* Botones - Stack en móvil, lado a lado en desktop */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Link href="/dashboard" className="w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>
        <Link href="/dashboard/subjects/new" className="w-full sm:w-auto">
          <Button className="w-full bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Materia
          </Button>
        </Link>
      </div>
    </div>
        {/* Lista de Materias */}
        {subjects && subjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Link key={subject.id} href={`/dashboard/subjects/${subject.id}`}>
                <Card className="bg-gray-800 border-gray-700 hover:border-purple-500 transition-all cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                        style={{ backgroundColor: subject.color + '20' }}
                      >
                        {subject.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-white">{subject.name}</CardTitle>
                        <CardDescription className="text-gray-400 text-sm">
                          Creada {new Date(subject.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        <span>0 documentos</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-white">No tienes materias aún</h3>
              <p className="text-gray-400 mb-6 text-center max-w-md">
                Crea tu primera materia para empezar a organizar tus estudios
              </p>
              <Link href="/dashboard/subjects/new">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primera Materia
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}