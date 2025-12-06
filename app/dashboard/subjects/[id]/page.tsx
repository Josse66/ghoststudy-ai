import { createClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Trash2, BookOpen, FileText, Upload, Clock } from 'lucide-react';
import Link from 'next/link';
import DeleteSubjectButton from '@/components/DeleteSubjectButton';

export default async function SubjectDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
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
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !subject) {
    notFound();
  }

  // Obtener documentos de esta materia
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('subject_id', id)
    .order('created_at', { ascending: false });

  const documentCount = documents?.length || 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
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
            <Link href={`/dashboard/subjects/${subject.id}/upload`}>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Upload className="mr-2 h-4 w-4" />
                Subir Documento
              </Button>
            </Link>
            <Link href={`/dashboard/subjects/${subject.id}/edit`}>
              <Button variant="outline" className="border-gray-600 text-gray-300">
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
              <div className="text-2xl font-bold text-white">{documentCount}</div>
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
                <Clock className="h-4 w-4" />
                Sesiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">0</div>
              <p className="text-xs text-gray-500 mt-1">De estudio</p>
            </CardContent>
          </Card>
        </div>

        {/* Documentos */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Documentos</span>
              {documentCount > 0 && (
                <span className="text-sm font-normal text-gray-400">
                  {documentCount} {documentCount === 1 ? 'documento' : 'documentos'}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents && documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`}>
                    <div className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">{doc.title}</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {doc.page_count && `${doc.page_count} páginas • `}
                            {doc.file_size && `${(doc.file_size / 1024).toFixed(0)} KB • `}
                            {new Date(doc.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">No hay documentos</h3>
                <p className="text-gray-400 mb-6">
                  Sube tu primer documento para empezar a estudiar
                </p>
                <Link href={`/dashboard/subjects/${subject.id}/upload`}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Documento
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}