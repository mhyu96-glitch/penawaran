"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  UploadCloud, 
  FileText, 
  X, 
  Loader2, 
  Image as ImageIcon, 
  Camera, 
  Plus, 
  Eye, 
  Trash2,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Attachment {
  name: string;
  url: string;
  path: string;
  caption?: string;
  type?: 'image' | 'file';
}

interface AttachmentManagerProps {
  docId?: string;
  docType: 'quote' | 'invoice';
  initialAttachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

export const AttachmentManager = ({ docId, docType, initialAttachments = [], onAttachmentsChange }: AttachmentManagerProps) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [previewPhoto, setPreviewPhoto] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageFile = (fileName: string, url: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) return true;
    if (url.startsWith('data:image/')) return true;
    return false;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const files = Array.from(event.target.files);
    setIsUploading(true);

    const newUploadedList: Attachment[] = [];

    for (const file of files) {
      const isImg = file.type.startsWith('image/');
      const fileExt = file.name.split('.').pop();
      const currentDocId = docId || `temp-${Date.now()}`;
      const filePath = `${user?.id || 'anon'}/${docType}s/${currentDocId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      let fileUrl = '';
      let storagePath = filePath;

      if (user) {
        try {
          const { error: uploadError } = await supabase.storage
            .from('document_attachments')
            .upload(filePath, file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('document_attachments')
              .getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              fileUrl = urlData.publicUrl;
            }
          }
        } catch (storageErr) {
          console.warn('Storage upload fallback:', storageErr);
        }
      }

      // Fallback to Base64 data URL if storage upload failed or user offline
      if (!fileUrl) {
        fileUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        storagePath = `local-${Date.now()}`;
      }

      newUploadedList.push({
        name: file.name,
        url: fileUrl,
        path: storagePath,
        caption: '',
        type: isImg ? 'image' : 'file',
      });
    }

    const updatedAttachments = [...attachments, ...newUploadedList];
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
    showSuccess(`${newUploadedList.length} lampiran berhasil ditambahkan!`);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const updated = attachments.map((att, i) => i === index ? { ...att, caption } : att);
    setAttachments(updated);
    onAttachmentsChange(updated);
  };

  const handleRemoveAttachment = async (indexToRemove: number) => {
    const attachmentToRemove = attachments[indexToRemove];
    if (user && attachmentToRemove.path && !attachmentToRemove.path.startsWith('local-')) {
      try {
        await supabase.storage
          .from('document_attachments')
          .remove([attachmentToRemove.path]);
      } catch (err) {
        console.error('Delete storage error:', err);
      }
    }

    const updatedAttachments = attachments.filter((_, i) => i !== indexToRemove);
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
    showSuccess('Lampiran berhasil dihapus.');
  };

  const imageAttachments = attachments.filter(att => att.type === 'image' || isImageFile(att.name, att.url));
  const docAttachments = attachments.filter(att => att.type !== 'image' && !isImageFile(att.name, att.url));

  return (
    <div className="space-y-4 rounded-2xl bg-muted/20 border border-border/80 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-primary" />
            Dokumentasi & Lampiran Foto Survei Lapangan
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Lampirkan foto titik pemasangan, kondisi jalur, atau fisik unit toko untuk memperjelas penawaran Anda.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs gap-1.5 shrink-0"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span>Tambah Foto / Dokumen</span>
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileUpload}
        disabled={isUploading}
      />

      {/* Gallery of Uploaded Survey Photos */}
      {imageAttachments.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Foto Lapangan ({imageAttachments.length}):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {attachments.map((attachment, index) => {
              if (!isImageFile(attachment.name, attachment.url)) return null;

              return (
                <div 
                  key={attachment.path || index} 
                  className="group relative rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xs hover:border-primary/50 transition-all flex flex-col"
                >
                  {/* Image Preview with Lightbox trigger */}
                  <div 
                    onClick={() => setPreviewPhoto(attachment)}
                    className="relative aspect-video w-full bg-black/20 cursor-pointer overflow-hidden"
                  >
                    <img 
                      src={attachment.url} 
                      alt={attachment.caption || attachment.name} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
                        <Eye className="h-4 w-4" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveAttachment(index);
                      }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm"
                      title="Hapus Foto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Caption / Note Input */}
                  <div className="p-2.5 space-y-1 bg-muted/10 border-t border-border/60">
                    <Input
                      placeholder="Keterangan foto (misal: Titik 1 Kamera Parkir)"
                      value={attachment.caption || ''}
                      onChange={(e) => handleCaptionChange(index, e.target.value)}
                      className="h-8 text-xs rounded-lg font-medium bg-background border-border/70 focus-visible:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {attachment.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-image File Documents List */}
      {docAttachments.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Berkas Lampiran Dokumen ({docAttachments.length}):
          </span>
          <div className="space-y-1.5">
            {attachments.map((attachment, index) => {
              if (isImageFile(attachment.name, attachment.url)) return null;

              return (
                <div key={attachment.path || index} className="flex items-center justify-between p-2.5 border border-border/80 rounded-xl bg-card">
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline truncate">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{attachment.name}</span>
                  </a>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveAttachment(index)} 
                    className="h-7 w-7 text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State Dropzone */}
      {attachments.length === 0 && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center h-28 w-full rounded-xl border-2 border-dashed border-border/80 bg-background/50 hover:bg-muted/30 cursor-pointer transition-colors p-4 text-center"
        >
          <Camera className="h-6 w-6 text-muted-foreground/70 mb-1.5" />
          <span className="text-xs font-bold text-foreground">Klik untuk upload foto survei / fisik unit</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Bisa pilih beberapa foto sekaligus dari HP atau Komputer</span>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-3 p-4 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">{previewPhoto.caption || previewPhoto.name}</h4>
                <span className="text-xs text-slate-400">{previewPhoto.name}</span>
              </div>
              <Button 
                onClick={() => setPreviewPhoto(null)}
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center">
              <img src={previewPhoto.url} alt={previewPhoto.caption || previewPhoto.name} className="max-h-[70vh] w-auto object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentManager;

