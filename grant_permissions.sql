-- Grant all privileges on hunting_areas to authenticated and service_role
GRANT ALL ON hunting_areas TO authenticated;
GRANT ALL ON hunting_areas TO service_role;
GRANT ALL ON hunting_areas TO anon;

-- Also grant on the sequence if there is one (there isn't for this table, but just in case)
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Verify grants
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
AND table_name = 'hunting_areas'
ORDER BY grantee, privilege_type;

