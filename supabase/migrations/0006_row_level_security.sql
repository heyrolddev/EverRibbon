--
-- Row-level security: what each role may see and change.
--
-- Enabled on every table, then seventy-five policies. This is the only thing
-- standing between one customer and another's orders, so a table added later
-- without a policy is one nobody outside the service role can read -- which is
-- the safe direction to fail in.
--
-- Part of the baseline schema.
--
-- This is a new database with no history, so the schema is the state it should
-- be in rather than a replay of changes that never happened here. It was made by
-- loading the original system's forty-one migrations into Postgres, renaming the
-- food vocabulary in place so the database itself rewrote the foreign keys,
-- indexes and policies, and dumping the result -- then checked by loading it
-- back into an empty database.
--
-- The order of these files is the order Postgres resolved, not one chosen here.
-- From this point the ordinary rule applies: never edit a migration that has
-- run. Add a new one.
--

-- Settings every file in the baseline runs under.
--
-- check_function_bodies is the load-bearing one. A LANGUAGE sql function is
-- parsed when it is created, and several here read tables that are declared
-- further down the same file -- bump_faq_hit reads faq_entries about twelve
-- hundred lines before it exists. Turning the check off lets the schema load
-- in dependency order for tables while leaving functions where they read
-- best. Dropping this line was what made the first split fail.
--
-- search_path is emptied so every reference has to name its schema, which is
-- why everything below says public.<name> rather than trusting a path that a
-- caller could change underneath it.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET search_path TO '';
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions create own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "create own push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: reviews customer_delete_own_review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_delete_own_review ON public.reviews FOR DELETE USING (((customer_id = auth.uid()) OR public.is_staff()));


--
-- Name: orders customer_insert_own_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_insert_own_orders ON public.orders FOR INSERT WITH CHECK ((public.is_staff() OR ((customer_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND p.is_blocked)))))));


--
-- Name: reviews customer_insert_own_review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_insert_own_review ON public.reviews FOR INSERT WITH CHECK ((public.is_staff() OR ((customer_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND p.is_blocked)))) AND (((product_id IS NULL) AND public.has_completed_order()) OR ((product_id IS NOT NULL) AND public.has_bought_product(product_id))))));


--
-- Name: orders customer_select_own_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_select_own_orders ON public.orders FOR SELECT USING (((customer_id = auth.uid()) OR public.is_staff()));


--
-- Name: orders customer_update_own_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_update_own_orders ON public.orders FOR UPDATE USING ((public.is_staff() OR ((customer_id = auth.uid()) AND (status = 'pending'::text)))) WITH CHECK ((public.is_staff() OR ((customer_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'cancelled'::text])))));


--
-- Name: reviews customer_update_own_review; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_update_own_review ON public.reviews FOR UPDATE USING (((customer_id = auth.uid()) OR public.is_staff())) WITH CHECK (((customer_id = auth.uid()) OR public.is_staff()));


--
-- Name: cycle_counts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cycle_counts ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions delete own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete own push subscriptions" ON public.push_subscriptions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: delivery_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: device_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: error_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

--
-- Name: faq_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_log insert_activity_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_activity_log ON public.activity_log FOR INSERT WITH CHECK (public.is_staff());


--
-- Name: order_lines insert_own_order_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_own_order_lines ON public.order_lines FOR INSERT WITH CHECK ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_lines.order_id) AND (o.customer_id = auth.uid()) AND (o.status = 'pending'::text))))));


--
-- Name: production_run_materials manager_all_production_run_materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_production_run_materials ON public.production_run_materials USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: production_runs manager_all_production_runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_production_runs ON public.production_runs USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: cycle_counts manager_all_cycle_counts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_cycle_counts ON public.cycle_counts USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: material_lots manager_all_material_lots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_material_lots ON public.material_lots USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: materials manager_all_materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_materials ON public.materials USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: product_components manager_all_product_components; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_product_components ON public.product_components USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: product_materials manager_all_product_materials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_product_materials ON public.product_materials USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: purchases manager_all_purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_all_purchases ON public.purchases USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: announcements manager_read_all_announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_read_all_announcements ON public.announcements FOR SELECT USING (public.is_manager());


--
-- Name: announcements manager_write_announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_write_announcements ON public.announcements USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: faq_entries manager_write_faq; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_write_faq ON public.faq_entries USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: product_packaging manager_write_product_packaging; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_write_product_packaging ON public.product_packaging USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: order_packaging manager_write_order_packaging; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY manager_write_order_packaging ON public.order_packaging USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: material_lots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_lots ENABLE ROW LEVEL SECURITY;

--
-- Name: material_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.material_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: oe_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.oe_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: order_packaging; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_packaging ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_ledger owner_all_cash_ledger; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_all_cash_ledger ON public.cash_ledger USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: oe_templates owner_all_oe_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_all_oe_templates ON public.oe_templates USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: receivables owner_all_receivables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_all_receivables ON public.receivables USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: settings owner_all_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_all_settings ON public.settings USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: products owner_delete_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_delete_products ON public.products FOR DELETE USING (public.is_owner());


--
-- Name: assets owner_manage_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_manage_assets ON public.assets USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: error_log owner_manage_error_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_manage_error_log ON public.error_log USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: fixed_costs owner_manage_fixed_costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_manage_fixed_costs ON public.fixed_costs USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: restore_snapshots owner_manage_restore_snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_manage_restore_snapshots ON public.restore_snapshots USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: staff_shifts owner_manage_shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_manage_shifts ON public.staff_shifts FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: chat_settings owner_write_chat_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_write_chat_settings ON public.chat_settings FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: products owner_write_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_write_products ON public.products FOR INSERT WITH CHECK (public.is_owner());


--
-- Name: catalog_categories owner_write_catalog_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_write_catalog_categories ON public.catalog_categories USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: payment_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: product_components; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

--
-- Name: product_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: product_packaging; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_packaging ENABLE ROW LEVEL SECURITY;

--
-- Name: production_run_materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_run_materials ENABLE ROW LEVEL SECURITY;

--
-- Name: production_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_owner_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_owner_manage ON public.profiles FOR INSERT WITH CHECK (public.is_owner());


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (((id = auth.uid()) OR public.is_staff()));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (((id = auth.uid()) OR public.is_staff())) WITH CHECK (((id = auth.uid()) OR public.is_staff()));


--
-- Name: chat_settings public_read_chat_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_chat_settings ON public.chat_settings FOR SELECT USING (true);


--
-- Name: shop_closures public_read_closures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_closures ON public.shop_closures FOR SELECT USING (true);


--
-- Name: delivery_settings public_read_delivery_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_delivery_settings ON public.delivery_settings FOR SELECT USING (true);


--
-- Name: faq_entries public_read_faq; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_faq ON public.faq_entries FOR SELECT USING ((is_active OR public.is_staff()));


--
-- Name: shop_hours public_read_hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_hours ON public.shop_hours FOR SELECT USING (true);


--
-- Name: announcements public_read_live_announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_live_announcements ON public.announcements FOR SELECT USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))));


--
-- Name: payment_settings public_read_payment_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_payment_settings ON public.payment_settings FOR SELECT USING (true);


--
-- Name: shop_settings public_read_shop_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_shop_settings ON public.shop_settings FOR SELECT USING (true);


--
-- Name: products public_select_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_select_products ON public.products FOR SELECT USING ((((is_public = true) AND (is_available = true)) OR public.is_staff()));


--
-- Name: purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions read own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read own push subscriptions" ON public.push_subscriptions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: activity_log read_activity_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_activity_log ON public.activity_log FOR SELECT USING (public.is_manager());


--
-- Name: product_packaging read_product_packaging; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_product_packaging ON public.product_packaging FOR SELECT USING (true);


--
-- Name: catalog_categories read_catalog_categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_catalog_categories ON public.catalog_categories FOR SELECT USING (true);


--
-- Name: order_packaging read_order_packaging; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_order_packaging ON public.order_packaging FOR SELECT USING (true);


--
-- Name: device_sessions read_own_devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_own_devices ON public.device_sessions FOR SELECT USING (((user_id = auth.uid()) OR public.is_owner()));


--
-- Name: reviews read_published_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_published_reviews ON public.reviews FOR SELECT USING (((NOT is_hidden) OR (customer_id = auth.uid()) OR public.is_staff()));


--
-- Name: receivables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

--
-- Name: restore_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restore_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: order_lines select_own_order_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_own_order_lines ON public.order_lines FOR SELECT USING ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_lines.order_id) AND (o.customer_id = auth.uid()))))));


--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_closures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shop_closures ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shop_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: material_usage staff_all_material_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all_material_usage ON public.material_usage USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: waste staff_all_waste; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_all_waste ON public.waste USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: shop_closures staff_delete_closures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_delete_closures ON public.shop_closures FOR DELETE USING (public.is_staff());


--
-- Name: order_lines staff_delete_order_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_delete_order_lines ON public.order_lines FOR DELETE USING ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_lines.order_id) AND (o.customer_id = auth.uid()) AND (o.status = 'pending'::text))))));


--
-- Name: orders staff_delete_orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_delete_orders ON public.orders FOR DELETE USING (public.is_staff());


--
-- Name: shop_closures staff_insert_closures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_insert_closures ON public.shop_closures FOR INSERT WITH CHECK (public.is_staff());


--
-- Name: order_lines staff_manage_order_lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage_order_lines ON public.order_lines FOR UPDATE USING ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_lines.order_id) AND (o.customer_id = auth.uid()) AND (o.status = 'pending'::text)))))) WITH CHECK ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_lines.order_id) AND (o.customer_id = auth.uid()) AND (o.status = 'pending'::text))))));


--
-- Name: reviews staff_only_relayed_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_only_relayed_reviews ON public.reviews AS RESTRICTIVE FOR INSERT WITH CHECK (((source = 'customer'::text) OR (auth.uid() IS NULL) OR public.is_staff()));


--
-- Name: chat_messages staff_read_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_read_messages ON public.chat_messages FOR SELECT USING ((public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.chat_threads t
  WHERE ((t.id = chat_messages.thread_id) AND (t.customer_id IS NOT NULL) AND (t.customer_id = auth.uid()))))));


--
-- Name: chat_threads staff_read_threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_read_threads ON public.chat_threads FOR SELECT USING ((public.is_staff() OR ((customer_id IS NOT NULL) AND (customer_id = auth.uid()))));


--
-- Name: staff_shifts staff_select_shifts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_select_shifts ON public.staff_shifts FOR SELECT USING (((staff_id = auth.uid()) OR public.is_owner()));


--
-- Name: staff_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: products staff_update_products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_update_products ON public.products FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: chat_threads staff_update_threads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_update_threads ON public.chat_threads FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: delivery_settings staff_write_delivery_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_write_delivery_settings ON public.delivery_settings FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: shop_hours staff_write_hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_write_hours ON public.shop_hours FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: chat_messages staff_write_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_write_messages ON public.chat_messages FOR INSERT WITH CHECK ((public.is_staff() AND (role = 'staff'::text)));


--
-- Name: payment_settings staff_write_payment_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_write_payment_settings ON public.payment_settings FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: shop_settings staff_write_shop_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_write_shop_settings ON public.shop_settings FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());


--
-- Name: push_subscriptions update own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update own push subscriptions" ON public.push_subscriptions FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: waste; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waste ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


