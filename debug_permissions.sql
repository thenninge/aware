-- Check table ownership and privileges
SELECT 
    tablename,
    tableowner,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('hunting_areas', 'tracks', 'finds', 'observations')
ORDER BY tablename;

-- Check if service role has access
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
AND table_name = 'hunting_areas'
ORDER BY grantee, privilege_type;

-- Compare with tracks table
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
AND table_name = 'tracks'
ORDER BY grantee, privilege_type;

