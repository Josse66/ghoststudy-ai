'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  X, 
  Clock,
  FileText,
  BookOpen,
  CreditCard,
  ArrowRight,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SearchResult {
  id: string;
  type: 'document' | 'flashcard' | 'subject';
  title: string;
  subtitle?: string;
  content: string;
  subjectName: string;
  subjectIcon: string;
  difficulty?: string;
  category?: string;
  url: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);

  // Cargar búsquedas recientes del localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Manejar tecla ESC para cerrar
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewResult) {
          setPreviewResult(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose, previewResult]);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (query.length >= 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [query]);

  const performSearch = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const allResults: SearchResult[] = [];

    try {
      // Buscar en materias
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${query}%`);

      if (subjectsData) {
        subjectsData.forEach((subject) => {
          allResults.push({
            id: subject.id,
            type: 'subject',
            title: subject.name,
            content: subject.description || '',
            subjectName: subject.name,
            subjectIcon: subject.icon,
            url: `/dashboard/subjects/${subject.id}`
          });
        });
      }

      // Buscar en documentos
      const { data: documentsData } = await supabase
        .from('documents')
        .select(`
          *,
          subjects (name, icon)
        `)
        .eq('user_id', user.id);

      if (documentsData) {
        const filtered = documentsData.filter((doc) =>
          (doc.name && doc.name.toLowerCase().includes(query.toLowerCase())) ||
          (doc.content && doc.content.toLowerCase().includes(query.toLowerCase()))
        );

        filtered.forEach((doc) => {
          allResults.push({
            id: doc.id,
            type: 'document',
            title: doc.name,
            subtitle: doc.subjects?.name || '',
            content: doc.content || '',
            subjectName: doc.subjects?.name || '',
            subjectIcon: doc.subjects?.icon || '📄',
            url: `/dashboard/subjects/${doc.subject_id}/documents/${doc.id}`
          });
        });
      }

      // Buscar en flashcards
      const { data: flashcardsData } = await supabase
        .from('flashcards')
        .select(`
          *,
          documents (
            name,
            subject_id,
            subjects (name, icon)
          )
        `)
        .eq('user_id', user.id);

      if (flashcardsData) {
        const filtered = flashcardsData.filter((fc) =>
          (fc.front && fc.front.toLowerCase().includes(query.toLowerCase())) ||
          (fc.back && fc.back.toLowerCase().includes(query.toLowerCase()))
        );

        filtered.forEach((fc) => {
          const subjectName = fc.documents?.subjects?.name || '';
          const subjectIcon = fc.documents?.subjects?.icon || '🎴';
          allResults.push({
            id: fc.id,
            type: 'flashcard',
            title: fc.front,
            subtitle: fc.documents?.name || '',
            content: fc.back,
            subjectName,
            subjectIcon,
            difficulty: fc.difficulty,
            category: fc.category,
            url: `/dashboard/subjects/${fc.documents?.subject_id}/documents/${fc.document_id}`
          });
        });
      }

      setResults(allResults.slice(0, 10)); // Limitar a 10 resultados
    } catch (error) {
      console.error('Error searching:', error);
    }

    setIsLoading(false);
  };

  const saveRecentSearch = (searchQuery: string) => {
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(query);
    router.push(result.url);
    onClose();
    setQuery('');
  };

  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const highlightText = (text: string, query: string): string => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-400 text-gray-900 px-1 rounded">$1</mark>');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal de búsqueda */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4 pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto">
          <Card className="bg-gray-800 border-gray-700 shadow-2xl">
            <CardContent className="p-0">
              {/* Header con input */}
              <div className="p-4 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar en materias, documentos y flashcards..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-12 pr-12 h-14 text-lg bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500"
                    autoFocus
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Indicador de atajo */}
                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600">B</kbd>
                    <span className="ml-2">para abrir búsqueda</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-gray-700 rounded border border-gray-600">Esc</kbd>
                    <span>para cerrar</span>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Búsquedas recientes */}
                {!query && recentSearches.length > 0 && (
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Búsquedas recientes
                      </h3>
                      <button
                        onClick={clearRecentSearches}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Limpiar
                      </button>
                    </div>
                    <div className="space-y-2">
                      {recentSearches.map((search, index) => (
                        <button
                          key={index}
                          onClick={() => handleRecentSearchClick(search)}
                          className="w-full text-left px-3 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
                        >
                          <Search className="h-4 w-4 inline mr-2 text-gray-500" />
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resultados */}
                {query && (
                  <div className="p-2">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="text-gray-400 text-sm mt-2">Buscando...</p>
                      </div>
                    ) : results.length === 0 ? (
                      <div className="text-center py-8">
                        <Search className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-400">No se encontraron resultados para "{query}"</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {results.map((result) => (
                          <div
                            key={`${result.type}-${result.id}`}
                            className="group relative"
                            onMouseEnter={() => setPreviewResult(result)}
                            onMouseLeave={() => setPreviewResult(null)}
                          >
                            <button
                              onClick={() => handleResultClick(result)}
                              className="w-full text-left p-3 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                {/* Icono */}
                                <div className="flex-shrink-0 mt-1">
                                  {result.type === 'subject' && (
                                    <div className="w-8 h-8 bg-purple-600/20 rounded flex items-center justify-center">
                                      <BookOpen className="h-4 w-4 text-purple-400" />
                                    </div>
                                  )}
                                  {result.type === 'document' && (
                                    <div className="w-8 h-8 bg-blue-600/20 rounded flex items-center justify-center">
                                      <FileText className="h-4 w-4 text-blue-400" />
                                    </div>
                                  )}
                                  {result.type === 'flashcard' && (
                                    <div className="w-8 h-8 bg-green-600/20 rounded flex items-center justify-center">
                                      <CreditCard className="h-4 w-4 text-green-400" />
                                    </div>
                                  )}
                                </div>

                                {/* Contenido */}
                                <div className="flex-1 min-w-0">
                                  <h4 
                                    className="font-medium text-white text-sm group-hover:text-purple-400"
                                    dangerouslySetInnerHTML={{ __html: highlightText(result.title, query) }}
                                  />
                                  {result.subtitle && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {result.subjectIcon} {result.subtitle}
                                    </p>
                                  )}
                                  <p 
                                    className="text-xs text-gray-500 mt-1 line-clamp-1"
                                    dangerouslySetInnerHTML={{ __html: highlightText(result.content.substring(0, 80), query) }}
                                  />
                                </div>

                                {/* Flecha */}
                                <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-purple-400 flex-shrink-0 mt-1" />
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Mensaje inicial */}
                {!query && recentSearches.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <Search className="h-16 w-16 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg mb-2">¿Qué estás buscando?</p>
                    <p className="text-gray-500 text-sm">
                      Busca en materias, documentos y flashcards
                    </p>
                  </div>
                )}
              </div>

              {/* Footer con tips */}
              <div className="p-3 border-t border-gray-700 bg-gray-800/50">
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↓</kbd>
                    navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Enter</kbd>
                    abrir
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    hover para preview
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Modal */}
          {previewResult && (
            <Card className="mt-2 bg-gray-800 border-gray-700 shadow-xl max-h-[30vh] overflow-y-auto">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{previewResult.subjectIcon}</span>
                    <div>
                      <h3 className="font-semibold text-white">{previewResult.title}</h3>
                      <p className="text-xs text-gray-400">{previewResult.subjectName}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-gray-600 text-gray-400">
                    {previewResult.type === 'subject' ? 'Materia' : 
                     previewResult.type === 'document' ? 'Documento' : 'Flashcard'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {previewResult.content.substring(0, 300)}
                  {previewResult.content.length > 300 && '...'}
                </p>
                {previewResult.difficulty && (
                  <Badge className={`mt-2 ${getDifficultyColor(previewResult.difficulty)}`}>
                    {previewResult.difficulty === 'easy' ? 'Fácil' : 
                     previewResult.difficulty === 'medium' ? 'Media' : 'Difícil'}
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}