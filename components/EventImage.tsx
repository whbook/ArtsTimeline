import React, { useState } from 'react';

interface EventImageProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}

const EventImage: React.FC<EventImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  eager = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const showImage = !!src && !hasError;

  return (
    <div className={`relative overflow-hidden bg-[#ede7dc] ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover transition-transform duration-500 ${imgClassName}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_center,#d9c7a5_1px,transparent_1px)] [background-size:12px_12px]">
          <span className="font-serif text-xs tracking-[0.24em] text-stone-400">CALLIGRAPHY</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
    </div>
  );
};

export default EventImage;
