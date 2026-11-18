-- =====================================================================
-- TrendsTees | LAUNCH SE PEHLE CHALANA: saare TeePublic demo designs hatao
-- =====================================================================
-- Order zaroori hai: pehle child rows (jo design ko point karti hain),
-- phir designs, phir unki files.
-- Note: agar kisi demo design ka order ban chuka hai (order_items) to
-- yeh fail hoga - woh test orders pehle hatane honge.
-- media\designs\teepublic folder bhi manually delete kar dena.
-- =====================================================================

BEGIN;

CREATE TEMP TABLE demo_designs AS
  SELECT design_id, artwork_file_id FROM designs WHERE source_platform = 'teepublic_demo';

DELETE FROM cart_items              WHERE design_id IN (SELECT design_id FROM demo_designs);
DELETE FROM favorites               WHERE design_id IN (SELECT design_id FROM demo_designs);
DELETE FROM design_tags             WHERE design_id IN (SELECT design_id FROM demo_designs);
DELETE FROM collection_designs      WHERE design_id IN (SELECT design_id FROM demo_designs);
DELETE FROM design_product_settings WHERE design_id IN (SELECT design_id FROM demo_designs);
DELETE FROM designs                 WHERE design_id IN (SELECT design_id FROM demo_designs);
DELETE FROM files                   WHERE file_id   IN (SELECT artwork_file_id FROM demo_designs);

COMMIT;
