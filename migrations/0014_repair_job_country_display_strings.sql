-- ============================================================================
-- 0014_repair_job_country_display_strings.sql
-- Date: 15 Nov 2026
--
-- NOT YET APPLIED — run only after a fresh backup and the owner's approval
-- of the exact change.
--
-- What: rewrites public.jobs.location_country for jobs whose stored value
-- is not a country name: the provider's display text ("UK", "US",
-- "London, UK", "Artington, Guildford") was copied into location_country
-- by the importer before the 10 Sep 2026 normaliser fix. Each such row
-- gets its real country (one of the canonical names), every status.
--
-- Why: the jobs Country menu (refresh_site_counts, 0011) lists every
-- stored value as-is, and the country filter matches exactly, so these
-- jobs show as menu entries such as "UK" or "Artington, Guildford" and
-- are missing from their real country. Measured 15 Nov 2026 19:2x UTC
-- (read-only): 3,914 rows, all source adzuna, all created 9 Sep 2026
-- 15:09-19:32 UTC, location_country = location_text in every one;
-- 'UK' 197, 'US' 6, the rest "Town, Region" strings (1,468 distinct
-- values); 44 of them browsable on accountingbody.com, 0 on ethiotax.com.
-- New imports are clean (0 such rows created after 9 Sep 19:32 UTC).
-- Old rows that are "seen again" are revived without rewriting
-- location_country, so all statuses are repaired, not only active.
--
-- The mapping (the reference; copied character-for-character between the
-- "-- mapping:begin" and "-- mapping:end" markers in Parts A, B0 and B;
-- lib/ingestion/countries.test.ts checks the copies are identical):
--   trim  = btrim(x, E' \t\n\r\f\x0B' || chr(160) || chr(65279))  (as 0012)
--   step 1: lower(trim(location_country)) through the country lookup
--           ('UK' -> United Kingdom, 'US' -> United States)
--   step 2: else the last non-empty comma segment of location_text,
--           lower(trim(segment)), through the country lookup (as 0012)
--   step 3: else the provider's single country: job_providers.country_codes
--           when it holds exactly one code, lower(trim(code)), through the
--           provider-codes list (gb, us, au, za, ca, sg)
--   new_value = coalesce(step 1, step 2, step 3); NULL = unmapped
--   (Part B refuses to run if any row in scope is unmapped).
-- Expected (15 Nov 19:2x UTC): step 1 203, step 2 720, step 3 2,991 =
-- 3,914; United Kingdom 2,593, United States 373, Australia 348,
-- South Africa 305, Canada 261, Singapore 34; 0 unmapped.
--
-- Scope: location_country IS NOT NULL AND <> '' AND <> 'Worldwide' AND
-- not one of the 249 canonical country names (the distinct canonical
-- values of the lookup list below, which is the same list as 0012).
-- What changes: ONLY public.jobs.location_country, ONLY for rows in scope.
-- The jobs trigger jobs_search_vector_update (0002) fires on every UPDATE:
-- it rebuilds search_vector (unchanged result, location_country is not one
-- of its columns) and sets updated_at = now().
--
-- The country-keys VALUES list (lookup key, canonical name) is the same
-- list 0012 uses, generated from lib/ingestion/countries.ts; the
-- provider-codes list holds COUNTRY_CODES entries from the same file.
-- lib/ingestion/countries.test.ts checks every copy against that file.
--
-- How to run (psql from the Codespace, or the Supabase SQL editor for the
-- plain-SQL parts). Do not run this file as one query, and never with
-- psql -f: each part is run on its own, in this order:
--   fresh backup proven -> Part A0 and Part A (read-only) -> owner approves
--   the numbers -> Part B0 (read-only, psql: saves the before-image CSV in
--   the git-ignored reports/ folder; its row count must equal Part A2) ->
--   Part B with v_expected = the Part A2 total -> save the Part B result
--   row -> the 10-minute refresh_site_counts run rebuilds the menu.
-- Undo: Part C, only with the owner's approval, from the Part B0 CSV.
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
--   A1  rows in scope by provider slug and status.
--   A2  one row: total rows Part B would change. Part B needs this number.
--   A3  the result of the mapping: one row per (old-value class, step used,
--       new value) with counts. Expect no row with new value NULL.
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
provider_codes(code, canonical) AS (
  VALUES
    -- provider-codes:begin (COUNTRY_CODES entries from lib/ingestion/countries.ts)
    ('au', 'Australia'),
    ('ca', 'Canada'),
    ('gb', 'United Kingdom'),
    ('sg', 'Singapore'),
    ('us', 'United States'),
    ('za', 'South Africa')
    -- provider-codes:end
),
-- mapping:begin
in_scope AS (
  SELECT
    j.id,
    j.status,
    j.provider_id,
    j.location_country AS old_value,
    lower(btrim(j.location_country, E' \t\n\r\f\x0B' || chr(160) || chr(65279))) AS stored_key,
    (SELECT lower(btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM unnest(string_to_array(j.location_text, ',')) WITH ORDINALITY AS u(seg, pos)
      WHERE btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)) <> ''
      ORDER BY u.pos DESC
      LIMIT 1) AS last_segment,
    (SELECT lower(btrim(p.country_codes[1], E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM public.job_providers p
      WHERE p.id = j.provider_id
        AND cardinality(p.country_codes) = 1) AS provider_code
  FROM public.jobs j
  WHERE j.location_country IS NOT NULL
    AND j.location_country <> ''
    AND j.location_country <> 'Worldwide'
    AND j.location_country NOT IN (SELECT ck.canonical FROM country_keys ck)
),
mapped AS (
  SELECT
    s.id,
    s.status,
    s.provider_id,
    s.old_value,
    CASE WHEN position(',' IN s.old_value) > 0 THEN 'comma string'
         ELSE 'single value' END AS old_class,
    CASE WHEN k1.canonical IS NOT NULL THEN 'step 1: stored value'
         WHEN k2.canonical IS NOT NULL THEN 'step 2: last segment'
         WHEN c3.canonical IS NOT NULL THEN 'step 3: provider country'
         ELSE 'unmapped' END AS step_used,
    coalesce(k1.canonical, k2.canonical, c3.canonical) AS new_value
  FROM in_scope s
  LEFT JOIN country_keys k1 ON k1.lookup_key = s.stored_key
  LEFT JOIN country_keys k2 ON k2.lookup_key = s.last_segment
  LEFT JOIN provider_codes c3 ON c3.code = s.provider_code
)
-- mapping:end
SELECT * FROM (
  SELECT
    'A1' AS part,
    coalesce((SELECT p.slug FROM public.job_providers p WHERE p.id = m.provider_id), '(no provider)') AS item,
    m.status AS detail,
    NULL::text AS new_value,
    count(*) AS total
  FROM mapped m
  GROUP BY 2, 3

  UNION ALL

  SELECT 'A2', 'all rows Part B would change', NULL, NULL, count(*)
  FROM mapped m

  UNION ALL

  SELECT 'A3', m.old_class, m.step_used, coalesce(m.new_value, '(NULL: unmapped)'), count(*)
  FROM mapped m
  GROUP BY m.old_class, m.step_used, m.new_value
) preview
ORDER BY part, total DESC, item, detail, new_value;


-- ----------------------------------------------------------------------------
-- PART B0 — READ-ONLY. The before-image for the undo. psql only (it uses
-- \pset and \o). Run on its own, immediately before Part B, after the
-- owner has approved the Part A numbers.
--
-- Writes one CSV file in the git-ignored reports/ folder (kept privately;
-- never committed): header id,old_location_country,new_location_country
-- plus one line per row in scope. Its data-line count must equal the
-- Part A2 total; if not, stop. Part C needs this file.
-- ----------------------------------------------------------------------------
BEGIN READ ONLY;
SHOW transaction_read_only;
\pset format csv
\o reports/AB-S2-0014-before-image.csv
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
provider_codes(code, canonical) AS (
  VALUES
    -- provider-codes:begin (COUNTRY_CODES entries from lib/ingestion/countries.ts)
    ('au', 'Australia'),
    ('ca', 'Canada'),
    ('gb', 'United Kingdom'),
    ('sg', 'Singapore'),
    ('us', 'United States'),
    ('za', 'South Africa')
    -- provider-codes:end
),
-- mapping:begin
in_scope AS (
  SELECT
    j.id,
    j.status,
    j.provider_id,
    j.location_country AS old_value,
    lower(btrim(j.location_country, E' \t\n\r\f\x0B' || chr(160) || chr(65279))) AS stored_key,
    (SELECT lower(btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM unnest(string_to_array(j.location_text, ',')) WITH ORDINALITY AS u(seg, pos)
      WHERE btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)) <> ''
      ORDER BY u.pos DESC
      LIMIT 1) AS last_segment,
    (SELECT lower(btrim(p.country_codes[1], E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM public.job_providers p
      WHERE p.id = j.provider_id
        AND cardinality(p.country_codes) = 1) AS provider_code
  FROM public.jobs j
  WHERE j.location_country IS NOT NULL
    AND j.location_country <> ''
    AND j.location_country <> 'Worldwide'
    AND j.location_country NOT IN (SELECT ck.canonical FROM country_keys ck)
),
mapped AS (
  SELECT
    s.id,
    s.status,
    s.provider_id,
    s.old_value,
    CASE WHEN position(',' IN s.old_value) > 0 THEN 'comma string'
         ELSE 'single value' END AS old_class,
    CASE WHEN k1.canonical IS NOT NULL THEN 'step 1: stored value'
         WHEN k2.canonical IS NOT NULL THEN 'step 2: last segment'
         WHEN c3.canonical IS NOT NULL THEN 'step 3: provider country'
         ELSE 'unmapped' END AS step_used,
    coalesce(k1.canonical, k2.canonical, c3.canonical) AS new_value
  FROM in_scope s
  LEFT JOIN country_keys k1 ON k1.lookup_key = s.stored_key
  LEFT JOIN country_keys k2 ON k2.lookup_key = s.last_segment
  LEFT JOIN provider_codes c3 ON c3.code = s.provider_code
)
-- mapping:end
SELECT m.id, m.old_value AS old_location_country, m.new_value AS new_location_country
FROM mapped m
ORDER BY m.id;
\o
\pset format aligned
ROLLBACK;


-- ----------------------------------------------------------------------------
-- PART B — THE UPDATE. Only after a fresh backup, the owner's approval of
-- the Part A numbers, and the Part B0 CSV saved with the right row count.
-- Run on its own, as one query.
--
-- Before running: put the Part A2 total in v_expected below.
-- If any row in scope has no mapping, or the number of rows changed is
-- not exactly v_expected, the block raises an error and the whole
-- transaction is rolled back: nothing changes.
--
-- After running: SAVE the result row (part_b_stamp and rows_with_stamp).
-- rows_with_stamp must equal v_expected.
-- ----------------------------------------------------------------------------
BEGIN;

DO $repair$
DECLARE
  v_expected integer := NULL;  -- put the Part A2 total here
  v_unmapped integer;
  v_changed  integer;
  v_stamped  integer;
BEGIN
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Part B: put the Part A2 total in v_expected first. Nothing changed.';
  END IF;

  CREATE TEMP TABLE pg_temp.job_country_repair ON COMMIT DROP AS
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
provider_codes(code, canonical) AS (
  VALUES
    -- provider-codes:begin (COUNTRY_CODES entries from lib/ingestion/countries.ts)
    ('au', 'Australia'),
    ('ca', 'Canada'),
    ('gb', 'United Kingdom'),
    ('sg', 'Singapore'),
    ('us', 'United States'),
    ('za', 'South Africa')
    -- provider-codes:end
),
-- mapping:begin
in_scope AS (
  SELECT
    j.id,
    j.status,
    j.provider_id,
    j.location_country AS old_value,
    lower(btrim(j.location_country, E' \t\n\r\f\x0B' || chr(160) || chr(65279))) AS stored_key,
    (SELECT lower(btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM unnest(string_to_array(j.location_text, ',')) WITH ORDINALITY AS u(seg, pos)
      WHERE btrim(u.seg, E' \t\n\r\f\x0B' || chr(160) || chr(65279)) <> ''
      ORDER BY u.pos DESC
      LIMIT 1) AS last_segment,
    (SELECT lower(btrim(p.country_codes[1], E' \t\n\r\f\x0B' || chr(160) || chr(65279)))
       FROM public.job_providers p
      WHERE p.id = j.provider_id
        AND cardinality(p.country_codes) = 1) AS provider_code
  FROM public.jobs j
  WHERE j.location_country IS NOT NULL
    AND j.location_country <> ''
    AND j.location_country <> 'Worldwide'
    AND j.location_country NOT IN (SELECT ck.canonical FROM country_keys ck)
),
mapped AS (
  SELECT
    s.id,
    s.status,
    s.provider_id,
    s.old_value,
    CASE WHEN position(',' IN s.old_value) > 0 THEN 'comma string'
         ELSE 'single value' END AS old_class,
    CASE WHEN k1.canonical IS NOT NULL THEN 'step 1: stored value'
         WHEN k2.canonical IS NOT NULL THEN 'step 2: last segment'
         WHEN c3.canonical IS NOT NULL THEN 'step 3: provider country'
         ELSE 'unmapped' END AS step_used,
    coalesce(k1.canonical, k2.canonical, c3.canonical) AS new_value
  FROM in_scope s
  LEFT JOIN country_keys k1 ON k1.lookup_key = s.stored_key
  LEFT JOIN country_keys k2 ON k2.lookup_key = s.last_segment
  LEFT JOIN provider_codes c3 ON c3.code = s.provider_code
)
-- mapping:end
SELECT m.id, m.old_value, m.new_value
FROM mapped m;

  SELECT count(*) INTO v_unmapped FROM pg_temp.job_country_repair WHERE new_value IS NULL;
  IF v_unmapped <> 0 THEN
    RAISE EXCEPTION 'Part B: % rows in scope have no mapping. Rolled back, nothing changed.', v_unmapped;
  END IF;

  UPDATE public.jobs j
     SET location_country = r.new_value
    FROM pg_temp.job_country_repair r
   WHERE j.id = r.id
     AND j.location_country = r.old_value;

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RAISE NOTICE 'Part B: % rows changed (expected %).', v_changed, v_expected;

  IF v_changed <> v_expected THEN
    RAISE EXCEPTION 'Part B: % rows would change, but Part A2 said %. Rolled back, nothing changed.',
      v_changed, v_expected;
  END IF;

  -- The jobs trigger stamps every changed row with updated_at = now().
  -- Stop if that stamp is not on every changed row.
  SELECT count(*) INTO v_stamped FROM public.jobs WHERE updated_at = now();
  IF v_stamped <> v_changed THEN
    RAISE EXCEPTION 'Part B: % rows changed but % carry this run''s updated_at stamp. Rolled back, nothing changed.',
      v_changed, v_stamped;
  END IF;
END
$repair$;

-- now() is fixed for the whole transaction, and the jobs trigger set
-- updated_at = now() on every row changed above.
SELECT now() AS part_b_stamp, count(*) AS rows_with_stamp
FROM public.jobs
WHERE updated_at = now();

COMMIT;


-- ----------------------------------------------------------------------------
-- PART C — UNDO for Part B. Only with the owner's approval. psql only (it
-- uses \copy). Run on its own, as one transaction.
--
-- Needs the Part B0 CSV (reports/AB-S2-0014-before-image.csv, kept
-- privately). Before running: put the CSV's data-line count (= Part B's
-- changed count) in v_expected below.
--
-- Loads the CSV into a session temp table (dropped at commit; no object
-- is left in the shared schema) and puts back the old location_country
-- ONLY for rows whose current value still equals the value Part B set.
-- A row changed again since (an admin edit or a re-import) is left alone;
-- the notice reports how many. updated_at cannot be put back: the trigger
-- sets it to now() again on this UPDATE.
-- ----------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE job_country_before (
  id                   uuid PRIMARY KEY,
  old_location_country text NOT NULL,
  new_location_country text NOT NULL
) ON COMMIT DROP;

\copy pg_temp.job_country_before FROM 'reports/AB-S2-0014-before-image.csv' WITH (FORMAT csv, HEADER true)

DO $undo$
DECLARE
  v_expected integer := NULL;  -- put the CSV's data-line count here
  v_loaded   integer;
  v_restored integer;
BEGIN
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Part C: put the before-image row count in v_expected first. Nothing changed.';
  END IF;

  SELECT count(*) INTO v_loaded FROM pg_temp.job_country_before;
  IF v_loaded <> v_expected THEN
    RAISE EXCEPTION 'Part C: % rows loaded from the CSV, expected %. Rolled back, nothing changed.',
      v_loaded, v_expected;
  END IF;

  UPDATE public.jobs j
     SET location_country = b.old_location_country
    FROM pg_temp.job_country_before b
   WHERE j.id = b.id
     AND j.location_country = b.new_location_country;

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  RAISE NOTICE 'Part C: % rows restored; % rows of Part B were changed again since and left alone.',
    v_restored, v_loaded - v_restored;

  IF v_restored > v_loaded THEN
    RAISE EXCEPTION 'Part C: % rows matched, more than the CSV holds (%). Rolled back, nothing changed.',
      v_restored, v_loaded;
  END IF;
END
$undo$;

SELECT now() AS part_c_stamp, count(*) AS rows_restored
FROM public.jobs
WHERE updated_at = now();

COMMIT;
