'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calendar,
  Clock,
  FileText,
  Flame,
  Target,
  TrendingUp,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SubjectStats {
  subject: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  documents: {
    total: number;
    list: Array<{
      id: string;
      title: string;
      flashcards_count: number;
      reviewed_count: number;
    }>;
  };
  flashcards: {
    total: number;
    reviewed: number;
    dueToday: number;
    byDifficulty: {
      easy: number;
      medium: number;
      hard: number;
    };
    byCategory: {
      [key: string]: number;
    };
  };
  studyTime: number;
  weeklyActivity: Array<{
    day: string;
    count: number;
  }>;
  upcomingReviews: Array<{
    date: string;
    count: number;
  }>;
}

export default function SubjectStatsPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;

  const [stats, setStats] = useState<SubjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subjectId) {
      loadSubjectStats();
    }
  }, [subjectId]);

  const loadSubjectStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Obtener datos de la materia
      const { data: subject } = await supabase
        .from('subjects')
        .select('id, name, color, icon')
        .eq('id', subjectId)
        .single();

      if (!subject) {
        router.push('/dashboard/subjects');
        return;
      }

      // Obtener documentos
      const { data: documents } = await supabase
        .from('documents')
        .select('id, title')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id);

      // Obtener flashcards de la materia
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('id, difficulty, category, times_reviewed, next_review_at, last_reviewed_at, document_id')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id);

      // Calcular estadísticas de documentos
      const documentStats = documents?.map((doc) => {
        const docFlashcards = flashcards?.filter((f) => f.document_id === doc.id) || [];
        return {
          id: doc.id,
          title: doc.title,
          flashcards_count: docFlashcards.length,
          reviewed_count: docFlashcards.filter((f) => f.times_reviewed > 0).length,
        };
      }) || [];

      // Flashcards por dificultad
      const byDifficulty = {
        easy: flashcards?.filter((f) => f.difficulty === 'easy').length || 0,
        medium: flashcards?.filter((f) => f.difficulty === 'medium').length || 0,
        hard: flashcards?.filter((f) => f.difficulty === 'hard').length || 0,
      };

      // Flashcards por categoría
      const byCategory: { [key: string]: number } = {};
      flashcards?.forEach((f) => {
        byCategory[f.category] = (byCategory[f.category] || 0) + 1;
      });

      // Flashcards pendientes hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueToday = flashcards?.filter((f) => {
        if (!f.next_review_at) return true;
        const reviewDate = new Date(f.next_review_at);
        reviewDate.setHours(0, 0, 0, 0);
        return reviewDate <= today;
      }).length || 0;

      // Actividad semanal
      const weeklyActivity = calculateWeeklyActivity(flashcards || []);

      // Próximos repasos (próximos 7 días)
      const upcomingReviews = calculateUpcomingReviews(flashcards || []);

      // Tiempo de estudio estimado
      const reviewedCount = flashcards?.filter((f) => f.times_reviewed > 0).length || 0;
      const studyTime = Math.round((reviewedCount * 0.5)); // 30 segundos por flashcard

      setStats({
        subject,
        documents: {
          total: documents?.length || 0,
          list: documentStats,
        },
        flashcards: {
          total: flashcards?.length || 0,
          reviewed: reviewedCount,
          dueToday,
          byDifficulty,
          byCategory,
        },
        studyTime,
        weeklyActivity,
        upcomingReviews,
      });
    } catch (error) {
      console.error('Error loading subject stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWeeklyActivity = (flashcards: any[]) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const activity = Array(7)
      .fill(null)
      .map((_, i) => ({
        day: days[(new Date().getDay() - 6 + i + 7) % 7],
        count: 0,
      }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    flashcards.forEach((f) => {
      if (!f.last_reviewed_at) return;
      const reviewDate = new Date(f.last_reviewed_at);
      reviewDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 0 && daysDiff < 7) {
        const index = 6 - daysDiff;
        activity[index].count++;
      }
    });

    return activity;
  };

  const calculateUpcomingReviews = (flashcards: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reviewsByDate: { [key: string]: number } = {};

    flashcards.forEach((f) => {
      if (!f.next_review_at) return;
      const reviewDate = new Date(f.next_review_at);
      reviewDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((reviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff >= 0 && daysDiff <= 7) {
        const dateKey = reviewDate.toISOString().split('T')[0];
        reviewsByDate[dateKey] = (reviewsByDate[dateKey] || 0) + 1;
      }
    });

    return Object.entries(reviewsByDate)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        count,
      }))
      .slice(0, 7);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">No se pudo cargar la materia</p>
          <Link href="/dashboard/subjects">
            <Button>Volver a Materias</Button>
          </Link>
        </div>
      </div>
    );
  }

  const completionPercentage =
    stats.flashcards.total > 0
      ? Math.round((stats.flashcards.reviewed / stats.flashcards.total) * 100)
      : 0;

  const difficultyData = [
    { name: 'Fácil', value: stats.flashcards.byDifficulty.easy, color: '#10b981' },
    { name: 'Medio', value: stats.flashcards.byDifficulty.medium, color: '#f59e0b' },
    { name: 'Difícil', value: stats.flashcards.byDifficulty.hard, color: '#ef4444' },
  ].filter((item) => item.value > 0);

  const categoryData = Object.entries(stats.flashcards.byCategory).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: getCategoryColor(name),
  }));

  function getCategoryColor(category: string) {
    const colors: { [key: string]: string } = {
      concepto: '#3b82f6',
      definicion: '#10b981',
      problema: '#f97316',
      formula: '#8b5cf6',
      proceso: '#eab308',
      comparacion: '#ec4899',
    };
    return colors[category] || '#6b7280';
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/dashboard/subjects/${subjectId}`}>
            <Button variant="ghost" className="mb-4 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la materia
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-2">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl"
              style={{ backgroundColor: `${stats.subject.color}30` }}
            >
              <span style={{ color: stats.subject.color }}>{stats.subject.icon || '📚'}</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold">{stats.subject.name}</h1>
              <p className="text-gray-400">Estadísticas detalladas</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Documentos</p>
                  <p className="text-3xl font-bold text-blue-400">{stats.documents.total}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Flashcards</p>
                  <p className="text-3xl font-bold text-green-400">{stats.flashcards.total}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.flashcards.reviewed} revisadas</p>
                </div>
                <Brain className="h-10 w-10 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border-yellow-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Pendientes Hoy</p>
                  <p className="text-3xl font-bold text-yellow-400">{stats.flashcards.dueToday}</p>
                </div>
                <Calendar className="h-10 w-10 text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Tiempo Total</p>
                  <p className="text-3xl font-bold text-purple-400">{stats.studyTime}</p>
                  <p className="text-xs text-gray-500 mt-1">minutos</p>
                </div>
                <Clock className="h-10 w-10 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progreso General */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  Progreso General
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-400">Flashcards completadas</p>
                      <p className="text-sm font-semibold">{completionPercentage}%</p>
                    </div>
                    <Progress value={completionPercentage} className="h-3" />
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.flashcards.reviewed} de {stats.flashcards.total} flashcards
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actividad Semanal */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Actividad de los últimos 7 días
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stats.weeklyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Próximos Repasos */}
            {stats.upcomingReviews.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-400" />
                    Próximos Repasos (7 días)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.upcomingReviews}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: '#10b981', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Documentos */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-400" />
                  Documentos ({stats.documents.total})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.documents.list.length > 0 ? (
                  <div className="space-y-3">
                    {stats.documents.list.map((doc) => (
                      <Link key={doc.id} href={`/dashboard/documents/${doc.id}`}>
                        <div className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-white">{doc.title}</p>
                            <span className="text-sm text-gray-400">
                              {doc.flashcards_count} flashcards
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={
                                doc.flashcards_count > 0
                                  ? (doc.reviewed_count / doc.flashcards_count) * 100
                                  : 0
                              }
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-gray-500">
                              {doc.reviewed_count}/{doc.flashcards_count}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-8">No hay documentos en esta materia</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Por Dificultad */}
            {difficultyData.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-base">Por Dificultad</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <RechartsPie>
                      <Pie
                        data={difficultyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {difficultyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {difficultyData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-gray-300">{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Por Categoría */}
            {categoryData.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-base">Por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryData.map((item) => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300">{item.name}</span>
                          <span className="text-sm font-semibold">{item.value}</span>
                        </div>
                        <Progress
                          value={(item.value / stats.flashcards.total) * 100}
                          className="h-2"
                          style={{
                            ['--progress-background' as any]: item.color,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resumen */}
            <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Award className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                  <p className="text-lg font-bold mb-1">
                    {completionPercentage > 75
                      ? '¡Excelente progreso!'
                      : completionPercentage > 50
                      ? '¡Vas muy bien!'
                      : '¡Sigue así!'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {stats.flashcards.reviewed} flashcards dominadas
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}