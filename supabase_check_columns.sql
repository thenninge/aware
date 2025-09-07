-- Check what columns exist in tracks table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracks' 
ORDER BY column_name;

-- Check what columns exist in finds table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'finds' 
ORDER BY column_name;

-- Check what columns exist in observations table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'observations' 
ORDER BY column_name;
