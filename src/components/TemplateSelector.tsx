import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DOCUMENT_TEMPLATES } from '@/lib/utils';
import { Check, Layout, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface TemplateSelectorProps {
    selectedTemplate: string;
    onSelect: (templateId: string) => void;
}

const templatePreviews: Record<string, { colors: string[]; layout: string }> = {
    professional: { colors: ['#3B82F6', '#1E40AF', '#EFF6FF'], layout: 'Clean minimal lines, blue accent header' },
    corporate: { colors: ['#1F2937', '#6B7280', '#F9FAFB'], layout: 'Traditional bordered sections' },
    minimal: { colors: ['#111827', '#E5E7EB', '#FFFFFF'], layout: 'Whitespace-focused, thin dividers' },
    colorful: { colors: ['#7C3AED', '#DDD6FE', '#FAF5FF'], layout: 'Purple gradient, rounded elements' },
};

const TemplateSelector = ({ selectedTemplate, onSelect }: TemplateSelectorProps) => {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                <h3 className="font-semibold">Template Dokumen</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DOCUMENT_TEMPLATES.map(template => {
                    const preview = templatePreviews[template.id] || templatePreviews.modern;
                    const isSelected = selectedTemplate === template.id;
                    return (
                        <Card
                            key={template.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => onSelect(template.id)}
                        >
                            <CardContent className="p-3">
                                {/* Mini preview */}
                                <div className="aspect-[3/4] rounded border mb-2 overflow-hidden relative">
                                    <div className="h-1/5 w-full" style={{ backgroundColor: preview.colors[0] }} />
                                    <div className="p-2 space-y-1">
                                        <div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: preview.colors[1] }} />
                                        <div className="h-1 w-1/2 rounded bg-gray-200" />
                                        <div className="mt-2 space-y-0.5">
                                            <div className="h-1 w-full rounded bg-gray-100" />
                                            <div className="h-1 w-full rounded bg-gray-100" />
                                            <div className="h-1 w-3/4 rounded bg-gray-100" />
                                        </div>
                                        <div className="mt-2 space-y-0.5">
                                            <div className="h-1 w-full rounded bg-gray-200" />
                                            <div className="h-1 w-full rounded bg-gray-100" />
                                            <div className="h-1 w-full rounded bg-gray-100" />
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                <Check className="h-4 w-4 text-primary-foreground" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs font-medium text-center">{template.label}</p>
                                {isSelected && <Badge variant="default" className="w-full justify-center mt-1 text-xs">Aktif</Badge>}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default TemplateSelector;
