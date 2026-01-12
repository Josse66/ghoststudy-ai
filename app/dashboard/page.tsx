'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  FileText, 
  Brain, 
  TrendingUp, 
  Calendar, 
  Flame, 
  Target,
  Clock,
  Award,
  Zap,
  PieChart,
  Play,
  ChevronRight,
  Upload
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface PendingBySubject {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  subjectIcon: string;
  pendingCount: number;
}

interface DashboardStats {
  subjects: number;
  documents: number;
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
      concepto: number;
      definicion: number;
      problema: number;
      formula: number;
      proceso: number;
      comparacion: number;
    };
  };
  studyStreak: number;
  lastStudyDate: string | null;
  totalStudyTime: number;
  weeklyActivity: Array<{
    day: string;
    easy: number;
    medium: number;
    hard: number;
    total: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    subjects: 0,
    documents: 0,
    flashcards: { 
      total: 0, 
      reviewed: 0, 
      dueToday: 0,
      byDifficulty: { easy: 0, medium: 0, hard: 0 },
      byCategory: { concepto: 0, definicion: 0, problema: 0, formula: 0, proceso: 0, comparacion: 0 }
    },
    studyStreak: 0,
    lastStudyDate: null,
    totalStudyTime: 0,
    weeklyActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [recentSubjects, setRecentSubjects] = useState<any[]>([]);
  const [pendingBySubject, setPendingBySubject] = useState<PendingBySubject[]>([]);
  const [showPendingBreakdown, setShowPendingBreakdown] = useState(false);
  const [showStudyModal, setShowStudyModal] = useState(false);

  useEffect(() => {
    loadDashboardStats();
    loadRecentSubjects();
    loadPendingBySubject();
  }, []);

  const loadPendingBySubject = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Obtener flashcards pendientes con sus materias
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select(`
          id,
          next_review_at,
          subjects (
            id,
            name,
            color,
            icon
          )
        `)
        .eq('user_id', user.id)
        .not('subjects', 'is', null);

      if (!flashcards) return;

      // Agrupar por materia
      const grouped: Record<string, PendingBySubject> = {};

      flashcards.forEach((fc: any) => {
        const isPending = !fc.next_review_at || new Date(fc.next_review_at) <= today;
        if (!isPending || !fc.subjects) return;

        const subjectId = fc.subjects.id;
        if (!grouped[subjectId]) {
          grouped[subjectId] = {
            subjectId,
            subjectName: fc.subjects.name,
            subjectColor: fc.subjects.color,
            subjectIcon: fc.subjects.icon,
            pendingCount: 0,
          };
        }
        grouped[subjectId].pendingCount++;
      });

      setPendingBySubject(Object.values(grouped).sort((a, b) => b.pendingCount - a.pendingCount));
    } catch (error) {
      console.error('Error loading pending by subject:', error);
    }
  };

  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { count: subjectsCount } = await supabase
        .from('subjects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: documentsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('times_reviewed, next_review_at, last_reviewed_at, difficulty, category')
        .eq('user_id', user.id);

      const flashcardsTotal = flashcards?.length || 0;
      const flashcardsReviewed = flashcards?.filter(f => f.times_reviewed > 0).length || 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const flashcardsDueToday = flashcards?.filter(f => {
        if (!f.next_review_at) return true;
        const reviewDate = new Date(f.next_review_at);
        reviewDate.setHours(0, 0, 0, 0);
        return reviewDate <= today;
      }).length || 0;

      const byDifficulty = {
        easy: flashcards?.filter(f => f.difficulty === 'easy').length || 0,
        medium: flashcards?.filter(f => f.difficulty === 'medium').length || 0,
        hard: flashcards?.filter(f => f.difficulty === 'hard').length || 0,
      };

      const byCategory = {
        concepto: flashcards?.filter(f => f.category === 'concepto').length || 0,
        definicion: flashcards?.filter(f => f.category === 'definicion').length || 0,
        problema: flashcards?.filter(f => f.category === 'problema').length || 0,
        formula: flashcards?.filter(f => f.category === 'formula').length || 0,
        proceso: flashcards?.filter(f => f.category === 'proceso').length || 0,
        comparacion: flashcards?.filter(f => f.category === 'comparacion').length || 0,
      };

      const { streak, lastDate } = calculateStreak(flashcards || []);
      const weeklyActivity = calculateWeeklyActivity(flashcards || []);
      const totalStudyTime = Math.round((flashcardsReviewed * 0.5));

      setStats({
        subjects: subjectsCount || 0,
        documents: documentsCount || 0,
        flashcards: {
          total: flashcardsTotal,
          reviewed: flashcardsReviewed,
          dueToday: flashcardsDueToday,
          byDifficulty,
          byCategory,
        },
        studyStreak: streak,
        lastStudyDate: lastDate,
        totalStudyTime,
        weeklyActivity,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSubjects = async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id, name, color, icon, updated_at')
      .order('updated_at', { ascending: false })
      .limit(3);

    if (data) setRecentSubjects(data);
  };

  const calculateStreak = (flashcards: any[]) => {
    const reviewDates = flashcards
      .filter(f => f.last_reviewed_at)
      .map(f => new Date(f.last_reviewed_at))
      .sort((a, b) => b.getTime() - a.getTime());

    if (reviewDates.length === 0) return { streak: 0, lastDate: null };

    const lastDate = reviewDates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    const lastReviewDate = new Date(lastDate);
    lastReviewDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 1) {
      return { streak: 0, lastDate: lastDate.toISOString() };
    }

    const uniqueDates = new Set(
      reviewDates.map(d => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    );

    const sortedUniqueDates = Array.from(uniqueDates).sort((a, b) => b - a);

    for (let i = 0; i < sortedUniqueDates.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);

      if (sortedUniqueDates[i] === expectedDate.getTime()) {
        streak++;
      } else {
        break;
      }
    }

    return { streak, lastDate: lastDate.toISOString() };
  };

  const calculateWeeklyActivity = (flashcards: any[]) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const activity = Array(7).fill(null).map((_, i) => ({
      day: days[(new Date().getDay() - 6 + i + 7) % 7],
      easy: 0,
      medium: 0,
      hard: 0,
      total: 0,
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    flashcards.forEach(f => {
      if (!f.last_reviewed_at) return;
      const reviewDate = new Date(f.last_reviewed_at);
      reviewDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 0 && daysDiff < 7) {
        const index = 6 - daysDiff;
        activity[index].total++;
        
        if (f.difficulty === 'easy') activity[index].easy++;
        else if (f.difficulty === 'medium') activity[index].medium++;
        else if (f.difficulty === 'hard') activity[index].hard++;
      }
    });

    return activity;
  };

  const getStreakMessage = () => {
    if (stats.studyStreak === 0) return '¡Comienza tu racha hoy!';
    if (stats.studyStreak === 1) return '¡Buen comienzo!';
    if (stats.studyStreak < 7) return '¡Sigue así!';
    if (stats.studyStreak < 30) return '¡Excelente consistencia!';
    return '¡Eres una máquina! 🔥';
  };

  const completionPercentage = stats.flashcards.total > 0
    ? Math.round((stats.flashcards.reviewed / stats.flashcards.total) * 100)
    : 0;

  const difficultyData = [
    { name: 'Fácil', value: stats.flashcards.byDifficulty.easy, color: '#10b981' },
    { name: 'Medio', value: stats.flashcards.byDifficulty.medium, color: '#f59e0b' },
    { name: 'Difícil', value: stats.flashcards.byDifficulty.hard, color: '#ef4444' },
  ].filter(item => item.value > 0);

  const categoryData = [
    { name: 'Concepto', value: stats.flashcards.byCategory.concepto, color: '#3b82f6' },
    { name: 'Definición', value: stats.flashcards.byCategory.definicion, color: '#10b981' },
    { name: 'Problema', value: stats.flashcards.byCategory.problema, color: '#f97316' },
    { name: 'Fórmula', value: stats.flashcards.byCategory.formula, color: '#8b5cf6' },
    { name: 'Proceso', value: stats.flashcards.byCategory.proceso, color: '#eab308' },
    { name: 'Comparación', value: stats.flashcards.byCategory.comparacion, color: '#ec4899' },
  ].filter(item => item.value > 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard 📊</h1>
          <p className="text-gray-400">Tu progreso y estadísticas de estudio</p>
        </div>

        {/* Stats Overview - FUNCIONALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Link href="/dashboard/subjects">
            <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-700 cursor-pointer hover:border-blue-500 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Materias</p>
                    <p className="text-3xl font-bold text-blue-400">{stats.subjects}</p>
                  </div>
                  <BookOpen className="h-10 w-10 text-blue-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card 
            className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-700 cursor-pointer hover:border-purple-500 transition-colors"
            onClick={() => router.push('/dashboard/subjects')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Documentos</p>
                  <p className="text-3xl font-bold text-purple-400">{stats.documents}</p>
                </div>
                <FileText className="h-10 w-10 text-purple-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-700 cursor-pointer hover:border-green-500 transition-colors"
            onClick={() => setShowStudyModal(true)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Flashcards</p>
                  <p className="text-3xl font-bold text-green-400">{stats.flashcards.total}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.flashcards.reviewed} revisadas
                  </p>
                </div>
                <Brain className="h-10 w-10 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-900/40 to-orange-800/20 border-orange-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Racha</p>
                  <p className="text-3xl font-bold text-orange-400">{stats.studyStreak}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.studyStreak === 1 ? 'día' : 'días'}
                  </p>
                </div>
                <Flame className="h-10 w-10 text-orange-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Más pequeños y arriba */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <Link href="/dashboard/subjects">
            <Button className="w-full h-14 bg-purple-600 hover:bg-purple-700">
              <BookOpen className="mr-2 h-5 w-5" />
              Ver Materias
            </Button>
          </Link>
          
          <Link href="/dashboard/subjects">
            <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700">
              <Upload className="mr-2 h-5 w-5" />
              Subir Documento
            </Button>
          </Link>

          <Button 
            onClick={() => setShowStudyModal(true)}
            className="w-full h-14 bg-green-600 hover:bg-green-700"
          >
            <Brain className="mr-2 h-5 w-5" />
            Estudiar Ahora
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5 text-purple-400" />
                Progreso de Repaso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-400">Flashcards completadas</p>
                  <p className="text-sm font-semibold text-white">{completionPercentage}%</p>
                </div>
                <Progress value={completionPercentage} className="h-3 bg-gray-700" />
                <p className="text-xs text-gray-500 mt-1">
                  {stats.flashcards.reviewed} de {stats.flashcards.total} flashcards revisadas
                </p>
              </div>

              {/* Pendientes hoy CON BREAKDOWN */}
              {stats.flashcards.dueToday > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-6 w-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-400 mb-1">
                        {stats.flashcards.dueToday} flashcards pendientes hoy
                      </p>
                      <p className="text-sm text-gray-400 mb-3">
                        Es hora de repasar para mantener el conocimiento fresco
                      </p>
                      
                      {pendingBySubject.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPendingBreakdown(!showPendingBreakdown)}
                            className="text-yellow-400 hover:text-yellow-300 p-0 h-auto"
                          >
                            {showPendingBreakdown ? '▼' : '▶'} Ver por materia
                          </Button>
                          
                          {showPendingBreakdown && (
                            <div className="space-y-2 mt-2">
                              {pendingBySubject.map((subject) => (
                                <div
                                  key={subject.subjectId}
                                  className="flex items-center justify-between p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span style={{ color: subject.subjectColor }}>
                                      {subject.subjectIcon || '📚'}
                                    </span>
                                    <span className="text-sm">{subject.subjectName}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-yellow-400 font-bold text-sm">
                                      {subject.pendingCount}
                                    </span>
                                    <Button
                                      size="sm"
                                      onClick={() => router.push(`/dashboard/subjects/${subject.subjectId}/flashcards/study`)}
                                      className="bg-yellow-600 hover:bg-yellow-700 h-7 text-xs"
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Estudiar
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        size="sm"
                        onClick={() => setShowStudyModal(true)}
                        className="bg-yellow-600 hover:bg-yellow-700"
                      >
                        <Zap className="mr-2 h-4 w-4" />
                        Comenzar Repaso
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-400 mb-3">Actividad de los últimos 7 días</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.weeklyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#9ca3af"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(value: any, name: any) => {
                        const labels: Record<string, string> = {
                          easy: 'Fácil',
                          medium: 'Medio',
                          hard: 'Difícil',
                        };
                        return [value, labels[String(name)] || String(name)];
                      }}
                    />
                    <Legend 
                      formatter={(value: any) => {
                        const labels: Record<string, string> = {
                          easy: 'Fácil',
                          medium: 'Medio',
                          hard: 'Difícil',
                        };
                        return labels[String(value)] || String(value);
                      }}
                    />
                    <Bar dataKey="easy" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="medium" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="hard" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Calendario Card */}
<Card className="bg-gray-800 border-gray-700">
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-white">
      <Calendar className="h-5 w-5 text-indigo-400" />
      Calendario de Repasos
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-center py-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
        <Calendar className="h-8 w-8 text-white" />
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Visualiza tu calendario de repasos y planifica tu estudio
      </p>
      <Link href="/dashboard/calendar">
        <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
          Ver Calendario Completo
        </Button>
      </Link>
    </div>
  </CardContent>
</Card>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {difficultyData.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <PieChart className="h-5 w-5 text-purple-400" />
                    Por Dificultad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={difficultyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
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
                          color: '#fff'
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
                        <span className="font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {categoryData.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Brain className="h-5 w-5 text-blue-400" />
                    Por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {categoryData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-gray-300">{item.name}</span>
                        </div>
                        <span className="font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Flame className="h-5 w-5 text-orange-400" />
                  Racha de Estudio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-orange-600 to-red-600 mb-4">
                    <p className="text-4xl font-bold">{stats.studyStreak}</p>
                  </div>
                  <p className="text-2xl font-bold mb-2">
                    {stats.studyStreak === 1 ? 'Día' : 'Días'}
                  </p>
                  <p className="text-sm text-gray-400 mb-4">{getStreakMessage()}</p>
                  {stats.lastStudyDate && (
                    <p className="text-xs text-gray-500">
                      Último repaso: {new Date(stats.lastStudyDate).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock className="h-5 w-5 text-blue-400" />
                  Tiempo de Estudio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-blue-400 mb-2">
                    {stats.totalStudyTime}
                  </p>
                  <p className="text-sm text-gray-400">minutos totales</p>
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-500">
                      Promedio: {stats.flashcards.reviewed > 0 
                        ? '~30s'
                        : '0s'} por tarjeta
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border-yellow-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Award className="h-10 w-10 text-yellow-400" />
                  <div>
                    <p className="font-semibold text-yellow-400">
                      {stats.flashcards.reviewed > 50 
                        ? '🏆 Estudiante Dedicado'
                        : stats.flashcards.reviewed > 20
                        ? '🌟 En Progreso'
                        : '🚀 Principiante'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats.flashcards.reviewed > 50
                        ? '+50 flashcards revisadas'
                        : stats.flashcards.reviewed > 20
                        ? 'Sigue repasando'
                        : 'Comienza tu viaje'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {recentSubjects.length > 0 && (
          <Card className="bg-gray-800 border-gray-700 mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  Materias Recientes
                </CardTitle>
                <Link href="/dashboard/subjects">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                    Ver todas →
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recentSubjects.map((subject) => (
                  <Link key={subject.id} href={`/dashboard/subjects/${subject.id}`}>
                    <Card className="bg-gray-700/50 border-gray-600 hover:border-purple-600 transition-colors cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded flex items-center justify-center"
                            style={{ backgroundColor: `${subject.color}30` }}
                          >
                            <span style={{ color: subject.color }} className="text-2xl">
                              {subject.icon || '📚'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-white line-clamp-1">
                              {subject.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(subject.updated_at).toLocaleDateString('es-MX')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {/* Footer Motivacional - SIN botones duplicados */}
        <div className="mt-12 space-y-8">
          {/* Frase motivacional */}
          <div className="text-center space-y-4">
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              🔥 "Sigue adelante, lo estás haciendo increíble"
            </p>
            
            <Button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              variant="outline"
              className="border-gray-700 bg-white text-black hover:bg-gray-100 hover:border-purple-600 transition-all font-semibold"
            >
              <svg 
                className="mr-2 h-4 w-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Volver arriba
            </Button>
          </div>

          {/* Branding */}
          <p className="text-xs text-gray-600 text-center mt-8">
            GhostStudy AI - Tu compañero de estudio inteligente 👻
          </p>
        </div>

        {/* Modal: Estudiar Ahora */}
        {showStudyModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="bg-gray-800 border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="h-6 w-6 text-green-400" />
                    Comenzar Sesión de Estudio
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStudyModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pendingBySubject.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-gray-400 mb-4">
                      Tienes <span className="text-green-400 font-bold">{stats.flashcards.dueToday}</span> flashcards pendientes. Selecciona una materia:
                    </p>
                    {pendingBySubject.map((subject) => (
                      <div
                        key={subject.subjectId}
                        onClick={() => {
                          setShowStudyModal(false);
                          router.push(`/dashboard/subjects/${subject.subjectId}/flashcards/study`);
                        }}
                        className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-600 hover:border-green-600"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded flex items-center justify-center"
                            style={{ backgroundColor: `${subject.subjectColor}30` }}
                          >
                            <span style={{ color: subject.subjectColor }} className="text-2xl">
                              {subject.subjectIcon || '📚'}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-white">{subject.subjectName}</p>
                            <p className="text-sm text-gray-400">
                              {subject.pendingCount} flashcard{subject.pendingCount !== 1 ? 's' : ''} pendiente{subject.pendingCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Award className="h-16 w-16 text-green-400 mx-auto mb-4" />
                    <p className="text-xl font-bold mb-2">¡Excelente trabajo!</p>
                    <p className="text-gray-400 mb-6">
                      No tienes flashcards pendientes por hoy
                    </p>
                    <Link href="/dashboard/subjects">
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        Ver Materias
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}