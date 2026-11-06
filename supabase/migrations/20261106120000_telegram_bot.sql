-- =============================================================================
-- BOT TELEGRAM BORNEO ETAM - tabel pendukung (non-destruktif, tidak mengubah tabel lama)
-- =============================================================================

-- Paket penawaran milik owner (opsional). Bila kosong, bot memakai katalog bawaan.
CREATE TABLE IF NOT EXISTS public.borneo_packages (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, id)
);

ALTER TABLE public.borneo_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own borneo_packages" ON public.borneo_packages;
CREATE POLICY "Users can manage own borneo_packages"
    ON public.borneo_packages
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Aksi yang menunggu konfirmasi "Ya" di Telegram.
-- RLS aktif TANPA policy: hanya service role (Edge Function) yang bisa mengakses.
CREATE TABLE IF NOT EXISTS public.telegram_pending_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('quote', 'invoice', 'project', 'progress')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'need_location', 'done', 'cancelled')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_telegram_pending_chat ON public.telegram_pending_actions(chat_id, created_at DESC);

ALTER TABLE public.telegram_pending_actions ENABLE ROW LEVEL SECURITY;
