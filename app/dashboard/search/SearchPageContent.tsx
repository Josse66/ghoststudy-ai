'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  FileText, 
  BookOpen, 
  CreditCard,
  Filter,
  X,
  ArrowRight,
  Clock
} from 'lucide-react';
import Link from 'next/link';

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
  highlight: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(searchQuery, 300); // 300ms delay
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'document' | 'flashcard' | 'subject'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cargar materias para filtros (solo una vez)
  useEffect(() => {
    loadSubjects();
  }, []);

  // Ejecutar búsqueda con debounce
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, activeFilter, selectedSubject, selectedDifficulty, selectedCategory]);

  const loadSubjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('subjects')
      .select('id, name, icon')
      .eq('user_id', user.id)
      .order('name')
      .limit(50); // Límite razonable

    if (data) setSubjects(data);
  };

  const performSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const allResults: SearchResult[] = [];
    const RESULT_LIMIT = 20; // Límite global de resultados

    try {
      // Query paralela - ejecutar todas al mismo tiempo
      const searchPromises = [];

      // Buscar en materias (si aplica)
      if (activeFilter === 'all' || activeFilter === 'subject') {
        searchPromises.push(
          supabase
            .from('subjects')
            .select('id, name, icon, description')
            .eq('user_id', user.id)
            .ilike('name', `%${query}%`)
            .limit(10)
            .then(({ data }) => {
              if (data) {
                return data.map((subject) => ({
                  id: subject.id,
                  type: 'subject' as const,
                  title: subject.name,
                  content: subject.description || '',
                  subjectName: subject.name,
                  subjectIcon: subject.icon,
                  url: `/dashboard/subjects/${subject.id}`,
                  highlight: highlightText(subject.name, query)
                }));
              }
              return [];
            })
        );
      }

      // Buscar en documentos (si aplica)
      if (activeFilter === 'all' || activeFilter === 'document') {
        let docQuery = supabase
          .from('documents')
          .select('id, name, content, subject_id, subjects!inner(name, icon)')
          .eq('user_id', user.id)
          .or(`name.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(10);

        if (selectedSubject !== 'all') {
          docQuery = docQuery.eq('subject_id', selectedSubject);
        }

        searchPromises.push(
          docQuery.then(({ data }) => {
            if (data) {
              return data.map((doc: any) => ({
                id: doc.id,
                type: 'document' as const,
                title: doc.name || 'Sin título',
                subtitle: doc.subjects?.name || '',
                content: getContentSnippet(doc.content || '', query),
                subjectName: doc.subjects?.name || '',
                subjectIcon: doc.subjects?.icon || '📄',
                url: `/dashboard/subjects/${doc.subject_id}/documents/${doc.id}`,
                highlight: highlightText(doc.name || 'Sin título', query)
              }));
            }
            return [];
          })
        );
      }

      // Buscar en flashcards (si aplica)
      if (activeFilter === 'all' || activeFilter === 'flashcard') {
        let fcQuery = supabase
          .from('flashcards')
          .select('id, front, back, difficulty, category, document_id, documents!inner(name, subject_id, subjects(name, icon))')
          .eq('user_id', user.id)
          .or(`front.ilike.%${query}%,back.ilike.%${query}%`)
          .limit(10);

        if (selectedDifficulty !== 'all') {
          fcQuery = fcQuery.eq('difficulty', selectedDifficulty);
        }

        if (selectedCategory !== 'all') {
          fcQuery = fcQuery.eq('category', selectedCategory);
        }

        searchPromises.push(
          fcQuery.then(({ data }) => {
            if (data) {
              return data.map((fc: any) => ({
                id: fc.id,
                type: 'flashcard' as const,
                title: fc.front || 'Sin pregunta',
                subtitle: fc.documents?.name || '',
                content: fc.back || '',
                subjectName: fc.documents?.subjects?.name || '',
                subjectIcon: fc.documents?.subjects?.icon || '🎴',
                difficulty: fc.difficulty,
                category: fc.category,
                url: `/dashboard/subjects/${fc.documents?.subject_id}/documents/${fc.document_id}`,
                highlight: highlightText(fc.front || 'Sin pregunta', query)
              }));
            }
            return [];
          })
        );
      }

      // Esperar todas las búsquedas en paralelo
      const resultsArrays = await Promise.all(searchPromises);
      const combinedResults = resultsArrays.flat();

      // Limitar resultados totales
      setResults(combinedResults.slice(0, RESULT_LIMIT));
    } catch (error) {
      console.error('Error searching:', error);
      setResults([]);
    }

    setIsLoading(false);
  }, [activeFilter, selectedSubject, selectedDifficulty, selectedCategory]);

  const highlightText = (text: string, query: string): string => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-400 text-gray-900 px-1 rounded">$1</mark>');
  };

  const getContentSnippet = (content: string, query: string, maxLength = 150): string => {
    if (!content) return '';
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);
    
    if (index === -1) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 100);
    const snippet = content.substring(start, end);
    
    return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '');
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Concepto': 'bg-blue-500/20 text-blue-400',
      'Definición': 'bg-green-500/20 text-green-400',
      'Problema': 'bg-orange-500/20 text-orange-400',
      'Fórmula': 'bg-purple-500/20 text-purple-400',
      'Proceso': 'bg-yellow-500/20 text-yellow-400',
      'Comparación': 'bg-pink-500/20 text-pink-400',
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400';
  };

  const documentCount = results.filter(r => r.type === 'document').length;
  const flashcardCount = results.filter(r => r.type === 'flashcard').length;
  const subjectCount = results.filter(r => r.type === 'subject').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              ← Volver al Dashboard
            </Button>
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Búsqueda Global 🔍</h1>
              <p className="text-gray-400">Busca en todos tus documentos, flashcards y materias</p>
            </div>
            {/* Indicador de atajo */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
              <span className="text-sm text-gray-400">Atajo rápido:</span>
              <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-sm border border-gray-600">Ctrl</kbd>
              <span className="text-gray-500">+</span>
              <kbd className="px-2 py-1 bg-gray-700 rounded text-white text-sm border border-gray-600">B</kbd>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <Card className="bg-gray-800 border-gray-700 mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="¿Qué estás buscando?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 h-14 text-lg bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>
            {/* Indicador de búsqueda activa */}
            {isLoading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                Buscando...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtros */}
        <div className="mb-6 space-y-4">
          {/* Filtro por tipo */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('all')}
              className={activeFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-600'}
              size="sm"
            >
              Todos ({results.length})
            </Button>
            <Button
              variant={activeFilter === 'subject' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('subject')}
              className={activeFilter === 'subject' ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-600'}
              size="sm"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Materias ({subjectCount})
            </Button>
            <Button
              variant={activeFilter === 'document' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('document')}
              className={activeFilter === 'document' ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-600'}
              size="sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              Documentos ({documentCount})
            </Button>
            <Button
              variant={activeFilter === 'flashcard' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('flashcard')}
              className={activeFilter === 'flashcard' ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-600'}
              size="sm"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Flashcards ({flashcardCount})
            </Button>
          </div>

          {/* Filtros avanzados (colapsable) */}
          {(activeFilter === 'all' || activeFilter === 'flashcard') && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Filter className="h-4 w-4" />
                  Filtros Avanzados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Filtro por materia */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Materia</label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white text-sm"
                    >
                      <option value="all">Todas las materias</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.icon} {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por dificultad */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Dificultad</label>
                    <select
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value)}
                      className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={activeFilter !== 'all' && activeFilter !== 'flashcard'}
                    >
                      <option value="all">Todas</option>
                      <option value="easy">Fácil</option>
                      <option value="medium">Media</option>
                      <option value="hard">Difícil</option>
                    </select>
                  </div>

                  {/* Filtro por categoría */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Categoría</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={activeFilter !== 'all' && activeFilter !== 'flashcard'}
                    >
                      <option value="all">Todas</option>
                      <option value="Concepto">Concepto</option>
                      <option value="Definición">Definición</option>
                      <option value="Problema">Problema</option>
                      <option value="Fórmula">Fórmula</option>
                      <option value="Proceso">Proceso</option>
                      <option value="Comparación">Comparación</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Resultados */}
        {searchQuery.length < 2 ? (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Escribe al menos 2 caracteres para buscar</p>
            <p className="text-gray-500 text-sm mt-2">Busca en materias, documentos y flashcards</p>
          </div>
        ) : isLoading && results.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Buscando...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No se encontraron resultados para "{debouncedQuery}"</p>
            <p className="text-gray-500 text-sm mt-2">Intenta con otros términos de búsqueda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <Link key={`${result.type}-${result.id}`} href={result.url}>
                <Card className="bg-gray-800 border-gray-700 hover:border-purple-500 transition-all cursor-pointer group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icono del tipo */}
                      <div className="flex-shrink-0 mt-1">
                        {result.type === 'subject' && (
                          <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-purple-400" />
                          </div>
                        )}
                        {result.type === 'document' && (
                          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-400" />
                          </div>
                        )}
                        {result.type === 'flashcard' && (
                          <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-green-400" />
                          </div>
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        {/* Título con highlight */}
                        <h3 
                          className="text-lg font-semibold text-white mb-1 group-hover:text-purple-400 transition-colors"
                          dangerouslySetInnerHTML={{ __html: result.highlight }}
                        />
                        
                        {/* Subtítulo */}
                        {result.subtitle && (
                          <p className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                            <span>{result.subjectIcon}</span>
                            <span>{result.subtitle}</span>
                          </p>
                        )}

                        {/* Contenido con highlight */}
                        <p 
                          className="text-sm text-gray-300 line-clamp-2 mb-2"
                          dangerouslySetInnerHTML={{ __html: highlightText(result.content, debouncedQuery) }}
                        />

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-gray-600 text-gray-400 text-xs">
                            {result.subjectIcon} {result.subjectName}
                          </Badge>
                          {result.difficulty && (
                            <Badge className={`${getDifficultyColor(result.difficulty)} text-xs`}>
                              {result.difficulty === 'easy' ? 'Fácil' : 
                               result.difficulty === 'medium' ? 'Media' : 'Difícil'}
                            </Badge>
                          )}
                          {result.category && (
                            <Badge className={`${getCategoryColor(result.category)} text-xs`}>
                              {result.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Flecha */}
                      <ArrowRight className="h-5 w-5 text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}