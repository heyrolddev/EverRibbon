--
-- A starting set of questions for the quote desk.
--
--     Supabase dashboard → SQL Editor → paste → Run
--     (run 0020_spec_questions.sql first)
--
-- These are a STARTING POINT, not the shop's answer. Edit them — reword,
-- delete, add — on HQ → What to ask, which is the whole point of them being
-- rows. Rewording is safe at any time: every answer already given carries the
-- wording it was given under, so an order taken today still reads correctly
-- after the question changes next month.
--
-- Only one is marked "must be answered", deliberately. A required question
-- stops a quote being saved, and a quote that cannot be written down while
-- the customer is still on the phone is worse than a detail chased up later.
--
-- Safe to run twice: keyed on `key`, and an existing question keeps whatever
-- the owner has since changed it to.
--

INSERT INTO public.spec_questions
  (key, label, hint, kind, options, required, category, sort_order)
VALUES
  -- ------------------------------------------------------------ every job --
  ('text_to_print',
   'Text to print',
   'Exactly as it should print — spelling, middle initial, capitals and all',
   'text', '{}', true, NULL, 10),

  ('colours',
   'Colours',
   'e.g. maroon + gold. Say which is the ribbon and which is the print',
   'text', '{}', false, NULL, 20),

  ('reference',
   'Are they copying something?',
   'A link to the photo they sent, or the order number of the last one',
   'text', '{}', false, NULL, 30),

  -- ------------------------------------------------------ ribbon printing --
  ('ribbon_width',
   'Ribbon width',
   'In the units the roll is labelled with',
   'text', '{}', false, 'Ribbon Prints', 40),

  ('print_finish',
   'Print finish',
   NULL,
   'choice', '{"Gold foil","Silver foil","White","Black"}', false, 'Ribbon Prints', 50),

  -- --------------------------------------------------------------- sashes --
  ('sash_names',
   'Names, one per sash',
   'One name per line, in the order they should be made',
   'long_text', '{}', false, 'Sash Printing', 60),

  ('sash_lettering',
   'Lettering',
   NULL,
   'choice', '{"Script","Block capitals","Same as the sample"}', false, 'Sash Printing', 70),

  -- ----------------------------------------------------------- graduation --
  ('ceremony_date',
   'Ceremony date',
   'The date it is needed FOR, which is not always the date it is collected',
   'date', '{}', false, 'Graduation', 80),

  ('school',
   'School or organisation',
   NULL,
   'text', '{}', false, 'Graduation', 90),

  -- ----------------------------------------------------------- bouquets --
  ('stems',
   'How many stems',
   NULL,
   'number', '{}', false, 'EverCraft', 100),

  ('wrapper',
   'Wrapper and trim',
   'e.g. kraft paper, ivory ribbon',
   'text', '{}', false, 'EverCraft', 110),

  ('card_message',
   'Message on the card',
   'Word for word, and who it is signed by',
   'long_text', '{}', false, 'EverCraft', 120)

-- An existing question is left exactly as the owner has it. Re-running this
-- file must never undo an afternoon spent on the What to ask screen.
ON CONFLICT (key) DO NOTHING;


-- ==========================================================================
-- CHECK IT LANDED
-- ==========================================================================

SELECT
  count(*)                                   AS questions,
  count(*) FILTER (WHERE required)           AS must_be_answered,
  count(*) FILTER (WHERE category IS NULL)   AS asked_on_every_job,
  count(DISTINCT category)                   AS kinds_of_work_covered
FROM public.spec_questions
WHERE is_active;
