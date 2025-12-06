import { createClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Trash2, BookOpen, FileText } from 'lucide-react';
import Link from 'next/link';
import DeleteSubjectButton from '@/components/DeleteSubjectButton';

export default async function SubjectDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;  // ✅ Await params
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Obtener la materia
  const { data: subject, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', id)  // ✅ Usa id en vez de params.id
    .eq('user_id', user.id)
    .single();

  if (error || !subject) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/subjects">
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Materias
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
              style={{ backgroundColor: subject.color + '20' }}
            >
              {subject.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{subject.name}</h1>
              <p className="text-gray-400">
                Creada el {new Date(subject.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href={`/dashboard/subjects/${subject.id}/edit`}>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </Link>
            <DeleteSubjectButton subjectId={subject.id} subjectName={subject.name} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">0</div>
              <p className="text-xs text-gray-500 mt-1">PDFs subidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Flashcards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">0</div>
              <p className="text-xs text-gray-500 mt-1">Generadas</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Sesiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">0</div>
              <p className="text-xs text-gray-500 mt-1">De estudio</p>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Contenido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-center py-8">
              🚧 Próximamente: Documentos y flashcards de esta materia
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}