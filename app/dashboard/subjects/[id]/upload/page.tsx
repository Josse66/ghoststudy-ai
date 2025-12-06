'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';

export default function UploadDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string;

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      // Auto-rellenar título con nombre del archivo (sin extensión)
      if (!title) {
        setTitle(selectedFile.name.replace('.pdf', ''));
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUpload = async () => {
    if (!file || !title) return;

    setUploading(true);
    setError(null);
    setProgress(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      setProgress(20);

      // 1. Subir archivo a Storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setProgress(50);

      // 2. Extraer texto del PDF
      const formData = new FormData();
      formData.append('file', file);

      const extractResponse = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        throw new Error('Error al extraer texto del PDF');
      }

      const { text, pageCount } = await extractResponse.json();

      setProgress(70);

      // 3. Guardar en base de datos
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          title,
          content: text,
          file_url: fileName,
          file_size: file.size,
          page_count: pageCount,
        });

      if (dbError) throw dbError;

      setProgress(100);

      // Redirigir de vuelta a la materia
      router.push(`/dashboard/subjects/${subjectId}`);
      router.refresh();
    } catch (error: any) {
      console.error('Error al subir:', error);
      setError(error.message || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

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
          <h1 className="text-3xl font-bold mb-2">Subir Documento</h1>
          <p className="text-gray-400">
            Sube un archivo PDF para extraer su contenido automáticamente
          </p>
        </div>

        {/* Form */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Nuevo Documento</CardTitle>
            <CardDescription>
              Solo archivos PDF (máximo 10MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropzone */}
            <div>
              <Label className="text-gray-200 mb-2 block">Archivo PDF</Label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-2">
                    <FileText className="h-12 w-12 text-purple-400 mx-auto" />
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      Cambiar archivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 text-gray-500 mx-auto" />
                    <p className="text-gray-400">
                      {isDragActive
                        ? 'Suelta el archivo aquí'
                        : 'Arrastra un PDF aquí o haz clic para seleccionar'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-200">
                Título del Documento
              </Label>
              <Input
                id="title"
                type="text"
                placeholder="Ej: Apuntes de clase, Resumen del tema 5..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={uploading}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>

            {/* Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subiendo y procesando...</span>
                  <span className="text-purple-400">{progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={!file || !title || uploading}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Documento
                  </>
                )}
              </Button>
              <Link href={`/dashboard/subjects/${subjectId}`}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  className="border-gray-600 text-gray-300"
                >
                  Cancelar
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}