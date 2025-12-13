import { createClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Trash2, FileText, Calendar, HardDrive, FileType } from 'lucide-react';
import Link from 'next/link';
import DeleteDocumentButton from '@/components/DeleteDocumentButton';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Obtener el documento
  const { data: document, error } = await supabase
    .from('documents')
    .select('*, subjects(name, color, icon)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !document) {
    notFound();
  }

  // Generar URL firmada para descargar
  const { data: signedUrlData } = await supabase.storage
    .from('documents')
    .createSignedUrl(document.file_url, 3600); // Válida por 1 hora

  const downloadUrl = signedUrlData?.signedUrl;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/dashboard/subjects/${document.subject_id}`}>
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Materia
            </Button>
          </Link>

          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl flex-shrink-0"
              style={{
                backgroundColor: document.subjects?.color
                  ? `${document.subjects.color}20`
                  : '#8b5cf620',
              }}
            >
              <FileText className="h-8 w-8" style={{ color: document.subjects?.color || '#8b5cf6' }} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{document.title}</h1>
              <div className="flex items-center gap-2 text-gray-400">
                {document.subjects?.icon && <span>{document.subjects.icon}</span>}
                <span>{document.subjects?.name || 'Sin materia'}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {downloadUrl && (
              <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
              </a>
            )}
            <DeleteDocumentButton
              documentId={document.id}
              documentTitle={document.title}
              subjectId={document.subject_id}
            />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha de subida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white font-semibold">
                {new Date(document.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Tamaño
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white font-semibold">
                {document.file_size ? `${(document.file_size / 1024).toFixed(0)} KB` : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <FileType className="h-4 w-4" />
                Páginas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white font-semibold">{document.page_count || 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Contenido Extraído</CardTitle>
          </CardHeader>
          <CardContent>
            {document.content && document.content.trim().length > 0 ? (
              <div className="bg-gray-900 rounded-lg p-6 max-h-[600px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-gray-300 text-sm font-mono leading-relaxed">
                  {document.content}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No se pudo extraer texto de este PDF</p>
                <p className="text-sm text-gray-500">
                  Puede ser un PDF escaneado o protegido. Puedes descargarlo para verlo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="bg-gray-800 border-gray-700 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              🚧 Próximamente: Genera flashcards automáticamente desde este documento con IA
            </p>
            <Button disabled className="bg-gray-700 text-gray-500 cursor-not-allowed">
              Generar Flashcards (Próximamente)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}