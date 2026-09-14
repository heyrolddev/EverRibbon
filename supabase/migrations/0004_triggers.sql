--
-- Triggers, bound to the functions in 0001.
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
-- Name: products guard_product_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_product_columns BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_product_columns();


--
-- Name: orders orders_touch_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_touch_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_order_updated_at();


--
-- Name: profiles profiles_guard_privileges; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_guard_privileges BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();


--
-- Name: activity_log require_shift_activity_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_activity_log BEFORE INSERT OR DELETE OR UPDATE ON public.activity_log FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: announcements require_shift_announcements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_announcements BEFORE INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: assets require_shift_assets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_assets BEFORE INSERT OR DELETE OR UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: production_run_materials require_shift_production_run_materials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_production_run_materials BEFORE INSERT OR DELETE OR UPDATE ON public.production_run_materials FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: production_runs require_shift_production_runs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_production_runs BEFORE INSERT OR DELETE OR UPDATE ON public.production_runs FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: cash_ledger require_shift_cash_ledger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_cash_ledger BEFORE INSERT OR DELETE OR UPDATE ON public.cash_ledger FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: chat_messages require_shift_chat_messages; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_chat_messages BEFORE INSERT OR DELETE OR UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: chat_settings require_shift_chat_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_chat_settings BEFORE INSERT OR DELETE OR UPDATE ON public.chat_settings FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: chat_threads require_shift_chat_threads; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_chat_threads BEFORE INSERT OR DELETE OR UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: material_usage require_shift_material_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_material_usage BEFORE INSERT OR DELETE OR UPDATE ON public.material_usage FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: cycle_counts require_shift_cycle_counts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_cycle_counts BEFORE INSERT OR DELETE OR UPDATE ON public.cycle_counts FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: delivery_settings require_shift_delivery_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_delivery_settings BEFORE INSERT OR DELETE OR UPDATE ON public.delivery_settings FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: faq_entries require_shift_faq_entries; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_faq_entries BEFORE INSERT OR DELETE OR UPDATE ON public.faq_entries FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: fixed_costs require_shift_fixed_costs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_fixed_costs BEFORE INSERT OR DELETE OR UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: material_lots require_shift_material_lots; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_material_lots BEFORE INSERT OR DELETE OR UPDATE ON public.material_lots FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: materials require_shift_materials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_materials BEFORE INSERT OR DELETE OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: product_components require_shift_product_components; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_product_components BEFORE INSERT OR DELETE OR UPDATE ON public.product_components FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: product_materials require_shift_product_materials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_product_materials BEFORE INSERT OR DELETE OR UPDATE ON public.product_materials FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: product_packaging require_shift_product_packaging; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_product_packaging BEFORE INSERT OR DELETE OR UPDATE ON public.product_packaging FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: products require_shift_products; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_products BEFORE INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: catalog_categories require_shift_catalog_categories; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_catalog_categories BEFORE INSERT OR DELETE OR UPDATE ON public.catalog_categories FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: oe_templates require_shift_oe_templates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_oe_templates BEFORE INSERT OR DELETE OR UPDATE ON public.oe_templates FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: order_lines require_shift_order_lines; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_order_lines BEFORE INSERT OR DELETE OR UPDATE ON public.order_lines FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: order_packaging require_shift_order_packaging; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_order_packaging BEFORE INSERT OR DELETE OR UPDATE ON public.order_packaging FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: orders require_shift_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_orders BEFORE INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: payment_settings require_shift_payment_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_payment_settings BEFORE INSERT OR DELETE OR UPDATE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: purchases require_shift_purchases; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_purchases BEFORE INSERT OR DELETE OR UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: receivables require_shift_receivables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_receivables BEFORE INSERT OR DELETE OR UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: settings require_shift_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_settings BEFORE INSERT OR DELETE OR UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: shop_closures require_shift_shop_closures; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_shop_closures BEFORE INSERT OR DELETE OR UPDATE ON public.shop_closures FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: shop_hours require_shift_shop_hours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_shop_hours BEFORE INSERT OR DELETE OR UPDATE ON public.shop_hours FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: shop_settings require_shift_shop_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_shop_settings BEFORE INSERT OR DELETE OR UPDATE ON public.shop_settings FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: waste require_shift_waste; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_shift_waste BEFORE INSERT OR DELETE OR UPDATE ON public.waste FOR EACH ROW EXECUTE FUNCTION public.require_open_shift();


--
-- Name: reviews reviews_guard_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reviews_guard_columns BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.guard_review_columns();


--
-- Name: reviews reviews_guard_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reviews_guard_insert BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.guard_review_insert();


--
-- Name: staff_shifts staff_shifts_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_shifts_guard BEFORE UPDATE ON public.staff_shifts FOR EACH ROW EXECUTE FUNCTION public.guard_shift_columns();


--
-- Name: announcements touch_announcement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER touch_announcement BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.touch_announcement();


