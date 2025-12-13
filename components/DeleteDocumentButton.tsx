'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DeleteDocumentButtonProps {
  documentId: string;
  documentTitle: string;
  subjectId: string;
}

export default function DeleteDocumentButton({
  documentId,
  documentTitle,
  subjectId,
}: DeleteDocumentButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      // 1. Obtener file_url del documento
      const { data: doc } = await supabase
        .from('documents')
        .select('file_url')
        .eq('id', documentId)
        .single();

      // 2. Eliminar de Storage
      if (doc?.file_url) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([doc.file_url]);

        if (storageError) {
          console.error('Error deleting from storage:', storageError);
        }
      }

      // 3. Eliminar de base de datos
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Redirigir a la materia
      router.push(`/dashboard/subjects/${subjectId}`);
      router.refresh();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar el documento');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>¿Eliminar documento?</DialogTitle>
          <DialogDescription className="text-gray-400">
            ¿Estás seguro de eliminar <strong className="text-white">{documentTitle}</strong>?
            Esta acción no se puede deshacer y se eliminarán todas las flashcards asociadas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="border-gray-600 text-gray-300"
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}