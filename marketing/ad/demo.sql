-- Demo copy for the ad video: fictional customer/supplier names, no phone numbers, test entries removed,
-- dates moved forward so the last month of activity is "this month".
set search_path to qayam;

-- remove entries made while testing the app
delete from approvals; delete from notices; delete from voice_drafts;
delete from journals where not legacy;
delete from invoices where not legacy;
delete from parties where id not in (select party_id from invoices where party_id is not null) and id not in (select party_id from journal_lines where party_id is not null);
delete from audit_log;
delete from counters;

-- move all dates forward 32 days (last entry becomes today)
update journals set date = date + 32;
update invoices set date = date + 32;

-- fictional names
with c as (select id, row_number() over (order by id) n from parties where kind = 'C'),
     names(n, name, city) as (values
  (1,'Mehran Hotel','Hyderabad'),(2,'Al-Noor Bakers','Hyderabad'),(3,'Karachi Sweets','Karachi'),(4,'Shahi Restaurant','Hyderabad'),(5,'Lahori Tikka House','Karachi'),
  (6,'Madina Dairy','Hyderabad'),(7,'Royal Bakery','Kotri'),(8,'Sindh Cafe','Hyderabad'),(9,'Grill Point','Hyderabad'),(10,'Taj Caterers','Karachi'),
  (11,'Bismillah Store','Hyderabad'),(12,'Faisal Sweets','Jamshoro'),(13,'City Pizza','Hyderabad'),(14,'Kohinoor Hotel','Karachi'),(15,'New Asia Bakers','Hyderabad'),
  (16,'Shah Jee Dairy','Hyderabad'),(17,'Pak Tea House','Karachi'),(18,'Delight Bakers','Hyderabad'),(19,'Al-Habib Restaurant','Nawabshah'),(20,'Golden Fork','Hyderabad'),
  (21,'Usmania Sweets','Karachi'),(22,'Rehmat Hotel','Hyderabad'),(23,'Crown Bakery','Hyderabad'),(24,'Ali Baba Foods','Karachi'),(25,'Sultan Karahi','Hyderabad'),
  (26,'Fresh Bites Cafe','Hyderabad'),(27,'Nawab Caterers','Karachi'),(28,'Moon Bakers','Hyderabad'),(29,'Zam Zam Hotel','Kotri'),(30,'Hilltop Restaurant','Hyderabad'),
  (31,'Five Star Sweets','Karachi'),(32,'Diamond Bakery','Hyderabad'),(33,'Lucky Hotel','Hyderabad'),(34,'Prince Pizza','Karachi'),(35,'Sabri Nihari','Hyderabad'),
  (36,'Quetta Cafe','Hyderabad'),(37,'Silver Spoon','Karachi'),(38,'Bundu Khan Foods','Hyderabad'),(39,'Coco Bakers','Hyderabad'),(40,'Star Caterers','Karachi'))
update parties p set name = names.name, city = names.city, phone = '', address = '', ntn = '' from c join names on names.n = c.n where p.id = c.id;

with v as (select id, row_number() over (order by id) n from parties where kind = 'V'),
     names(n, name, city) as (values (1,'Prime Dairy Foods','Lahore'),(2,'Indus Butter Co','Karachi'),(3,'Delta Foods','Nawabshah'),(4,'Al-Barakah Traders','Karachi'),(5,'Sunrise Agency','Hyderabad'),(6,'Green Valley Dairy','Lahore'))
update parties p set name = names.name, city = names.city, phone = '', address = '', ntn = '' from v join names on names.n = v.n where p.id = v.id;

-- the bigger customers get a phone so WhatsApp buttons show (dummy numbers)
update parties set phone = '0300-0000000' where kind = 'C';

-- tidy product names
update products set name = case id
  when 1 then 'Pure Butter' when 2 then 'Butter Blend' when 3 then 'Substitute' when 4 then 'White S2' when 5 then 'Yellow Blend 500g'
  when 6 then 'Substitute Red85' when 7 then 'Butter Premium' when 8 then 'Butter 200g (Carton)' when 9 then 'Pure White'
  when 10 then 'DD Mayonnaise 4kg' when 11 then 'Classic Mayonnaise 4kg' when 12 then 'Professional Mayonnaise 4kg'
  when 13 then 'Penne Pasta 700g (Ctn)' when 14 then 'Elbow Macaroni 1kg (Ctn)' when 15 then 'Real Mayonnaise 4kg'
  when 16 then 'Butter 10g Portion' when 17 then 'Butter 200g (30 pcs)' else name end;
update products set price = 1950 where id = 10; update products set price = 2400 where id = 13; update products set price = 2600 where id = 14;
insert into products(name, category, unit, cost, price, stock, aliases) values ('Desi Ghee', 'Ghee', 'kg', 820, 1000, 240, 'ghee, ghi, desi ghee');
-- keep stock positive for a clean demo
update products set stock = greatest(stock, 0) + case when stock < 20 then 120 else 0 end;

-- company details for the invoice
update settings set value = value || '{"address":"Hyderabad, Sindh","phone":"0300-0000000","bank":"Meezan Bank · A/C Title: Qayam Traders","terms":"Maal check kar ke wasool karein. Payment 15 din mein."}'::jsonb where key = 'company';
