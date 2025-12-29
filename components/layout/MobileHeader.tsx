'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  showBack = false,
  onBack,
  actions,
  className,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header
      className={cn(
        'md:hidden sticky top-0 z-40 bg-white/90 dark:bg-[#002b36]/90 backdrop-blur-lg border-b border-border pt-safe',
        className
      )}
    >
      <div className="flex items-center h-14 px-4 gap-2">
        {showBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="touch-target -ml-2"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <h1 className="flex-1 text-lg font-semibold truncate min-w-0">
          {title}
        </h1>

        {actions ? (
          <div className="flex items-center gap-1">{actions}</div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="touch-target"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
