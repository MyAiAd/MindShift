import V5TestRunner from '@/components/labs/V5TestRunner';

export const metadata = {
  title: 'V5 Protocol Tests — MindShifting Labs',
};

export default function V5TestsPage() {
  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-1">
        <a href="/dashboard/settings" className="hover:text-foreground transition-colors">Settings</a>
        <span>›</span>
        <span>Labs</span>
        <span>›</span>
        <span className="text-foreground font-medium">V5 Tests</span>
      </nav>

      <V5TestRunner />
    </div>
  );
}
