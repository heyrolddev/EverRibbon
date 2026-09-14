--
-- Indexes.
--
-- Kept apart so the cost of a query is readable in one place rather than
-- scattered through forty table definitions.
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
-- Name: idx_activity_log_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_at ON public.activity_log USING btree (at DESC);


--
-- Name: idx_announcements_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_live ON public.announcements USING btree (kind, is_active, sort_order);


--
-- Name: idx_announcements_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_pinned ON public.announcements USING btree (kind, pinned, created_at DESC);


--
-- Name: idx_production_run_materials_production_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_run_materials_production_run ON public.production_run_materials USING btree (production_run_id);


--
-- Name: idx_cash_ledger_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_ledger_date ON public.cash_ledger USING btree (date DESC);


--
-- Name: idx_cash_ledger_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_ledger_source ON public.cash_ledger USING btree (source);


--
-- Name: idx_chat_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_thread ON public.chat_messages USING btree (thread_id, id);


--
-- Name: idx_chat_threads_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_chat_threads_external ON public.chat_threads USING btree (external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_chat_threads_guest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_chat_threads_guest ON public.chat_threads USING btree (guest_key) WHERE (guest_key IS NOT NULL);


--
-- Name: idx_chat_threads_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_threads_recent ON public.chat_threads USING btree (last_message_at DESC);


--
-- Name: idx_material_usage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_usage_date ON public.material_usage USING btree (date);


--
-- Name: idx_material_usage_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_usage_material ON public.material_usage USING btree (material_id);


--
-- Name: idx_device_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_status ON public.device_sessions USING btree (status);


--
-- Name: idx_device_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_user ON public.device_sessions USING btree (user_id);


--
-- Name: idx_error_log_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_last_seen ON public.error_log USING btree (last_seen DESC);


--
-- Name: idx_error_log_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_log_open ON public.error_log USING btree (resolved, last_seen DESC);


--
-- Name: idx_faq_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faq_active ON public.faq_entries USING btree (is_active, priority DESC);


--
-- Name: idx_faq_on_site; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faq_on_site ON public.faq_entries USING btree (show_on_site, site_order) WHERE show_on_site;


--
-- Name: idx_material_lots_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_material_lots_material ON public.material_lots USING btree (material_id);


--
-- Name: idx_product_components_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_components_product ON public.product_components USING btree (product_id);


--
-- Name: idx_product_materials_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_materials_product ON public.product_materials USING btree (product_id);


--
-- Name: idx_product_packaging_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_packaging_product ON public.product_packaging USING btree (product_id);


--
-- Name: idx_order_lines_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_lines_product ON public.order_lines USING btree (product_id);


--
-- Name: idx_order_lines_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_lines_order ON public.order_lines USING btree (order_id);


--
-- Name: idx_orders_cancelled_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_cancelled_by ON public.orders USING btree (cancelled_by) WHERE (cancelled_by IS NOT NULL);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_date ON public.orders USING btree (date);


--
-- Name: idx_orders_eta_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_eta_pending ON public.orders USING btree (eta_set_at) WHERE ((eta_alerted_at IS NULL) AND (eta_minutes IS NOT NULL));


--
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);


--
-- Name: idx_orders_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_scheduled ON public.orders USING btree (scheduled_for) WHERE (scheduled_for IS NOT NULL);


--
-- Name: idx_orders_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_shift ON public.orders USING btree (shift_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_stock_applied; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_stock_applied ON public.orders USING btree (stock_applied_at) WHERE (stock_applied_at IS NULL);


--
-- Name: idx_orders_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_ticket ON public.orders USING btree (ticket);


--
-- Name: idx_purchases_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_material ON public.purchases USING btree (material_id);


--
-- Name: idx_receivables_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_open ON public.receivables USING btree (collected, date DESC);


--
-- Name: idx_restore_snapshots_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restore_snapshots_family ON public.restore_snapshots USING btree (automatic, taken_at DESC);


--
-- Name: idx_restore_snapshots_taken; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restore_snapshots_taken ON public.restore_snapshots USING btree (taken_at DESC);


--
-- Name: idx_reviews_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_source ON public.reviews USING btree (source);


--
-- Name: idx_staff_shifts_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_staff_shifts_one_open ON public.staff_shifts USING btree (staff_id) WHERE (ended_at IS NULL);


--
-- Name: idx_staff_shifts_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_shifts_staff ON public.staff_shifts USING btree (staff_id, started_at DESC);


--
-- Name: idx_waste_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_date ON public.waste USING btree (date);


--
-- Name: idx_waste_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_waste_material ON public.waste USING btree (material_id);


--
-- Name: push_subscriptions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);


--
-- Name: reviews_one_per_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reviews_one_per_product ON public.reviews USING btree (customer_id, product_id) WHERE ((product_id IS NOT NULL) AND (customer_id IS NOT NULL));


--
-- Name: reviews_one_shop_review; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reviews_one_shop_review ON public.reviews USING btree (customer_id) WHERE ((product_id IS NULL) AND (customer_id IS NOT NULL));


