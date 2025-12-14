import { createClient } from '@/lib/supabase-server';
import { redirect, notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText, Calendar, HardDrive, FileType, MessageSquare } from 'lucide-react';
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

  // Determinar si es imagen o PDF
  const isImage = document.file_url.match(/\.(jpg|jpeg|png|webp)$/i);

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

          <div className="flex gap-3 flex-wrap">
            {/* Botón de Chat - NUEVO */}
            <Link href={`/dashboard/chat/${document.id}`}>
              <Button className="bg-green-600 hover:bg-green-700">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat con IA
              </Button>
            </Link>

            {/* Botón de Descarga */}
            {downloadUrl && (
              <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar {isImage ? 'Imagen' : 'PDF'}
                </Button>
              </a>
            )}

            {/* Botón de Eliminar */}
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
                {isImage ? 'Tipo' : 'Páginas'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white font-semibold">
                {isImage ? 'Imagen' : (document.page_count || 'N/A')}
              </p>
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
              <>
                {/* Mostrar método de extracción si está disponible */}
                {document.extraction_method && (
                  <div className="mb-4 p-3 rounded-lg bg-gray-700/50 text-sm flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Método de extracción: </span>
                      <span className="text-purple-400 font-medium">
                        {document.extraction_method === 'text' && '📄 Texto directo'}
                        {document.extraction_method === 'ocr' && '🔍 OCR (reconocimiento óptico)'}
                        {document.extraction_method === 'hybrid' && '🔀 Híbrido'}
                      </span>
                    </div>
                    {document.extraction_confidence && document.extraction_confidence > 0 && (
                      <span className="text-gray-400">
                        Confianza: <span className="text-purple-400 font-semibold">{document.extraction_confidence.toFixed(1)}%</span>
                      </span>
                    )}
                  </div>
                )}
                
                <div className="bg-gray-900 rounded-lg p-6 max-h-[600px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-gray-300 text-sm font-mono leading-relaxed">
                    {document.content}
                  </pre>
                </div>

                {/* Mostrar estadísticas del contenido */}
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
                  <span>{document.content.split(/\s+/).filter(Boolean).length} palabras</span>
                  <span>•</span>
                  <span>{document.content.length} caracteres</span>
                  {document.content.split('\n').filter(Boolean).length > 1 && (
                    <>
                      <span>•</span>
                      <span>{document.content.split('\n').filter(Boolean).length} líneas</span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">No se pudo extraer texto</p>
                <p className="text-sm text-gray-500">
                  {isImage 
                    ? 'La imagen puede no contener texto legible o el OCR no pudo procesarla.'
                    : 'El PDF puede estar vacío, protegido o ser un escaneo de mala calidad.'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Puedes descargarlo para verlo manualmente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="bg-gray-800 border-gray-700 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Acciones con IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 mb-3">
                  💬 Usa el chat con IA para interactuar con este documento
                </p>
                <Link href={`/dashboard/chat/${document.id}`}>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Abrir Chat con IA
                  </Button>
                </Link>
              </div>

              {document.content && document.content.trim().length > 0 && (
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-500">
                    💡 Con el chat puedes:
                  </p>
                  <ul className="text-sm text-gray-500 mt-2 space-y-1 list-disc list-inside">
                    <li>Hacer preguntas sobre el documento</li>
                    <li>Generar resúmenes automáticos</li>
                    <li>Crear flashcards para estudiar</li>
                    <li>Obtener preguntas de práctica</li>
                    <li>Explicaciones de conceptos complejos</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}