'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import GlobalSearchModal from './GlobalSearchModal';

export default function FloatingSearchButton() {
  const [isOpen, setIsOpen] = useState(false);

  // Manejar Ctrl+B / Cmd+B (B de Búsqueda)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
        aria-label="Abrir búsqueda (Ctrl+B)"
        title="Buscar (Ctrl+B)"
      >
        <Search className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
        
        {/* Efecto de onda */}
        <span className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-20"></span>
        
        {/* Tooltip con atajo */}
        <div className="absolute bottom-full mb-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
            Buscar
            <div className="flex items-center gap-1 mt-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">Ctrl</kbd>
              <span className="text-[10px]">+</span>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px]">B</kbd>
            </div>
          </div>
        </div>
      </button>

      {/* Modal de búsqueda global */}
      <GlobalSearchModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}