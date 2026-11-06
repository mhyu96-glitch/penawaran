-- =============================================================================
-- BORNEO ETAM CCTV & POS COMMAND CENTER - NON-DESTRUCTIVE EXTENSION SCHEMA
-- Prasyarat: 100% Aman, tidak mengubah atau menghapus tabel/data lama
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cctv_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    project_name VARCHAR(200) NOT NULL,
    public_display_name VARCHAR(200),
    client_name VARCHAR(150),
    client_phone VARCHAR(50),
    address_landmark TEXT,
    service_type VARCHAR(50) NOT NULL DEFAULT 'CCTV' CHECK (service_type IN ('CCTV', 'POS', 'BUNDLING')),
    package_name VARCHAR(150),
    city VARCHAR(100) NOT NULL DEFAULT 'Samarinda',
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    sn_nvr VARCHAR(100),
    sn_hdd VARCHAR(100),
    hardware_specs TEXT,
    installed_at DATE,
    warranty_months INTEGER NOT NULL DEFAULT 12,
    rating NUMERIC(2, 1) DEFAULT 5.0,
    review_text TEXT,
    preferred_survey_date DATE,
    preferred_survey_time VARCHAR(50),
    is_public_portfolio BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indeks Kinerja Geospasial & Filter
CREATE INDEX IF NOT EXISTS idx_cctv_installations_user_id ON public.cctv_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_cctv_installations_city ON public.cctv_installations(city);
CREATE INDEX IF NOT EXISTS idx_cctv_installations_service_type ON public.cctv_installations(service_type);
CREATE INDEX IF NOT EXISTS idx_cctv_installations_progress ON public.cctv_installations(progress);
CREATE INDEX IF NOT EXISTS idx_cctv_installations_public ON public.cctv_installations(is_public_portfolio);

-- Row Level Security (RLS)
ALTER TABLE public.cctv_installations ENABLE ROW LEVEL SECURITY;

-- 1. Admin / Owner memiliki akses penuh atas datanya sendiri
DROP POLICY IF EXISTS "Users can manage own cctv_installations" ON public.cctv_installations;
CREATE POLICY "Users can manage own cctv_installations"
    ON public.cctv_installations
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Publik (Anon) hanya bisa membaca data yang ditandai is_public_portfolio = true
DROP POLICY IF EXISTS "Public can view public portfolio items" ON public.cctv_installations;
CREATE POLICY "Public can view public portfolio items"
    ON public.cctv_installations
    FOR SELECT
    TO anon, authenticated
    USING (is_public_portfolio = true);

-- 3. Calon konsumen publik dapat mengirim permintaan jadwal survei baru (progress = 0)
DROP POLICY IF EXISTS "Public can submit survey requests" ON public.cctv_installations;
CREATE POLICY "Public can submit survey requests"
    ON public.cctv_installations
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (progress = 0);
