import FloatingSearchButton from '@/components/FloatingSearchButton';

export default function DashboardLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <>
      {children}
      <FloatingSearchButton />
    </>
  );
}