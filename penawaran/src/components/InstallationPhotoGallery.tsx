import React, { useRef, useState } from 'react';
import { compressInstallationPhoto } from '@/services/cctvCommandService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Link2,
  Maximize2,
  Trash2,
  Upload,
} from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

interface InstallationPhotoGalleryProps {
  photos: string[];
  projectTitle: string;
  editable?: boolean;
  compact?: boolean;
  onChangePhotos?: (newPhotos: string[]) => void;
}

export const InstallationPhotoGallery: React.FC<InstallationPhotoGalleryProps> = ({
  photos = [],
  projectTitle,
  editable = false,
  compact = false,
  onChangePhotos,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');

  const safeIndex = photos.length > 0 ? Math.min(activeIndex, photos.length - 1) : 0;

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !onChangePhotos) return;

    setUploading(true);
    try {
      const compressedList: string[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await compressInstallationPhoto(file, 1080, 0.78);
        if (dataUrl) compressedList.push(dataUrl);
      }
      if (compressedList.length > 0) {
        const nextPhotos = [...photos, ...compressedList];
        onChangePhotos(nextPhotos);
        setActiveIndex(nextPhotos.length - 1);
        showSuccess(`${compressedList.length} foto instalasi berhasil ditambahkan!`);
      }
    } catch {
      showError('Gagal memproses file foto.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlValue.trim();
    if (!trimmed || !onChangePhotos) return;
    const nextPhotos = [...photos, trimmed];
    onChangePhotos(nextPhotos);
    setActiveIndex(nextPhotos.length - 1);
    setUrlValue('');
    setShowUrlInput(false);
    showSuccess('Link foto berhasil ditambahkan!');
  };

  const handleRemovePhoto = (idx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!onChangePhotos) return;
    const next = photos.filter((_, i) => i !== idx);
    onChangePhotos(next);
    if (activeIndex >= next.length) {
      setActiveIndex(Math.max(0, next.length - 1));
    }
  };

  const openLightboxAt = (idx: number) => {
    setActiveIndex(idx);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-2">
      {/* Hidden File Input for Direct Device/Camera Upload */}
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Camera className="h-3.5 w-3.5 text-teal-500" />
          Dokumentasi Foto ({photos.length})
        </span>

        {editable && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-6 px-2 rounded-lg text-[10px] font-bold border-teal-500/40 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 gap-1"
            >
              <Upload className="h-3 w-3" />
              {uploading ? 'Memproses...' : '+ Upload Foto'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowUrlInput((prev) => !prev)}
              className="h-6 px-1.5 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground"
              title="Tambah Foto via Link URL"
            >
              <Link2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Optional URL Input Box */}
      {editable && showUrlInput && (
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Tempel URL foto (https://...)"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            className="h-7 rounded-lg text-[11px]"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddUrl}
            className="h-7 px-2.5 rounded-lg text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white shrink-0"
          >
            Tambah
          </Button>
        </div>
      )}

      {/* Gallery Content */}
      {photos.length > 0 ? (
        <div className="space-y-1.5">
          {/* Featured Main Image */}
          <div
            onClick={() => openLightboxAt(safeIndex)}
            className={cn(
              'group relative w-full overflow-hidden rounded-xl border border-border/80 bg-slate-950 cursor-pointer',
              compact ? 'h-28' : 'h-40'
            )}
          >
            <img
              src={photos[safeIndex]}
              alt={`${projectTitle} - Foto ${safeIndex + 1}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-85 group-hover:opacity-100 transition-opacity" />

            <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/65 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold">
                <Maximize2 className="h-2.5 w-2.5 text-teal-400" />
                Klik Perbesar ({safeIndex + 1}/{photos.length})
              </span>

              {editable && (
                <button
                  type="button"
                  onClick={(e) => handleRemovePhoto(safeIndex, e)}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-600/90 hover:bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  title="Hapus Foto Ini"
                >
                  <Trash2 className="h-2.5 w-2.5" /> Hapus
                </button>
              )}
            </div>
          </div>

          {/* Thumbnail Strip */}
          {photos.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {photos.map((photoUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    'relative h-11 w-16 shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer transition-all',
                    idx === safeIndex
                      ? 'border-teal-500 ring-1 ring-teal-500/40 opacity-100'
                      : 'border-border/60 opacity-65 hover:opacity-100'
                  )}
                >
                  <img
                    src={photoUrl}
                    alt={`Thumb ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => editable && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 text-center transition-colors',
            editable && 'cursor-pointer hover:border-teal-500/50 hover:bg-teal-500/5'
          )}
        >
          <ImagePlus className="h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-[11px] font-semibold text-muted-foreground">
            {editable
              ? 'Belum ada foto. Klik untuk upload foto hasil pemasangan.'
              : 'Dokumentasi foto belum diunggah.'}
          </p>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl rounded-2xl border-border bg-card p-4 sm:p-5">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm sm:text-base font-black flex items-center justify-between pr-6">
              <span className="truncate">{projectTitle}</span>
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 shrink-0 ml-2">
                Foto {safeIndex + 1} dari {photos.length}
              </span>
            </DialogTitle>
          </DialogHeader>

          {photos.length > 0 && (
            <div className="space-y-3">
              <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black/95 h-[320px] sm:h-[460px]">
                <img
                  src={photos[safeIndex]}
                  alt={`${projectTitle} - ${safeIndex + 1}`}
                  className="max-h-full max-w-full object-contain"
                />

                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => (prev - 1 + photos.length) % photos.length)
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-teal-600 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex((prev) => (prev + 1) % photos.length)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-teal-600 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Lightbox Thumbnails */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {photos.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        'h-12 w-18 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                        idx === safeIndex
                          ? 'border-teal-500 scale-105'
                          : 'border-border/60 opacity-60 hover:opacity-100'
                      )}
                    >
                      <img src={p} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>

                {editable && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      handleRemovePhoto(safeIndex);
                      if (photos.length <= 1) setLightboxOpen(false);
                    }}
                    className="h-8 rounded-xl text-xs font-bold shrink-0"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Foto Ini
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
