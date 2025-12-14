'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Send, Loader2, FileText, Sparkles, ListChecks, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  subjects: { 
    name: string; 
    color: string;
  } | null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar documento y mensajes
  useEffect(() => {
    loadDocument();
    loadMessages();
  }, [documentId]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadDocument = async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, title, subjects(name, color)')
      .eq('id', documentId)
      .single();

    if (data) {
      // Mapear manualmente para evitar conflictos de tipo
      const doc: Document = {
        id: data.id as string,
        title: data.title as string,
        subjects: data.subjects ? {
          name: (data.subjects as any).name,
          color: (data.subjects as any).color,
        } : null,
      };
      setDocument(doc);
    }
  };

  const loadMessages = async () => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
    setLoadingMessages(false);
  };

  const sendMessage = async (messageText?: string, action?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    setLoading(true);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          message: textToSend,
          action: action || 'chat',
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      icon: FileText,
      label: 'Resumir',
      action: 'summary',
      message: 'Resume este documento',
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      icon: ListChecks,
      label: 'Flashcards',
      action: 'flashcards',
      message: 'Genera flashcards',
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      icon: HelpCircle,
      label: 'Examen',
      action: 'quiz',
      message: 'Crea preguntas de práctica',
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      icon: Sparkles,
      label: 'Explicar',
      action: 'explain',
      message: 'Explica los conceptos principales',
      color: 'bg-orange-600 hover:bg-orange-700',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto p-4">
          <Link href={`/dashboard/documents/${documentId}`}>
            <Button variant="ghost" size="sm" className="mb-2 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al documento
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded flex items-center justify-center text-lg"
              style={{
                backgroundColor: document?.subjects?.color
                  ? `${document.subjects.color}20`
                  : '#8b5cf620',
              }}
            >
              <FileText className="h-5 w-5" style={{ color: document?.subjects?.color || '#8b5cf6' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold">{document?.title || 'Cargando...'}</h1>
              <p className="text-sm text-gray-400">Chat con IA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {loadingMessages ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-16 w-16 text-purple-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">¡Hola! 👋</h2>
              <p className="text-gray-400 mb-2">
                Pregúntame lo que quieras sobre este documento
              </p>
              <p className="text-sm text-gray-500">
                Usa los botones de "Chat Rápido" en la parte inferior ⬇️
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`max-w-[80%] p-4 ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs mt-2 opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </Card>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <Card className="bg-gray-800 p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <span className="text-gray-400">Pensando...</span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-800/50 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-5xl mx-auto p-4 space-y-3">
          {/* Quick Actions - SIEMPRE VISIBLE */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">⚡ Chat Rápido</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.action}
                    onClick={() => sendMessage(action.message, action.action)}
                    disabled={loading}
                    size="sm"
                    className={`${action.color} text-white flex items-center gap-2 text-xs py-2`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Input de texto */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Escribe tu pregunta o usa los botones de arriba..."
              disabled={loading}
              className="bg-gray-700 border-gray-600 text-white flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}