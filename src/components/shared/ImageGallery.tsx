"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageGalleryProps {
  images: string[];
  alt: string;
  className?: string;
}

export function ImageGallery({ images, alt, className }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mainLoaded, setMainLoaded] = useState(false);
  const [thumbnailsLoaded, setThumbnailsLoaded] = useState<
    Record<number, boolean>
  >({});

  const hasImages = images.length > 0;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex < images.length - 1;

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => Math.max(0, prev - 1));
    setMainLoaded(false);
  }, []);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => Math.min(images.length - 1, prev + 1));
    setMainLoaded(false);
  }, [images.length]);

  const selectImage = useCallback((index: number) => {
    setSelectedIndex(index);
    setMainLoaded(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) {
        goToPrevious();
      } else if (e.key === "ArrowRight" && hasNext) {
        goToNext();
      } else if (e.key === "Escape" && lightboxOpen) {
        setLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPrev, hasNext, goToPrevious, goToNext, lightboxOpen]);

  if (!hasImages) {
    return (
      <div
        className={cn(
          "flex aspect-[16/10] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50",
          className
        )}
      >
        <p className="text-sm text-zinc-500">No images available</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main image */}
      <div className="group relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/50">
        <div className="relative aspect-[16/10]">
          {/* Loading skeleton */}
          {!mainLoaded && (
            <Skeleton className="absolute inset-0 rounded-xl bg-zinc-800/50" />
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative size-full"
            >
              <Image
                src={images[selectedIndex]}
                alt={`${alt} - Image ${selectedIndex + 1}`}
                fill
                className={cn(
                  "object-cover transition-opacity duration-300",
                  mainLoaded ? "opacity-100" : "opacity-0"
                )}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 50vw"
                priority={selectedIndex === 0}
                onLoad={() => setMainLoaded(true)}
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </AnimatePresence>

          {/* Fullscreen button */}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-900/80 text-zinc-300 opacity-0 backdrop-blur-sm transition-all hover:border-amber-500/30 hover:text-amber-400 group-hover:opacity-100"
            aria-label="View fullscreen"
          >
            <Expand className="size-4" />
          </button>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                disabled={!hasPrev}
                className={cn(
                  "absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm transition-all",
                  hasPrev
                    ? "text-zinc-300 opacity-0 hover:border-amber-500/30 hover:text-amber-400 group-hover:opacity-100"
                    : "pointer-events-none opacity-0"
                )}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={goToNext}
                disabled={!hasNext}
                className={cn(
                  "absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm transition-all",
                  hasNext
                    ? "text-zinc-300 opacity-0 hover:border-amber-500/30 hover:text-amber-400 group-hover:opacity-100"
                    : "pointer-events-none opacity-0"
                )}
                aria-label="Next image"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          {/* Image counter badge */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 rounded-md border border-zinc-700/50 bg-zinc-900/80 px-2 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => selectImage(index)}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200",
                index === selectedIndex
                  ? "border-amber-500 shadow-lg shadow-amber-500/20"
                  : "border-zinc-800 opacity-60 hover:border-zinc-600 hover:opacity-100"
              )}
              aria-label={`View image ${index + 1}`}
            >
              <div className="relative size-16 md:h-18 md:w-24">
                {!thumbnailsLoaded[index] && (
                  <Skeleton className="absolute inset-0 bg-zinc-800/50" />
                )}
                <Image
                  src={image}
                  alt={`${alt} - Thumbnail ${index + 1}`}
                  fill
                  className={cn(
                    "object-cover transition-opacity",
                    thumbnailsLoaded[index] ? "opacity-100" : "opacity-0"
                  )}
                  sizes="96px"
                  onLoad={() =>
                    setThumbnailsLoaded((prev) => ({ ...prev, [index]: true }))
                  }
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Active indicator glow */}
              {index === selectedIndex && (
                <div className="absolute inset-0 bg-amber-500/10" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox / Fullscreen Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] border-zinc-800 bg-zinc-950/95 p-0 backdrop-blur-xl sm:max-w-[90vw]"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            {alt} - Image {selectedIndex + 1} of {images.length}
          </DialogTitle>

          <div className="relative flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full border border-zinc-700/50 bg-zinc-900/80 text-zinc-300 backdrop-blur-sm transition-all hover:border-amber-500/30 hover:text-amber-400"
              aria-label="Close lightbox"
            >
              <X className="size-5" />
            </button>

            {/* Main lightbox image */}
            <div className="relative flex h-[80vh] w-full items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="relative h-full w-full"
                >
                  <Image
                    src={images[selectedIndex]}
                    alt={`${alt} - Image ${selectedIndex + 1}`}
                    fill
                    className="object-contain p-4"
                    sizes="90vw"
                    priority
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Lightbox navigation */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevious}
                  disabled={!hasPrev}
                  className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 size-12 rounded-full border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm",
                    hasPrev
                      ? "text-zinc-300 hover:border-amber-500/30 hover:bg-zinc-800/80 hover:text-amber-400"
                      : "pointer-events-none opacity-30"
                  )}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  disabled={!hasNext}
                  className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 size-12 rounded-full border border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm",
                    hasNext
                      ? "text-zinc-300 hover:border-amber-500/30 hover:bg-zinc-800/80 hover:text-amber-400"
                      : "pointer-events-none opacity-30"
                  )}
                  aria-label="Next image"
                >
                  <ChevronRight className="size-6" />
                </Button>
              </>
            )}

            {/* Lightbox counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-zinc-700/50 bg-zinc-900/80 px-4 py-1.5 text-sm font-medium text-zinc-300 backdrop-blur-sm">
                {selectedIndex + 1} / {images.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
