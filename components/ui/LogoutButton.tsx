'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      // Forzar navegación completa
      window.location.href = '/';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={loading}
      variant="destructive"
      size="lg"
      className="bg-red-600 hover:bg-red-700"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? 'Cerrando sesión...' : 'Cerrar Sesión'}
    </Button>
  );
}