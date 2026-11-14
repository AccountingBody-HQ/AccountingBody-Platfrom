-- ============================================================================
-- 0012_backfill_job_country_from_location_text.sql
-- Date: 14 Nov 2026
--
-- NOT YET APPLIED — run only after a fresh backup and the owner's approval.
--
-- Why: until this change, job imports recognised only about 13 countries
-- (lib/ingestion/normalise.ts). Jobs whose location named any other
-- country ("Manila, Philippines", "Thailand") were saved with
-- location_country NULL, so they show in the job list but get no entry
-- in the country menu (refresh_site_counts, 0011, skips NULL countries).
-- New imports now recognise every country (lib/ingestion/countries.ts).
-- This file fills in location_country for jobs already saved, using the
-- same rule the importer uses for location text: the last non-empty
-- comma-separated segment, trimmed and lowercased, matched exactly
-- against the same lookup list.
--
-- What changes: ONLY public.jobs.location_country, ONLY where it is NULL,
-- ONLY where the last segment matches, ONLY for rows created before the
-- cutoff below. Nothing else is written by this file. Note: the jobs
-- trigger jobs_search_vector_update (0002) fires on every UPDATE: it
-- rebuilds search_vector from the same columns (unchanged result, since
-- location_country is not one of them) and sets updated_at = now().
--
-- Cutoff: 2026-11-15 00:00:00+00. If the new import code goes live after
-- that time, change the cutoff to the time it went live, in every part
-- below (the same literal appears in Parts A, B and C).
--
-- The VALUES list (lookup key, canonical name) is generated from
-- lib/ingestion/countries.ts and appears in Parts A, B and C;
-- lib/ingestion/countries.test.ts checks each copy equals that file.
--
-- Order: fresh backup -> Part A0 and Part A (read-only) -> owner approves
-- the numbers -> Part B -> save the Part B result row -> the 10-minute
-- refresh_site_counts run adds the new countries to the menu.
-- Undo: Part C, with the values saved from Part B.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PART A0 — READ-ONLY. Triggers on public.jobs. Run on its own.
-- Expect exactly one row: jobs_search_vector_update (as recorded in 0002).
-- If there is any other trigger, stop: Parts B and C assume only that one.
-- ----------------------------------------------------------------------------
SELECT t.tgname AS trigger_name, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
WHERE t.tgrelid = 'public.jobs'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;


-- ----------------------------------------------------------------------------
-- PART A — READ-ONLY PREVIEW (SELECT only). Run on its own.
-- One table, sorted by part:
--   A1  one row per country that WOULD be set: total, active, not active,
--       and was_known (true for the 13 countries recognised before).
--   A2  one row: total rows Part B would change. Part B needs this number.
--   A3  the 40 most common last segments among NULL-country rows that are
--       still NOT recognised, with counts (what else is being missed).
-- ----------------------------------------------------------------------------
WITH country_keys(lookup_key, canonical) AS (
  VALUES
    -- country-keys:begin (generated from lib/ingestion/countries.ts)
    ('afghanistan', 'Afghanistan'),
    ('aland islands', 'Åland Islands'),
    ('albania', 'Albania'),
    ('algeria', 'Algeria'),
    ('american samoa', 'American Samoa'),
    ('andorra', 'Andorra'),
    ('angola', 'Angola'),
    ('anguilla', 'Anguilla'),
    ('antarctica', 'Antarctica'),
    ('antigua & barbuda', 'Antigua and Barbuda'),
    ('antigua and barbuda', 'Antigua and Barbuda'),
    ('argentina', 'Argentina'),
    ('armenia', 'Armenia'),
    ('aruba', 'Aruba'),
    ('australia', 'Australia'),
    ('austria', 'Austria'),
    ('azerbaijan', 'Azerbaijan'),
    ('bahamas', 'Bahamas'),
    ('bahrain', 'Bahrain'),
    ('bangladesh', 'Bangladesh'),
    ('barbados', 'Barbados'),
    ('belarus', 'Belarus'),
    ('belgium', 'Belgium'),
    ('belize', 'Belize'),
    ('benin', 'Benin'),
    ('bermuda', 'Bermuda'),
    ('bhutan', 'Bhutan'),
    ('bolivia', 'Bolivia'),
    ('bonaire', 'Caribbean Netherlands'),
    ('bosnia', 'Bosnia and Herzegovina'),
    ('bosnia & herzegovina', 'Bosnia and Herzegovina'),
    ('bosnia and herzegovina', 'Bosnia and Herzegovina'),
    ('botswana', 'Botswana'),
    ('bouvet island', 'Bouvet Island'),
    ('brazil', 'Brazil'),
    ('british indian ocean territory', 'British Indian Ocean Territory'),
    ('british virgin islands', 'British Virgin Islands'),
    ('brunei', 'Brunei'),
    ('brunei darussalam', 'Brunei'),
    ('bulgaria', 'Bulgaria'),
    ('burkina faso', 'Burkina Faso'),
    ('burma', 'Myanmar'),
    ('burundi', 'Burundi'),
    ('cabo verde', 'Cape Verde'),
    ('cambodia', 'Cambodia'),
    ('cameroon', 'Cameroon'),
    ('canada', 'Canada'),
    ('cape verde', 'Cape Verde'),
    ('caribbean netherlands', 'Caribbean Netherlands'),
    ('cayman islands', 'Cayman Islands'),
    ('central african republic', 'Central African Republic'),
    ('chad', 'Chad'),
    ('chile', 'Chile'),
    ('china', 'China'),
    ('christmas island', 'Christmas Island'),
    ('cocos (keeling) islands', 'Cocos (Keeling) Islands'),
    ('colombia', 'Colombia'),
    ('comoros', 'Comoros'),
    ('congo-brazzaville', 'Republic of the Congo'),
    ('congo-kinshasa', 'Democratic Republic of the Congo'),
    ('cook islands', 'Cook Islands'),
    ('costa rica', 'Costa Rica'),
    ('cote d''ivoire', 'Ivory Coast'),
    ('croatia', 'Croatia'),
    ('cuba', 'Cuba'),
    ('curacao', 'Curaçao'),
    ('curaçao', 'Curaçao'),
    ('cyprus', 'Cyprus'),
    ('czech republic', 'Czech Republic'),
    ('czechia', 'Czech Republic'),
    ('côte d''ivoire', 'Ivory Coast'),
    ('democratic people''s republic of korea', 'North Korea'),
    ('democratic republic of the congo', 'Democratic Republic of the Congo'),
    ('denmark', 'Denmark'),
    ('djibouti', 'Djibouti'),
    ('dominica', 'Dominica'),
    ('dominican republic', 'Dominican Republic'),
    ('dr congo', 'Democratic Republic of the Congo'),
    ('east timor', 'East Timor'),
    ('ecuador', 'Ecuador'),
    ('egypt', 'Egypt'),
    ('el salvador', 'El Salvador'),
    ('england', 'United Kingdom'),
    ('equatorial guinea', 'Equatorial Guinea'),
    ('eritrea', 'Eritrea'),
    ('estonia', 'Estonia'),
    ('eswatini', 'Eswatini'),
    ('ethiopia', 'Ethiopia'),
    ('falkland islands', 'Falkland Islands'),
    ('falklands', 'Falkland Islands'),
    ('faroe islands', 'Faroe Islands'),
    ('faroes', 'Faroe Islands'),
    ('federated states of micronesia', 'Micronesia'),
    ('fiji', 'Fiji'),
    ('finland', 'Finland'),
    ('france', 'France'),
    ('french guiana', 'French Guiana'),
    ('french polynesia', 'French Polynesia'),
    ('french southern territories', 'French Southern Territories'),
    ('gabon', 'Gabon'),
    ('gambia', 'Gambia'),
    ('gb', 'United Kingdom'),
    ('germany', 'Germany'),
    ('ghana', 'Ghana'),
    ('gibraltar', 'Gibraltar'),
    ('great britain', 'United Kingdom'),
    ('greece', 'Greece'),
    ('greenland', 'Greenland'),
    ('grenada', 'Grenada'),
    ('guadeloupe', 'Guadeloupe'),
    ('guam', 'Guam'),
    ('guatemala', 'Guatemala'),
    ('guernsey', 'Guernsey'),
    ('guinea', 'Guinea'),
    ('guinea-bissau', 'Guinea-Bissau'),
    ('guyana', 'Guyana'),
    ('haiti', 'Haiti'),
    ('heard island and mcdonald islands', 'Heard Island and McDonald Islands'),
    ('holland', 'Netherlands'),
    ('holy see', 'Vatican City'),
    ('honduras', 'Honduras'),
    ('hong kong', 'Hong Kong'),
    ('hong kong sar', 'Hong Kong'),
    ('hungary', 'Hungary'),
    ('iceland', 'Iceland'),
    ('india', 'India'),
    ('indonesia', 'Indonesia'),
    ('iran', 'Iran'),
    ('iraq', 'Iraq'),
    ('ireland', 'Ireland'),
    ('islamic republic of iran', 'Iran'),
    ('isle of man', 'Isle of Man'),
    ('israel', 'Israel'),
    ('italy', 'Italy'),
    ('ivory coast', 'Ivory Coast'),
    ('jamaica', 'Jamaica'),
    ('japan', 'Japan'),
    ('jersey', 'Jersey'),
    ('jordan', 'Jordan'),
    ('kazakhstan', 'Kazakhstan'),
    ('kenya', 'Kenya'),
    ('kiribati', 'Kiribati'),
    ('korea', 'South Korea'),
    ('kuwait', 'Kuwait'),
    ('kyrgyz republic', 'Kyrgyzstan'),
    ('kyrgyzstan', 'Kyrgyzstan'),
    ('lao pdr', 'Laos'),
    ('lao people''s democratic republic', 'Laos'),
    ('laos', 'Laos'),
    ('latvia', 'Latvia'),
    ('lebanon', 'Lebanon'),
    ('lesotho', 'Lesotho'),
    ('liberia', 'Liberia'),
    ('libya', 'Libya'),
    ('liechtenstein', 'Liechtenstein'),
    ('lithuania', 'Lithuania'),
    ('luxembourg', 'Luxembourg'),
    ('macao', 'Macau'),
    ('macao sar', 'Macau'),
    ('macau', 'Macau'),
    ('macau sar', 'Macau'),
    ('madagascar', 'Madagascar'),
    ('malawi', 'Malawi'),
    ('malaysia', 'Malaysia'),
    ('maldives', 'Maldives'),
    ('mali', 'Mali'),
    ('malta', 'Malta'),
    ('marshall islands', 'Marshall Islands'),
    ('martinique', 'Martinique'),
    ('mauritania', 'Mauritania'),
    ('mauritius', 'Mauritius'),
    ('mayotte', 'Mayotte'),
    ('mexico', 'Mexico'),
    ('micronesia', 'Micronesia'),
    ('moldova', 'Moldova'),
    ('monaco', 'Monaco'),
    ('mongolia', 'Mongolia'),
    ('montenegro', 'Montenegro'),
    ('montserrat', 'Montserrat'),
    ('morocco', 'Morocco'),
    ('mozambique', 'Mozambique'),
    ('myanmar', 'Myanmar'),
    ('namibia', 'Namibia'),
    ('nauru', 'Nauru'),
    ('nepal', 'Nepal'),
    ('netherlands', 'Netherlands'),
    ('new caledonia', 'New Caledonia'),
    ('new zealand', 'New Zealand'),
    ('nicaragua', 'Nicaragua'),
    ('niger', 'Niger'),
    ('nigeria', 'Nigeria'),
    ('niue', 'Niue'),
    ('norfolk island', 'Norfolk Island'),
    ('north korea', 'North Korea'),
    ('north macedonia', 'North Macedonia'),
    ('northern ireland', 'United Kingdom'),
    ('northern mariana islands', 'Northern Mariana Islands'),
    ('norway', 'Norway'),
    ('oman', 'Oman'),
    ('pakistan', 'Pakistan'),
    ('palau', 'Palau'),
    ('palestine', 'Palestine'),
    ('palestinian territories', 'Palestine'),
    ('panama', 'Panama'),
    ('papua new guinea', 'Papua New Guinea'),
    ('paraguay', 'Paraguay'),
    ('peru', 'Peru'),
    ('philippines', 'Philippines'),
    ('pitcairn', 'Pitcairn Islands'),
    ('pitcairn islands', 'Pitcairn Islands'),
    ('poland', 'Poland'),
    ('portugal', 'Portugal'),
    ('puerto rico', 'Puerto Rico'),
    ('qatar', 'Qatar'),
    ('republic of georgia', 'Georgia'),
    ('republic of ireland', 'Ireland'),
    ('republic of korea', 'South Korea'),
    ('republic of moldova', 'Moldova'),
    ('republic of the congo', 'Republic of the Congo'),
    ('reunion', 'Réunion'),
    ('romania', 'Romania'),
    ('russia', 'Russia'),
    ('russian federation', 'Russia'),
    ('rwanda', 'Rwanda'),
    ('réunion', 'Réunion'),
    ('saint barthelemy', 'Saint Barthélemy'),
    ('saint barthélemy', 'Saint Barthélemy'),
    ('saint helena', 'Saint Helena'),
    ('saint kitts and nevis', 'Saint Kitts and Nevis'),
    ('saint lucia', 'Saint Lucia'),
    ('saint martin', 'Saint Martin'),
    ('saint pierre and miquelon', 'Saint Pierre and Miquelon'),
    ('saint vincent and the grenadines', 'Saint Vincent and the Grenadines'),
    ('samoa', 'Samoa'),
    ('san marino', 'San Marino'),
    ('sao tome and principe', 'São Tomé and Príncipe'),
    ('saudi arabia', 'Saudi Arabia'),
    ('scotland', 'United Kingdom'),
    ('senegal', 'Senegal'),
    ('serbia', 'Serbia'),
    ('seychelles', 'Seychelles'),
    ('sierra leone', 'Sierra Leone'),
    ('singapore', 'Singapore'),
    ('sint maarten', 'Sint Maarten'),
    ('slovak republic', 'Slovakia'),
    ('slovakia', 'Slovakia'),
    ('slovenia', 'Slovenia'),
    ('solomon islands', 'Solomon Islands'),
    ('somalia', 'Somalia'),
    ('south africa', 'South Africa'),
    ('south georgia and the south sandwich islands', 'South Georgia and the South Sandwich Islands'),
    ('south korea', 'South Korea'),
    ('south sudan', 'South Sudan'),
    ('spain', 'Spain'),
    ('sri lanka', 'Sri Lanka'),
    ('st kitts and nevis', 'Saint Kitts and Nevis'),
    ('st lucia', 'Saint Lucia'),
    ('st vincent and the grenadines', 'Saint Vincent and the Grenadines'),
    ('state of palestine', 'Palestine'),
    ('sudan', 'Sudan'),
    ('suriname', 'Suriname'),
    ('svalbard', 'Svalbard and Jan Mayen'),
    ('svalbard and jan mayen', 'Svalbard and Jan Mayen'),
    ('swaziland', 'Eswatini'),
    ('sweden', 'Sweden'),
    ('switzerland', 'Switzerland'),
    ('syria', 'Syria'),
    ('syrian arab republic', 'Syria'),
    ('são tomé and príncipe', 'São Tomé and Príncipe'),
    ('taiwan', 'Taiwan'),
    ('tajikistan', 'Tajikistan'),
    ('tanzania', 'Tanzania'),
    ('thailand', 'Thailand'),
    ('the bahamas', 'Bahamas'),
    ('the gambia', 'Gambia'),
    ('the netherlands', 'Netherlands'),
    ('the philippines', 'Philippines'),
    ('timor leste', 'East Timor'),
    ('timor-leste', 'East Timor'),
    ('togo', 'Togo'),
    ('tokelau', 'Tokelau'),
    ('tonga', 'Tonga'),
    ('trinidad & tobago', 'Trinidad and Tobago'),
    ('trinidad and tobago', 'Trinidad and Tobago'),
    ('tunisia', 'Tunisia'),
    ('turkey', 'Turkey'),
    ('turkiye', 'Turkey'),
    ('turkmenistan', 'Turkmenistan'),
    ('turks and caicos islands', 'Turks and Caicos Islands'),
    ('tuvalu', 'Tuvalu'),
    ('türkiye', 'Turkey'),
    ('uae', 'United Arab Emirates'),
    ('uganda', 'Uganda'),
    ('uk', 'United Kingdom'),
    ('ukraine', 'Ukraine'),
    ('united arab emirates', 'United Arab Emirates'),
    ('united kingdom', 'United Kingdom'),
    ('united republic of tanzania', 'Tanzania'),
    ('united states', 'United States'),
    ('united states minor outlying islands', 'United States Minor Outlying Islands'),
    ('united states of america', 'United States'),
    ('united states virgin islands', 'United States Virgin Islands'),
    ('uruguay', 'Uruguay'),
    ('us', 'United States'),
    ('us virgin islands', 'United States Virgin Islands'),
    ('usa', 'United States'),
    ('uzbekistan', 'Uzbekistan'),
    ('vanuatu', 'Vanuatu'),
    ('vatican', 'Vatican City'),
    ('vatican city', 'Vatican City'),
    ('venezuela', 'Venezuela'),
    ('viet nam', 'Vietnam'),
    ('vietnam', 'Vietnam'),
    ('wales', 'United Kingdom'),
    ('wallis and futuna', 'Wallis and Futuna'),
    ('western sahara', 'Western Sahara'),
    ('yemen', 'Yemen'),
    ('zambia', 'Zambia'),
    ('zimbabwe', 'Zimbabwe'),
    ('åland islands', 'Åland Islands')
    -- country-keys:end
),
null_rows AS (
  SELECT
    j.id,
    j.status,
    (SELECT lower(btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM unnest(string_to_array(j.location_text, ',')) WITH ORDINALITY AS u(seg, pos)
      WHERE btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)) <> ''
      ORDER BY u.pos DESC
      LIMIT 1) AS last_segment
  FROM public.jobs j
  WHERE j.location_country IS NULL
    AND j.created_at < TIMESTAMPTZ '2026-11-15 00:00:00+00'
),
matched AS (
  SELECT n.id, n.status, k.canonical
  FROM null_rows n
  JOIN country_keys k ON k.lookup_key = n.last_segment
)
SELECT * FROM (
  SELECT
    'A1' AS part,
    m.canonical AS item,
    count(*) AS total,
    count(*) FILTER (WHERE m.status = 'active') AS active,
    count(*) FILTER (WHERE m.status IS DISTINCT FROM 'active') AS not_active,
    m.canonical IN (
      'United Kingdom', 'United States', 'Canada', 'Australia', 'Singapore',
      'South Africa', 'Kenya', 'Nigeria', 'Ethiopia', 'United Arab Emirates',
      'Ireland', 'India', 'New Zealand'
    ) AS was_known
  FROM matched m
  GROUP BY m.canonical

  UNION ALL

  SELECT
    'A2',
    'all rows Part B would change',
    count(*),
    count(*) FILTER (WHERE m.status = 'active'),
    count(*) FILTER (WHERE m.status IS DISTINCT FROM 'active'),
    NULL
  FROM matched m

  UNION ALL

  SELECT 'A3', x.item, x.total, x.active, x.not_active, NULL
  FROM (
    SELECT
      coalesce(n.last_segment, '(no location text)') AS item,
      count(*) AS total,
      count(*) FILTER (WHERE n.status = 'active') AS active,
      count(*) FILTER (WHERE n.status IS DISTINCT FROM 'active') AS not_active
    FROM null_rows n
    WHERE NOT EXISTS (SELECT 1 FROM country_keys k WHERE k.lookup_key = n.last_segment)
    GROUP BY 1
    ORDER BY 2 DESC, 1
    LIMIT 40
  ) x
) preview
ORDER BY part, total DESC, item;


-- ----------------------------------------------------------------------------
-- PART B — THE UPDATE. Only after a fresh backup and the owner's approval
-- of the Part A numbers. Run on its own, as one query.
--
-- Before running: put the Part A2 total in v_expected below.
-- If the number of rows changed is not exactly v_expected, the block
-- raises an error and the whole transaction is rolled back: nothing
-- changes.
--
-- After running: SAVE the result row (part_b_stamp and rows_with_stamp).
-- rows_with_stamp must equal v_expected. Part C (the undo) needs both.
-- part_b_stamp is the updated_at value the jobs trigger gives every row
-- this transaction changes.
-- ----------------------------------------------------------------------------
BEGIN;

DO $backfill$
DECLARE
  v_expected integer := NULL;  -- put the Part A2 total here
  v_changed  integer;
  v_stamped  integer;
BEGIN
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Part B: put the Part A2 total in v_expected first. Nothing changed.';
  END IF;

  WITH country_keys(lookup_key, canonical) AS (
    VALUES
      -- country-keys:begin (generated from lib/ingestion/countries.ts)
      ('afghanistan', 'Afghanistan'),
      ('aland islands', 'Åland Islands'),
      ('albania', 'Albania'),
      ('algeria', 'Algeria'),
      ('american samoa', 'American Samoa'),
      ('andorra', 'Andorra'),
      ('angola', 'Angola'),
      ('anguilla', 'Anguilla'),
      ('antarctica', 'Antarctica'),
      ('antigua & barbuda', 'Antigua and Barbuda'),
      ('antigua and barbuda', 'Antigua and Barbuda'),
      ('argentina', 'Argentina'),
      ('armenia', 'Armenia'),
      ('aruba', 'Aruba'),
      ('australia', 'Australia'),
      ('austria', 'Austria'),
      ('azerbaijan', 'Azerbaijan'),
      ('bahamas', 'Bahamas'),
      ('bahrain', 'Bahrain'),
      ('bangladesh', 'Bangladesh'),
      ('barbados', 'Barbados'),
      ('belarus', 'Belarus'),
      ('belgium', 'Belgium'),
      ('belize', 'Belize'),
      ('benin', 'Benin'),
      ('bermuda', 'Bermuda'),
      ('bhutan', 'Bhutan'),
      ('bolivia', 'Bolivia'),
      ('bonaire', 'Caribbean Netherlands'),
      ('bosnia', 'Bosnia and Herzegovina'),
      ('bosnia & herzegovina', 'Bosnia and Herzegovina'),
      ('bosnia and herzegovina', 'Bosnia and Herzegovina'),
      ('botswana', 'Botswana'),
      ('bouvet island', 'Bouvet Island'),
      ('brazil', 'Brazil'),
      ('british indian ocean territory', 'British Indian Ocean Territory'),
      ('british virgin islands', 'British Virgin Islands'),
      ('brunei', 'Brunei'),
      ('brunei darussalam', 'Brunei'),
      ('bulgaria', 'Bulgaria'),
      ('burkina faso', 'Burkina Faso'),
      ('burma', 'Myanmar'),
      ('burundi', 'Burundi'),
      ('cabo verde', 'Cape Verde'),
      ('cambodia', 'Cambodia'),
      ('cameroon', 'Cameroon'),
      ('canada', 'Canada'),
      ('cape verde', 'Cape Verde'),
      ('caribbean netherlands', 'Caribbean Netherlands'),
      ('cayman islands', 'Cayman Islands'),
      ('central african republic', 'Central African Republic'),
      ('chad', 'Chad'),
      ('chile', 'Chile'),
      ('china', 'China'),
      ('christmas island', 'Christmas Island'),
      ('cocos (keeling) islands', 'Cocos (Keeling) Islands'),
      ('colombia', 'Colombia'),
      ('comoros', 'Comoros'),
      ('congo-brazzaville', 'Republic of the Congo'),
      ('congo-kinshasa', 'Democratic Republic of the Congo'),
      ('cook islands', 'Cook Islands'),
      ('costa rica', 'Costa Rica'),
      ('cote d''ivoire', 'Ivory Coast'),
      ('croatia', 'Croatia'),
      ('cuba', 'Cuba'),
      ('curacao', 'Curaçao'),
      ('curaçao', 'Curaçao'),
      ('cyprus', 'Cyprus'),
      ('czech republic', 'Czech Republic'),
      ('czechia', 'Czech Republic'),
      ('côte d''ivoire', 'Ivory Coast'),
      ('democratic people''s republic of korea', 'North Korea'),
      ('democratic republic of the congo', 'Democratic Republic of the Congo'),
      ('denmark', 'Denmark'),
      ('djibouti', 'Djibouti'),
      ('dominica', 'Dominica'),
      ('dominican republic', 'Dominican Republic'),
      ('dr congo', 'Democratic Republic of the Congo'),
      ('east timor', 'East Timor'),
      ('ecuador', 'Ecuador'),
      ('egypt', 'Egypt'),
      ('el salvador', 'El Salvador'),
      ('england', 'United Kingdom'),
      ('equatorial guinea', 'Equatorial Guinea'),
      ('eritrea', 'Eritrea'),
      ('estonia', 'Estonia'),
      ('eswatini', 'Eswatini'),
      ('ethiopia', 'Ethiopia'),
      ('falkland islands', 'Falkland Islands'),
      ('falklands', 'Falkland Islands'),
      ('faroe islands', 'Faroe Islands'),
      ('faroes', 'Faroe Islands'),
      ('federated states of micronesia', 'Micronesia'),
      ('fiji', 'Fiji'),
      ('finland', 'Finland'),
      ('france', 'France'),
      ('french guiana', 'French Guiana'),
      ('french polynesia', 'French Polynesia'),
      ('french southern territories', 'French Southern Territories'),
      ('gabon', 'Gabon'),
      ('gambia', 'Gambia'),
      ('gb', 'United Kingdom'),
      ('germany', 'Germany'),
      ('ghana', 'Ghana'),
      ('gibraltar', 'Gibraltar'),
      ('great britain', 'United Kingdom'),
      ('greece', 'Greece'),
      ('greenland', 'Greenland'),
      ('grenada', 'Grenada'),
      ('guadeloupe', 'Guadeloupe'),
      ('guam', 'Guam'),
      ('guatemala', 'Guatemala'),
      ('guernsey', 'Guernsey'),
      ('guinea', 'Guinea'),
      ('guinea-bissau', 'Guinea-Bissau'),
      ('guyana', 'Guyana'),
      ('haiti', 'Haiti'),
      ('heard island and mcdonald islands', 'Heard Island and McDonald Islands'),
      ('holland', 'Netherlands'),
      ('holy see', 'Vatican City'),
      ('honduras', 'Honduras'),
      ('hong kong', 'Hong Kong'),
      ('hong kong sar', 'Hong Kong'),
      ('hungary', 'Hungary'),
      ('iceland', 'Iceland'),
      ('india', 'India'),
      ('indonesia', 'Indonesia'),
      ('iran', 'Iran'),
      ('iraq', 'Iraq'),
      ('ireland', 'Ireland'),
      ('islamic republic of iran', 'Iran'),
      ('isle of man', 'Isle of Man'),
      ('israel', 'Israel'),
      ('italy', 'Italy'),
      ('ivory coast', 'Ivory Coast'),
      ('jamaica', 'Jamaica'),
      ('japan', 'Japan'),
      ('jersey', 'Jersey'),
      ('jordan', 'Jordan'),
      ('kazakhstan', 'Kazakhstan'),
      ('kenya', 'Kenya'),
      ('kiribati', 'Kiribati'),
      ('korea', 'South Korea'),
      ('kuwait', 'Kuwait'),
      ('kyrgyz republic', 'Kyrgyzstan'),
      ('kyrgyzstan', 'Kyrgyzstan'),
      ('lao pdr', 'Laos'),
      ('lao people''s democratic republic', 'Laos'),
      ('laos', 'Laos'),
      ('latvia', 'Latvia'),
      ('lebanon', 'Lebanon'),
      ('lesotho', 'Lesotho'),
      ('liberia', 'Liberia'),
      ('libya', 'Libya'),
      ('liechtenstein', 'Liechtenstein'),
      ('lithuania', 'Lithuania'),
      ('luxembourg', 'Luxembourg'),
      ('macao', 'Macau'),
      ('macao sar', 'Macau'),
      ('macau', 'Macau'),
      ('macau sar', 'Macau'),
      ('madagascar', 'Madagascar'),
      ('malawi', 'Malawi'),
      ('malaysia', 'Malaysia'),
      ('maldives', 'Maldives'),
      ('mali', 'Mali'),
      ('malta', 'Malta'),
      ('marshall islands', 'Marshall Islands'),
      ('martinique', 'Martinique'),
      ('mauritania', 'Mauritania'),
      ('mauritius', 'Mauritius'),
      ('mayotte', 'Mayotte'),
      ('mexico', 'Mexico'),
      ('micronesia', 'Micronesia'),
      ('moldova', 'Moldova'),
      ('monaco', 'Monaco'),
      ('mongolia', 'Mongolia'),
      ('montenegro', 'Montenegro'),
      ('montserrat', 'Montserrat'),
      ('morocco', 'Morocco'),
      ('mozambique', 'Mozambique'),
      ('myanmar', 'Myanmar'),
      ('namibia', 'Namibia'),
      ('nauru', 'Nauru'),
      ('nepal', 'Nepal'),
      ('netherlands', 'Netherlands'),
      ('new caledonia', 'New Caledonia'),
      ('new zealand', 'New Zealand'),
      ('nicaragua', 'Nicaragua'),
      ('niger', 'Niger'),
      ('nigeria', 'Nigeria'),
      ('niue', 'Niue'),
      ('norfolk island', 'Norfolk Island'),
      ('north korea', 'North Korea'),
      ('north macedonia', 'North Macedonia'),
      ('northern ireland', 'United Kingdom'),
      ('northern mariana islands', 'Northern Mariana Islands'),
      ('norway', 'Norway'),
      ('oman', 'Oman'),
      ('pakistan', 'Pakistan'),
      ('palau', 'Palau'),
      ('palestine', 'Palestine'),
      ('palestinian territories', 'Palestine'),
      ('panama', 'Panama'),
      ('papua new guinea', 'Papua New Guinea'),
      ('paraguay', 'Paraguay'),
      ('peru', 'Peru'),
      ('philippines', 'Philippines'),
      ('pitcairn', 'Pitcairn Islands'),
      ('pitcairn islands', 'Pitcairn Islands'),
      ('poland', 'Poland'),
      ('portugal', 'Portugal'),
      ('puerto rico', 'Puerto Rico'),
      ('qatar', 'Qatar'),
      ('republic of georgia', 'Georgia'),
      ('republic of ireland', 'Ireland'),
      ('republic of korea', 'South Korea'),
      ('republic of moldova', 'Moldova'),
      ('republic of the congo', 'Republic of the Congo'),
      ('reunion', 'Réunion'),
      ('romania', 'Romania'),
      ('russia', 'Russia'),
      ('russian federation', 'Russia'),
      ('rwanda', 'Rwanda'),
      ('réunion', 'Réunion'),
      ('saint barthelemy', 'Saint Barthélemy'),
      ('saint barthélemy', 'Saint Barthélemy'),
      ('saint helena', 'Saint Helena'),
      ('saint kitts and nevis', 'Saint Kitts and Nevis'),
      ('saint lucia', 'Saint Lucia'),
      ('saint martin', 'Saint Martin'),
      ('saint pierre and miquelon', 'Saint Pierre and Miquelon'),
      ('saint vincent and the grenadines', 'Saint Vincent and the Grenadines'),
      ('samoa', 'Samoa'),
      ('san marino', 'San Marino'),
      ('sao tome and principe', 'São Tomé and Príncipe'),
      ('saudi arabia', 'Saudi Arabia'),
      ('scotland', 'United Kingdom'),
      ('senegal', 'Senegal'),
      ('serbia', 'Serbia'),
      ('seychelles', 'Seychelles'),
      ('sierra leone', 'Sierra Leone'),
      ('singapore', 'Singapore'),
      ('sint maarten', 'Sint Maarten'),
      ('slovak republic', 'Slovakia'),
      ('slovakia', 'Slovakia'),
      ('slovenia', 'Slovenia'),
      ('solomon islands', 'Solomon Islands'),
      ('somalia', 'Somalia'),
      ('south africa', 'South Africa'),
      ('south georgia and the south sandwich islands', 'South Georgia and the South Sandwich Islands'),
      ('south korea', 'South Korea'),
      ('south sudan', 'South Sudan'),
      ('spain', 'Spain'),
      ('sri lanka', 'Sri Lanka'),
      ('st kitts and nevis', 'Saint Kitts and Nevis'),
      ('st lucia', 'Saint Lucia'),
      ('st vincent and the grenadines', 'Saint Vincent and the Grenadines'),
      ('state of palestine', 'Palestine'),
      ('sudan', 'Sudan'),
      ('suriname', 'Suriname'),
      ('svalbard', 'Svalbard and Jan Mayen'),
      ('svalbard and jan mayen', 'Svalbard and Jan Mayen'),
      ('swaziland', 'Eswatini'),
      ('sweden', 'Sweden'),
      ('switzerland', 'Switzerland'),
      ('syria', 'Syria'),
      ('syrian arab republic', 'Syria'),
      ('são tomé and príncipe', 'São Tomé and Príncipe'),
      ('taiwan', 'Taiwan'),
      ('tajikistan', 'Tajikistan'),
      ('tanzania', 'Tanzania'),
      ('thailand', 'Thailand'),
      ('the bahamas', 'Bahamas'),
      ('the gambia', 'Gambia'),
      ('the netherlands', 'Netherlands'),
      ('the philippines', 'Philippines'),
      ('timor leste', 'East Timor'),
      ('timor-leste', 'East Timor'),
      ('togo', 'Togo'),
      ('tokelau', 'Tokelau'),
      ('tonga', 'Tonga'),
      ('trinidad & tobago', 'Trinidad and Tobago'),
      ('trinidad and tobago', 'Trinidad and Tobago'),
      ('tunisia', 'Tunisia'),
      ('turkey', 'Turkey'),
      ('turkiye', 'Turkey'),
      ('turkmenistan', 'Turkmenistan'),
      ('turks and caicos islands', 'Turks and Caicos Islands'),
      ('tuvalu', 'Tuvalu'),
      ('türkiye', 'Turkey'),
      ('uae', 'United Arab Emirates'),
      ('uganda', 'Uganda'),
      ('uk', 'United Kingdom'),
      ('ukraine', 'Ukraine'),
      ('united arab emirates', 'United Arab Emirates'),
      ('united kingdom', 'United Kingdom'),
      ('united republic of tanzania', 'Tanzania'),
      ('united states', 'United States'),
      ('united states minor outlying islands', 'United States Minor Outlying Islands'),
      ('united states of america', 'United States'),
      ('united states virgin islands', 'United States Virgin Islands'),
      ('uruguay', 'Uruguay'),
      ('us', 'United States'),
      ('us virgin islands', 'United States Virgin Islands'),
      ('usa', 'United States'),
      ('uzbekistan', 'Uzbekistan'),
      ('vanuatu', 'Vanuatu'),
      ('vatican', 'Vatican City'),
      ('vatican city', 'Vatican City'),
      ('venezuela', 'Venezuela'),
      ('viet nam', 'Vietnam'),
      ('vietnam', 'Vietnam'),
      ('wales', 'United Kingdom'),
      ('wallis and futuna', 'Wallis and Futuna'),
      ('western sahara', 'Western Sahara'),
      ('yemen', 'Yemen'),
      ('zambia', 'Zambia'),
      ('zimbabwe', 'Zimbabwe'),
      ('åland islands', 'Åland Islands')
      -- country-keys:end
  ),
  null_rows AS (
    SELECT
      j.id,
      (SELECT lower(btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
         FROM unnest(string_to_array(j.location_text, ',')) WITH ORDINALITY AS u(seg, pos)
        WHERE btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)) <> ''
        ORDER BY u.pos DESC
        LIMIT 1) AS last_segment
    FROM public.jobs j
    WHERE j.location_country IS NULL
      AND j.created_at < TIMESTAMPTZ '2026-11-15 00:00:00+00'
  )
  UPDATE public.jobs j
     SET location_country = k.canonical
    FROM null_rows n
    JOIN country_keys k ON k.lookup_key = n.last_segment
   WHERE j.id = n.id
     AND j.location_country IS NULL;

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RAISE NOTICE 'Part B: % rows changed (expected %).', v_changed, v_expected;

  IF v_changed <> v_expected THEN
    RAISE EXCEPTION 'Part B: % rows would change, but Part A2 said %. Rolled back, nothing changed.',
      v_changed, v_expected;
  END IF;

  -- The undo (Part C) finds these rows by the updated_at stamp the jobs
  -- trigger gives them. Stop if that stamp is not on every changed row.
  SELECT count(*) INTO v_stamped FROM public.jobs WHERE updated_at = now();
  IF v_stamped <> v_changed THEN
    RAISE EXCEPTION 'Part B: % rows changed but % carry this run''s updated_at stamp. Rolled back, nothing changed.',
      v_changed, v_stamped;
  END IF;
END
$backfill$;

-- now() is fixed for the whole transaction, and the jobs trigger set
-- updated_at = now() on every row changed above.
SELECT now() AS part_b_stamp, count(*) AS rows_with_stamp
FROM public.jobs
WHERE updated_at = now();

COMMIT;


-- ----------------------------------------------------------------------------
-- PART C — UNDO for Part B. Only with the owner's approval.
-- Run on its own, as one query.
--
-- Before running: put the saved part_b_stamp in v_stamp and the saved
-- rows_with_stamp in v_max.
--
-- Clears location_country back to NULL for rows that match the same
-- last segment, the same cutoff, hold the country Part B would have set,
-- AND still carry Part B's updated_at stamp. Only Part B's transaction
-- gave rows that stamp, so no row Part B did not change is touched. A row
-- changed again after Part B (by an admin edit, an import or a status
-- sweep) has a newer stamp and is left alone: the notice reports how
-- many rows that was (v_max minus rows cleared).
-- updated_at itself cannot be put back: the trigger sets it to now()
-- again on this UPDATE.
-- ----------------------------------------------------------------------------
BEGIN;

DO $undo$
DECLARE
  v_stamp   timestamptz := NULL;  -- put the saved part_b_stamp here
  v_max     integer     := NULL;  -- put the saved rows_with_stamp here
  v_cleared integer;
BEGIN
  IF v_stamp IS NULL OR v_max IS NULL THEN
    RAISE EXCEPTION 'Part C: put the saved Part B values in v_stamp and v_max first. Nothing changed.';
  END IF;

  WITH country_keys(lookup_key, canonical) AS (
    VALUES
      -- country-keys:begin (generated from lib/ingestion/countries.ts)
      ('afghanistan', 'Afghanistan'),
      ('aland islands', 'Åland Islands'),
      ('albania', 'Albania'),
      ('algeria', 'Algeria'),
      ('american samoa', 'American Samoa'),
      ('andorra', 'Andorra'),
      ('angola', 'Angola'),
      ('anguilla', 'Anguilla'),
      ('antarctica', 'Antarctica'),
      ('antigua & barbuda', 'Antigua and Barbuda'),
      ('antigua and barbuda', 'Antigua and Barbuda'),
      ('argentina', 'Argentina'),
      ('armenia', 'Armenia'),
      ('aruba', 'Aruba'),
      ('australia', 'Australia'),
      ('austria', 'Austria'),
      ('azerbaijan', 'Azerbaijan'),
      ('bahamas', 'Bahamas'),
      ('bahrain', 'Bahrain'),
      ('bangladesh', 'Bangladesh'),
      ('barbados', 'Barbados'),
      ('belarus', 'Belarus'),
      ('belgium', 'Belgium'),
      ('belize', 'Belize'),
      ('benin', 'Benin'),
      ('bermuda', 'Bermuda'),
      ('bhutan', 'Bhutan'),
      ('bolivia', 'Bolivia'),
      ('bonaire', 'Caribbean Netherlands'),
      ('bosnia', 'Bosnia and Herzegovina'),
      ('bosnia & herzegovina', 'Bosnia and Herzegovina'),
      ('bosnia and herzegovina', 'Bosnia and Herzegovina'),
      ('botswana', 'Botswana'),
      ('bouvet island', 'Bouvet Island'),
      ('brazil', 'Brazil'),
      ('british indian ocean territory', 'British Indian Ocean Territory'),
      ('british virgin islands', 'British Virgin Islands'),
      ('brunei', 'Brunei'),
      ('brunei darussalam', 'Brunei'),
      ('bulgaria', 'Bulgaria'),
      ('burkina faso', 'Burkina Faso'),
      ('burma', 'Myanmar'),
      ('burundi', 'Burundi'),
      ('cabo verde', 'Cape Verde'),
      ('cambodia', 'Cambodia'),
      ('cameroon', 'Cameroon'),
      ('canada', 'Canada'),
      ('cape verde', 'Cape Verde'),
      ('caribbean netherlands', 'Caribbean Netherlands'),
      ('cayman islands', 'Cayman Islands'),
      ('central african republic', 'Central African Republic'),
      ('chad', 'Chad'),
      ('chile', 'Chile'),
      ('china', 'China'),
      ('christmas island', 'Christmas Island'),
      ('cocos (keeling) islands', 'Cocos (Keeling) Islands'),
      ('colombia', 'Colombia'),
      ('comoros', 'Comoros'),
      ('congo-brazzaville', 'Republic of the Congo'),
      ('congo-kinshasa', 'Democratic Republic of the Congo'),
      ('cook islands', 'Cook Islands'),
      ('costa rica', 'Costa Rica'),
      ('cote d''ivoire', 'Ivory Coast'),
      ('croatia', 'Croatia'),
      ('cuba', 'Cuba'),
      ('curacao', 'Curaçao'),
      ('curaçao', 'Curaçao'),
      ('cyprus', 'Cyprus'),
      ('czech republic', 'Czech Republic'),
      ('czechia', 'Czech Republic'),
      ('côte d''ivoire', 'Ivory Coast'),
      ('democratic people''s republic of korea', 'North Korea'),
      ('democratic republic of the congo', 'Democratic Republic of the Congo'),
      ('denmark', 'Denmark'),
      ('djibouti', 'Djibouti'),
      ('dominica', 'Dominica'),
      ('dominican republic', 'Dominican Republic'),
      ('dr congo', 'Democratic Republic of the Congo'),
      ('east timor', 'East Timor'),
      ('ecuador', 'Ecuador'),
      ('egypt', 'Egypt'),
      ('el salvador', 'El Salvador'),
      ('england', 'United Kingdom'),
      ('equatorial guinea', 'Equatorial Guinea'),
      ('eritrea', 'Eritrea'),
      ('estonia', 'Estonia'),
      ('eswatini', 'Eswatini'),
      ('ethiopia', 'Ethiopia'),
      ('falkland islands', 'Falkland Islands'),
      ('falklands', 'Falkland Islands'),
      ('faroe islands', 'Faroe Islands'),
      ('faroes', 'Faroe Islands'),
      ('federated states of micronesia', 'Micronesia'),
      ('fiji', 'Fiji'),
      ('finland', 'Finland'),
      ('france', 'France'),
      ('french guiana', 'French Guiana'),
      ('french polynesia', 'French Polynesia'),
      ('french southern territories', 'French Southern Territories'),
      ('gabon', 'Gabon'),
      ('gambia', 'Gambia'),
      ('gb', 'United Kingdom'),
      ('germany', 'Germany'),
      ('ghana', 'Ghana'),
      ('gibraltar', 'Gibraltar'),
      ('great britain', 'United Kingdom'),
      ('greece', 'Greece'),
      ('greenland', 'Greenland'),
      ('grenada', 'Grenada'),
      ('guadeloupe', 'Guadeloupe'),
      ('guam', 'Guam'),
      ('guatemala', 'Guatemala'),
      ('guernsey', 'Guernsey'),
      ('guinea', 'Guinea'),
      ('guinea-bissau', 'Guinea-Bissau'),
      ('guyana', 'Guyana'),
      ('haiti', 'Haiti'),
      ('heard island and mcdonald islands', 'Heard Island and McDonald Islands'),
      ('holland', 'Netherlands'),
      ('holy see', 'Vatican City'),
      ('honduras', 'Honduras'),
      ('hong kong', 'Hong Kong'),
      ('hong kong sar', 'Hong Kong'),
      ('hungary', 'Hungary'),
      ('iceland', 'Iceland'),
      ('india', 'India'),
      ('indonesia', 'Indonesia'),
      ('iran', 'Iran'),
      ('iraq', 'Iraq'),
      ('ireland', 'Ireland'),
      ('islamic republic of iran', 'Iran'),
      ('isle of man', 'Isle of Man'),
      ('israel', 'Israel'),
      ('italy', 'Italy'),
      ('ivory coast', 'Ivory Coast'),
      ('jamaica', 'Jamaica'),
      ('japan', 'Japan'),
      ('jersey', 'Jersey'),
      ('jordan', 'Jordan'),
      ('kazakhstan', 'Kazakhstan'),
      ('kenya', 'Kenya'),
      ('kiribati', 'Kiribati'),
      ('korea', 'South Korea'),
      ('kuwait', 'Kuwait'),
      ('kyrgyz republic', 'Kyrgyzstan'),
      ('kyrgyzstan', 'Kyrgyzstan'),
      ('lao pdr', 'Laos'),
      ('lao people''s democratic republic', 'Laos'),
      ('laos', 'Laos'),
      ('latvia', 'Latvia'),
      ('lebanon', 'Lebanon'),
      ('lesotho', 'Lesotho'),
      ('liberia', 'Liberia'),
      ('libya', 'Libya'),
      ('liechtenstein', 'Liechtenstein'),
      ('lithuania', 'Lithuania'),
      ('luxembourg', 'Luxembourg'),
      ('macao', 'Macau'),
      ('macao sar', 'Macau'),
      ('macau', 'Macau'),
      ('macau sar', 'Macau'),
      ('madagascar', 'Madagascar'),
      ('malawi', 'Malawi'),
      ('malaysia', 'Malaysia'),
      ('maldives', 'Maldives'),
      ('mali', 'Mali'),
      ('malta', 'Malta'),
      ('marshall islands', 'Marshall Islands'),
      ('martinique', 'Martinique'),
      ('mauritania', 'Mauritania'),
      ('mauritius', 'Mauritius'),
      ('mayotte', 'Mayotte'),
      ('mexico', 'Mexico'),
      ('micronesia', 'Micronesia'),
      ('moldova', 'Moldova'),
      ('monaco', 'Monaco'),
      ('mongolia', 'Mongolia'),
      ('montenegro', 'Montenegro'),
      ('montserrat', 'Montserrat'),
      ('morocco', 'Morocco'),
      ('mozambique', 'Mozambique'),
      ('myanmar', 'Myanmar'),
      ('namibia', 'Namibia'),
      ('nauru', 'Nauru'),
      ('nepal', 'Nepal'),
      ('netherlands', 'Netherlands'),
      ('new caledonia', 'New Caledonia'),
      ('new zealand', 'New Zealand'),
      ('nicaragua', 'Nicaragua'),
      ('niger', 'Niger'),
      ('nigeria', 'Nigeria'),
      ('niue', 'Niue'),
      ('norfolk island', 'Norfolk Island'),
      ('north korea', 'North Korea'),
      ('north macedonia', 'North Macedonia'),
      ('northern ireland', 'United Kingdom'),
      ('northern mariana islands', 'Northern Mariana Islands'),
      ('norway', 'Norway'),
      ('oman', 'Oman'),
      ('pakistan', 'Pakistan'),
      ('palau', 'Palau'),
      ('palestine', 'Palestine'),
      ('palestinian territories', 'Palestine'),
      ('panama', 'Panama'),
      ('papua new guinea', 'Papua New Guinea'),
      ('paraguay', 'Paraguay'),
      ('peru', 'Peru'),
      ('philippines', 'Philippines'),
      ('pitcairn', 'Pitcairn Islands'),
      ('pitcairn islands', 'Pitcairn Islands'),
      ('poland', 'Poland'),
      ('portugal', 'Portugal'),
      ('puerto rico', 'Puerto Rico'),
      ('qatar', 'Qatar'),
      ('republic of georgia', 'Georgia'),
      ('republic of ireland', 'Ireland'),
      ('republic of korea', 'South Korea'),
      ('republic of moldova', 'Moldova'),
      ('republic of the congo', 'Republic of the Congo'),
      ('reunion', 'Réunion'),
      ('romania', 'Romania'),
      ('russia', 'Russia'),
      ('russian federation', 'Russia'),
      ('rwanda', 'Rwanda'),
      ('réunion', 'Réunion'),
      ('saint barthelemy', 'Saint Barthélemy'),
      ('saint barthélemy', 'Saint Barthélemy'),
      ('saint helena', 'Saint Helena'),
      ('saint kitts and nevis', 'Saint Kitts and Nevis'),
      ('saint lucia', 'Saint Lucia'),
      ('saint martin', 'Saint Martin'),
      ('saint pierre and miquelon', 'Saint Pierre and Miquelon'),
      ('saint vincent and the grenadines', 'Saint Vincent and the Grenadines'),
      ('samoa', 'Samoa'),
      ('san marino', 'San Marino'),
      ('sao tome and principe', 'São Tomé and Príncipe'),
      ('saudi arabia', 'Saudi Arabia'),
      ('scotland', 'United Kingdom'),
      ('senegal', 'Senegal'),
      ('serbia', 'Serbia'),
      ('seychelles', 'Seychelles'),
      ('sierra leone', 'Sierra Leone'),
      ('singapore', 'Singapore'),
      ('sint maarten', 'Sint Maarten'),
      ('slovak republic', 'Slovakia'),
      ('slovakia', 'Slovakia'),
      ('slovenia', 'Slovenia'),
      ('solomon islands', 'Solomon Islands'),
      ('somalia', 'Somalia'),
      ('south africa', 'South Africa'),
      ('south georgia and the south sandwich islands', 'South Georgia and the South Sandwich Islands'),
      ('south korea', 'South Korea'),
      ('south sudan', 'South Sudan'),
      ('spain', 'Spain'),
      ('sri lanka', 'Sri Lanka'),
      ('st kitts and nevis', 'Saint Kitts and Nevis'),
      ('st lucia', 'Saint Lucia'),
      ('st vincent and the grenadines', 'Saint Vincent and the Grenadines'),
      ('state of palestine', 'Palestine'),
      ('sudan', 'Sudan'),
      ('suriname', 'Suriname'),
      ('svalbard', 'Svalbard and Jan Mayen'),
      ('svalbard and jan mayen', 'Svalbard and Jan Mayen'),
      ('swaziland', 'Eswatini'),
      ('sweden', 'Sweden'),
      ('switzerland', 'Switzerland'),
      ('syria', 'Syria'),
      ('syrian arab republic', 'Syria'),
      ('são tomé and príncipe', 'São Tomé and Príncipe'),
      ('taiwan', 'Taiwan'),
      ('tajikistan', 'Tajikistan'),
      ('tanzania', 'Tanzania'),
      ('thailand', 'Thailand'),
      ('the bahamas', 'Bahamas'),
      ('the gambia', 'Gambia'),
      ('the netherlands', 'Netherlands'),
      ('the philippines', 'Philippines'),
      ('timor leste', 'East Timor'),
      ('timor-leste', 'East Timor'),
      ('togo', 'Togo'),
      ('tokelau', 'Tokelau'),
      ('tonga', 'Tonga'),
      ('trinidad & tobago', 'Trinidad and Tobago'),
      ('trinidad and tobago', 'Trinidad and Tobago'),
      ('tunisia', 'Tunisia'),
      ('turkey', 'Turkey'),
      ('turkiye', 'Turkey'),
      ('turkmenistan', 'Turkmenistan'),
      ('turks and caicos islands', 'Turks and Caicos Islands'),
      ('tuvalu', 'Tuvalu'),
      ('türkiye', 'Turkey'),
      ('uae', 'United Arab Emirates'),
      ('uganda', 'Uganda'),
      ('uk', 'United Kingdom'),
      ('ukraine', 'Ukraine'),
      ('united arab emirates', 'United Arab Emirates'),
      ('united kingdom', 'United Kingdom'),
      ('united republic of tanzania', 'Tanzania'),
      ('united states', 'United States'),
      ('united states minor outlying islands', 'United States Minor Outlying Islands'),
      ('united states of america', 'United States'),
      ('united states virgin islands', 'United States Virgin Islands'),
      ('uruguay', 'Uruguay'),
      ('us', 'United States'),
      ('us virgin islands', 'United States Virgin Islands'),
      ('usa', 'United States'),
      ('uzbekistan', 'Uzbekistan'),
      ('vanuatu', 'Vanuatu'),
      ('vatican', 'Vatican City'),
      ('vatican city', 'Vatican City'),
      ('venezuela', 'Venezuela'),
      ('viet nam', 'Vietnam'),
      ('vietnam', 'Vietnam'),
      ('wales', 'United Kingdom'),
      ('wallis and futuna', 'Wallis and Futuna'),
      ('western sahara', 'Western Sahara'),
      ('yemen', 'Yemen'),
      ('zambia', 'Zambia'),
      ('zimbabwe', 'Zimbabwe'),
      ('åland islands', 'Åland Islands')
      -- country-keys:end
  ),
  stamped_rows AS (
    SELECT
      j.id,
      (SELECT lower(btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
         FROM unnest(string_to_array(j.location_text, ',')) WITH ORDINALITY AS u(seg, pos)
        WHERE btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)) <> ''
        ORDER BY u.pos DESC
        LIMIT 1) AS last_segment
    FROM public.jobs j
    WHERE j.updated_at = v_stamp
      AND j.created_at < TIMESTAMPTZ '2026-11-15 00:00:00+00'
  )
  UPDATE public.jobs j
     SET location_country = NULL
    FROM stamped_rows s
    JOIN country_keys k ON k.lookup_key = s.last_segment
   WHERE j.id = s.id
     AND j.updated_at = v_stamp
     AND j.location_country = k.canonical;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RAISE NOTICE 'Part C: % rows cleared; % rows of Part B were changed again since and left alone.',
    v_cleared, v_max - v_cleared;

  IF v_cleared > v_max THEN
    RAISE EXCEPTION 'Part C: % rows matched, more than Part B changed (%). Rolled back, nothing changed.',
      v_cleared, v_max;
  END IF;
END
$undo$;

SELECT now() AS part_c_stamp, count(*) AS rows_cleared
FROM public.jobs
WHERE updated_at = now();

COMMIT;
