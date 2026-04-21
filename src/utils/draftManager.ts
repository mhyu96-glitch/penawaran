export interface DocumentDraft {
    id: string;
    type: 'quote' | 'invoice';
    data: any;
    lastSaved: string;
}

const DRAFT_KEY = 'penawaran_document_drafts';

export const saveDraft = (type: 'quote' | 'invoice', data: any, id?: string) => {
    const drafts = getDrafts();
    const draftId = id || `draft_${Date.now()}`;
    const newDraft: DocumentDraft = {
        id: draftId,
        type,
        data,
        lastSaved: new Date().toISOString(),
    };

    const index = drafts.findIndex(d => d.id === draftId);
    if (index >= 0) {
        drafts[index] = newDraft;
    } else {
        drafts.push(newDraft);
    }

    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
    return draftId;
};

export const getDrafts = (): DocumentDraft[] => {
    const stored = localStorage.getItem(DRAFT_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const getDraft = (id: string): DocumentDraft | undefined => {
    return getDrafts().find(d => d.id === id);
};

export const deleteDraft = (id: string) => {
    const drafts = getDrafts().filter(d => d.id !== id);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
};

export const clearDrafts = () => {
    localStorage.removeItem(DRAFT_KEY);
};
