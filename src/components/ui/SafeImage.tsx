import React, { useState } from 'react';
import { cn, getMediaUrl } from '@/lib/utils';
import { Image as ImageIcon } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

export function SafeImage({ src, fallback, className, alt = '', ...props }: SafeImageProps) {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={cn("flex items-center justify-center bg-white/5", className)}>
        <ImageIcon className="w-1/3 h-1/3 text-white/20" />
      </div>
    );
  }

  return (
    <img
      src={getMediaUrl(src)}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
}
