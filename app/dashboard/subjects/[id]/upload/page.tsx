'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, FileText, Loader2, Image as ImageIcon } from 'lucide-react';
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
  const [extractionStatus, setExtractionStatus] = useState<string>('');

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      // Auto-rellenar título con nombre del archivo (sin extensión)
      if (!title) {
        const nameWithoutExt = selectedFile.name
          .replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '');
        setTitle(nameWithoutExt);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUpload = async () => {
    if (!file || !title) return;

    setUploading(true);
    setError(null);
    setProgress(10);
    setExtractionStatus('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      setProgress(20);

      // 1. Subir archivo a Storage
      // Sanitizar nombre del archivo - ACEPTA TODO
      const sanitizedFileName = file.name
        .normalize('NFD')                        // Descompone acentos (á → a + ´)
        .replace(/[\u0300-\u036f]/g, '')        // Elimina marcas diacríticas
        .replace(/[^a-zA-Z0-9.-]/g, '_')        // Reemplaza TODO lo demás con _
        .replace(/_{2,}/g, '_')                  // Múltiples _ → uno solo
        .replace(/^_+|_+$/g, '')                 // Elimina _ al inicio/final
        .toLowerCase();                          // Minúsculas

      const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
      
      console.log('Original filename:', file.name);
      console.log('Sanitized filename:', sanitizedFileName);
      console.log('Full path:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage error:', uploadError);
        throw new Error(`Error al subir archivo: ${uploadError.message}`);
      }

      console.log('File uploaded successfully:', uploadData);

      setProgress(50);

      // 2. Extraer texto del archivo (PDF o imagen)
      const isImage = file.type.startsWith('image/');
      setExtractionStatus(isImage ? 'Extrayendo texto de imagen con OCR...' : 'Extrayendo texto del PDF...');

      const formData = new FormData();
      formData.append('file', file);

      console.log('Calling extract-pdf API...');

      const extractResponse = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData,
      });

      console.log('Extract response status:', extractResponse.status);

      let text = '';
      let pageCount = null;
      let extractionMethod = null;
      let extractionConfidence = null;

      if (!extractResponse.ok) {
        // Si falla la extracción, continuar sin texto
        console.warn('Failed to extract text, continuing without content');
        setExtractionStatus('⚠️ No se pudo extraer texto');
        try {
          const errorData = await extractResponse.json();
          console.warn('Could not extract text:', errorData.details || errorData.error || 'Unknown error');
        } catch (e) {
          console.warn('Could not extract text (no details available)');
        }
      } else {
        // Si funciona, extraer el texto
        try {
          const extractData = await extractResponse.json();
          text = extractData.text || '';
          pageCount = extractData.pageCount || null;
          extractionMethod = extractData.method || null;
          extractionConfidence = extractData.confidence || null;

          // Validar que se extrajo texto
          if (!text || text.trim().length === 0) {
            console.warn('No text extracted, saving without content');
            setExtractionStatus('⚠️ Sin texto extraído');
          } else {
            console.log('Text extracted successfully:', {
              length: text.length,
              method: extractionMethod,
              confidence: extractionConfidence,
            });
            
            const methodLabel = extractionMethod === 'text' ? '📄 Texto directo' : '🔍 OCR';
            const confidenceLabel = extractionConfidence ? ` (${extractionConfidence.toFixed(0)}% confianza)` : '';
            setExtractionStatus(`✅ ${methodLabel}${confidenceLabel}`);
          }
        } catch (e) {
          console.error('Error parsing extract response:', e);
          setExtractionStatus('❌ Error al procesar respuesta');
        }
      }

      setProgress(70);

      // 3. Guardar en base de datos
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          title,
          content: text || null,
          file_url: fileName,
          file_size: file.size,
          page_count: pageCount,
          extraction_method: extractionMethod,
          extraction_confidence: extractionConfidence,
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Error al guardar en base de datos: ${dbError.message}`);
      }

      setProgress(100);

      console.log('Document saved successfully!');

      // Esperar un momento para que se vea el éxito
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirigir de vuelta a la materia
      router.push(`/dashboard/subjects/${subjectId}`);
      router.refresh();
    } catch (error: any) {
      console.error('Error al subir:', error);
      setError(error.message || 'Error al subir el documento');
      setExtractionStatus('');
    } finally {
      setUploading(false);
    }
  };

  // Detectar si es imagen
  const isImageFile = file?.type.startsWith('image/');

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
            Sube un PDF o imagen para extraer su contenido automáticamente
          </p>
        </div>

        {/* Form */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Nuevo Documento</CardTitle>
            <CardDescription>
              PDFs e imágenes (JPG, PNG, WebP) - Máximo 10MB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dropzone */}
            <div>
              <Label className="text-gray-200 mb-2 block">Archivo</Label>
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
                    {isImageFile ? (
                      <ImageIcon className="h-12 w-12 text-purple-400 mx-auto" />
                    ) : (
                      <FileText className="h-12 w-12 text-purple-400 mx-auto" />
                    )}
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-400">
                      {(file.size / 1024).toFixed(0)} KB
                      {isImageFile && ' • Imagen'}
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
                        : 'Arrastra un PDF o imagen aquí o haz clic para seleccionar'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Soporta: PDF, JPG, PNG, WebP
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
                  <span className="text-gray-400">
                    {extractionStatus || 'Subiendo y procesando...'}
                  </span>
                  <span className="text-purple-400">{progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {isImageFile && progress >= 50 && progress < 100 && (
                  <p className="text-xs text-gray-500 text-center">
                    El OCR puede tardar 10-30 segundos en procesar la imagen...
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Info sobre OCR */}
            {isImageFile && !uploading && (
              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/50 text-blue-400 text-sm">
                🔍 Esta imagen será procesada con OCR para extraer el texto automáticamente
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