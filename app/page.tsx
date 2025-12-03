import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Brain, Zap, Target, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            👻 GhostStudy AI
          </h1>
          <p className="text-2xl text-gray-300 mb-8">
            Tu compañero de estudio invisible con inteligencia artificial
          </p>
          <p className="text-lg text-gray-400 mb-12">
            Sube tus apuntes, genera flashcards automáticamente y estudia de forma inteligente.
            Perfecto para universitarios y estudiantes de preparatoria.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                Comenzar Gratis 🚀
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white">
                Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <Card className="p-6 bg-gray-800 border-gray-700">
            <Brain className="w-12 h-12 text-purple-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">IA Inteligente</h3>
            <p className="text-gray-400">
              Chatea con tus documentos y genera flashcards automáticamente
            </p>
          </Card>

          <Card className="p-6 bg-gray-800 border-gray-700">
            <Zap className="w-12 h-12 text-pink-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Súper Rápido</h3>
            <p className="text-gray-400">
              Escanea apuntes con tu cámara y estudia desde el móvil
            </p>
          </Card>

          <Card className="p-6 bg-gray-800 border-gray-700">
            <Target className="w-12 h-12 text-blue-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Modo Examen</h3>
            <p className="text-gray-400">
              Simula exámenes reales con timer y análisis de errores
            </p>
          </Card>

          <Card className="p-6 bg-gray-800 border-gray-700">
            <Users className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">Gamificación</h3>
            <p className="text-gray-400">
              Gana XP, sube niveles y compite con tus amigos
            </p>
          </Card>
        </div>

        {/* Stats */}
        <div className="text-center mt-20">
          <p className="text-gray-400 mb-4">100% Gratis • Sin Límites • Sin Tarjeta de Crédito</p>
          <div className="flex gap-8 justify-center text-sm">
            <div>
              <p className="text-3xl font-bold text-purple-400">∞</p>
              <p className="text-gray-400">Documentos</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-pink-400">∞</p>
              <p className="text-gray-400">Flashcards</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-400">∞</p>
              <p className="text-gray-400">IA Requests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>Hecho con 💜 para estudiantes | GhostStudy AI © 2024</p>
        </div>
      </footer>
    </div>
  );
}