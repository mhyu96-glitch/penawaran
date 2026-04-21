"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, FileText, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/SessionContext';
import { showError, showSuccess } from '@/utils/toast';

interface Attachment {
  name: string;
  url: string;
  path: string; // Path in Supabase Storage
}

interface AttachmentManagerProps {
  docId: string;
  docType: 'quote' | 'invoice';
  initialAttachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

const AttachmentManager = ({ docId, docType, initialAttachments, onAttachmentsChange }: AttachmentManagerProps) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) {
      return;
    }

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${docType}s/${docId}/${Date.now()}.${fileExt}`;

    setIsUploading(true);
    const { error: uploadError } = await supabase.storage
      .from('document_attachments')
      .upload(filePath, file);

    if (uploadError) {
      showError('Gagal mengunggah file.');
      console.error('File upload error:', uploadError);
      setIsUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('document_attachments').getPublicUrl(filePath);
    const newAttachment: Attachment = {
      name: file.name,
      url: urlData.publicUrl,
      path: filePath,
    };

    const updatedAttachments = [...attachments, newAttachment];
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
    showSuccess('File berhasil diunggah!');
    setIsUploading(false);
    event.target.value = ''; // Clear the input
  };

  const handleRemoveAttachment = async (attachmentToRemove: Attachment) => {
    if (!user) return;

    // Remove from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('document_attachments')
      .remove([attachmentToRemove.path]);

    if (deleteError) {
      showError('Gagal menghapus file dari penyimpanan.');
      console.error('File delete error:', deleteError);
      return;
    }

    // Remove from local state and notify parent
    const updatedAttachments = attachments.filter(att => att.path !== attachmentToRemove.path);
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
    showSuccess('Lampiran berhasil dihapus.');
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="attachment-upload">Lampiran Dokumen</Label>
      <div className="flex items-center justify-center w-full">
        <label htmlFor={`dropzone-file-${docId}`} className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isUploading ? (
              <Loader2 className="w-8 h-8 mb-2 text-gray-500 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 mb-2 text-gray-500" />
            )}
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Klik untuk unggah</span> atau seret file
            </p>
            <p className="text-xs text-gray-500">Ukuran maks 5MB</p>
          </div>
          <Input
            id={`dropzone-file-${docId}`}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
              <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <FileText className="h-4 w-4" />
                {attachment.name}
              </a>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveAttachment(attachment)} disabled={isUploading}>
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentManager;