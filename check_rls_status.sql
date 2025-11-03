-- Check RLS status for all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check hunting_areas table existence
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'hunting_areas'
) as hunting_areas_exists;

-- Check what policies exist on hunting_areas
SELECT * FROM pg_policies WHERE tablename = 'hunting_areas';

