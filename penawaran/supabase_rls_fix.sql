-- Kebijakan RLS untuk tabel 'profiles'
-- Pengguna dapat melihat profil mereka sendiri
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- Pengguna dapat memperbarui profil mereka sendiri
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Kebijakan RLS untuk tabel 'clients'
-- Pengguna dapat membuat klien
CREATE POLICY "Users can create clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Pengguna dapat melihat klien mereka sendiri
CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
-- Pengguna dapat memperbarui klien mereka sendiri
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
-- Pengguna dapat menghapus klien mereka sendiri
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'items'
CREATE POLICY "Users can create items" ON public.items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own items" ON public.items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own items" ON public.items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own items" ON public.items FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'quotes'
CREATE POLICY "Users can create quotes" ON public.quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own quotes" ON public.quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own quotes" ON public.quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own quotes" ON public.quotes FOR DELETE USING (auth.uid() = user_id);
-- Kebijakan publik untuk melihat penawaran (tanpa user_id check)
CREATE POLICY "Public view quotes" ON public.quotes FOR SELECT USING (true);

-- Kebijakan RLS untuk tabel 'quote_items'
CREATE POLICY "Users can create quote_items" ON public.quote_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_id AND quotes.user_id = auth.uid()));
CREATE POLICY "Users can view their own quote_items" ON public.quote_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_id AND quotes.user_id = auth.uid()));
CREATE POLICY "Users can update their own quote_items" ON public.quote_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_id AND quotes.user_id = auth.uid()));
CREATE POLICY "Users can delete their own quote_items" ON public.quote_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_id AND quotes.user_id = auth.uid()));
-- Kebijakan publik untuk melihat item penawaran
CREATE POLICY "Public view quote_items" ON public.quote_items FOR SELECT USING (true);

-- Kebijakan RLS untuk tabel 'invoices'
CREATE POLICY "Users can create invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);
-- Kebijakan publik untuk melihat faktur (tanpa user_id check)
CREATE POLICY "Public view invoices" ON public.invoices FOR SELECT USING (true);

-- Kebijakan RLS untuk tabel 'invoice_items'
CREATE POLICY "Users can create invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "Users can view their own invoice_items" ON public.invoice_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "Users can update their own invoice_items" ON public.invoice_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "Users can delete their own invoice_items" ON public.invoice_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_id AND invoices.user_id = auth.uid()));
-- Kebijakan publik untuk melihat item faktur
CREATE POLICY "Public view invoice_items" ON public.invoice_items FOR SELECT USING (true);

-- Kebijakan RLS untuk tabel 'expenses'
CREATE POLICY "Users can create expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'payments'
CREATE POLICY "Users can create payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own payments" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own payments" ON public.payments FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'projects'
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'project_tasks'
CREATE POLICY "Users can create project tasks" ON public.project_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own project tasks" ON public.project_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own project tasks" ON public.project_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own project tasks" ON public.project_tasks FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'time_entries'
CREATE POLICY "Users can create time entries" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own time entries" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own time entries" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own time entries" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'notifications'
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel 'workflows'
CREATE POLICY "Users can create workflows" ON public.workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own workflows" ON public.workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own workflows" ON public.workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own workflows" ON public.workflows FOR DELETE USING (auth.uid() = user_id);