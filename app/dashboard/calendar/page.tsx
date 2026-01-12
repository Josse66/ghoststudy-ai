'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ArrowLeft, Brain } from 'lucide-react';
import Link from 'next/link';

interface DayData {
  date: string;
  count: number;
  reviewed: number;
  pending: number;
}

interface FlashcardDetail {
  id: string;
  front: string;
  difficulty: string;
  category: string;
  subject: {
    name: string;
    color: string;
    icon: string;
  };
}

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Map<string, DayData>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayFlashcards, setSelectedDayFlashcards] = useState<FlashcardDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalendarData();
  }, [currentDate]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Obtener primer y último día del mes
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Obtener todas las flashcards con sus fechas de repaso
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select(`
          id,
          next_review_at,
          last_reviewed_at,
          times_reviewed
        `)
        .eq('user_id', user.id);

      // Crear mapa de datos por día
      const dataMap = new Map<string, DayData>();

      // Inicializar todos los días del mes
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        dataMap.set(dateKey, {
          date: dateKey,
          count: 0,
          reviewed: 0,
          pending: 0,
        });
      }

      // Procesar flashcards
      flashcards?.forEach((fc) => {
        // Contar repasos realizados
        if (fc.last_reviewed_at) {
          const reviewDate = new Date(fc.last_reviewed_at).toISOString().split('T')[0];
          if (dataMap.has(reviewDate)) {
            const day = dataMap.get(reviewDate)!;
            day.reviewed++;
            day.count++;
          }
        }

        // Contar pendientes
        if (fc.next_review_at) {
          const dueDate = new Date(fc.next_review_at).toISOString().split('T')[0];
          if (dataMap.has(dueDate)) {
            const day = dataMap.get(dueDate)!;
            day.pending++;
          }
        }
      });

      setCalendarData(dataMap);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDayFlashcards = async (dateStr: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const targetDate = new Date(dateStr);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const { data: flashcards } = await supabase
        .from('flashcards')
        .select(`
          id,
          front,
          difficulty,
          category,
          next_review_at,
          subjects (
            name,
            color,
            icon
          )
        `)
        .eq('user_id', user.id)
        .gte('next_review_at', targetDate.toISOString())
        .lt('next_review_at', nextDay.toISOString());

      setSelectedDayFlashcards(flashcards as any || []);
    } catch (error) {
      console.error('Error loading day flashcards:', error);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    loadDayFlashcards(dateStr);
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-gray-800 border-gray-700';
    if (count <= 2) return 'bg-green-900/40 border-green-700';
    if (count <= 5) return 'bg-green-700/60 border-green-600';
    if (count <= 10) return 'bg-green-600/80 border-green-500';
    return 'bg-green-500 border-green-400';
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();

    const days: React.ReactNode[] = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Headers de días
    dayNames.forEach((day) => {
      days.push(
        <div key={`header-${day}`} className="text-center text-xs text-gray-500 font-semibold p-2">
          {day}
        </div>
      );
    });

    // Días vacíos antes del primer día
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Días del mes
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = calendarData.get(dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isSelected = dateStr === selectedDate;

      days.push(
        <button
          key={dateStr}
          onClick={() => handleDateClick(dateStr)}
          className={`
            p-2 rounded-lg border-2 transition-all hover:scale-105 relative
            ${getIntensityColor(dayData?.count || 0)}
            ${isToday ? 'ring-2 ring-blue-500' : ''}
            ${isSelected ? 'ring-2 ring-purple-500' : ''}
          `}
        >
          <div className="text-sm font-semibold">{day}</div>
          {dayData && dayData.count > 0 && (
            <div className="text-xs text-green-400 mt-1">{dayData.count}</div>
          )}
          {dayData && dayData.pending > 0 && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full"></div>
          )}
        </button>
      );
    }

    return days;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: { [key: string]: string } = {
      easy: 'bg-green-500/20 text-green-400 border-green-500/50',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      hard: 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[difficulty] || 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  };

  const getDifficultyLabel = (difficulty: string) => {
    const labels: { [key: string]: string } = {
      easy: 'Fácil',
      medium: 'Medio',
      hard: 'Difícil',
    };
    return labels[difficulty] || difficulty;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando calendario...</p>
        </div>
      </div>
    );
  }

  const monthName = currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <CalendarIcon className="h-10 w-10 text-purple-400" />
                Calendario de Repasos
              </h1>
              <p className="text-gray-400">Visualiza tu actividad y próximos repasos</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2 bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="capitalize">{monthName}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goToToday} className="text-xs">
                    Hoy
                  </Button>
                  <Button variant="ghost" size="icon" onClick={previousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">{renderCalendar()}</div>

              {/* Legend */}
              <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
                <span>Menos</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-gray-800 border border-gray-700"></div>
                  <div className="w-4 h-4 rounded bg-green-900/40 border border-green-700"></div>
                  <div className="w-4 h-4 rounded bg-green-700/60 border border-green-600"></div>
                  <div className="w-4 h-4 rounded bg-green-600/80 border border-green-500"></div>
                  <div className="w-4 h-4 rounded bg-green-500 border border-green-400"></div>
                </div>
                <span>Más</span>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar - Day Details */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                {selectedDate ? 'Detalles del Día' : 'Selecciona un día'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="space-y-4">
                  <div className="text-center pb-4 border-b border-gray-700">
                    <p className="text-2xl font-bold mb-1">
                      {new Date(selectedDate).toLocaleDateString('es-MX', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                    <p className="text-sm text-gray-400">
                      {selectedDayFlashcards.length} flashcard
                      {selectedDayFlashcards.length !== 1 ? 's' : ''} programada
                      {selectedDayFlashcards.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {selectedDayFlashcards.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedDayFlashcards.map((fc) => (
                        <div
                          key={fc.id}
                          className="p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span
                              style={{ color: fc.subject.color }}
                              className="text-lg flex-shrink-0"
                            >
                              {fc.subject.icon || '📚'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-400 mb-1">{fc.subject.name}</p>
                              <p className="text-sm font-medium line-clamp-2">{fc.front}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getDifficultyColor(
                                fc.difficulty
                              )}`}
                            >
                              {getDifficultyLabel(fc.difficulty)}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">{fc.category}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No hay flashcards programadas para este día</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Haz click en un día del calendario para ver los detalles</p>
                  <div className="mt-6 space-y-2 text-xs text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span>Borde azul = Hoy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span>Punto amarillo = Repasos pendientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span>Verde intenso = Más actividad</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-400">
                  {Array.from(calendarData.values()).reduce((sum, day) => sum + day.reviewed, 0)}
                </p>
                <p className="text-sm text-gray-400 mt-1">Flashcards repasadas este mes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {Array.from(calendarData.values()).reduce((sum, day) => sum + day.pending, 0)}
                </p>
                <p className="text-sm text-gray-400 mt-1">Repasos programados este mes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {Array.from(calendarData.values()).filter((day) => day.count > 0).length}
                </p>
                <p className="text-sm text-gray-400 mt-1">Días activos este mes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}