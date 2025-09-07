-- Demo Coaches Setup Script
-- This script is IDEMPOTENT - safe to run multiple times
-- It creates demo coaches for testing the booking system

-- First, ensure we have a demo tenant to assign coaches to
-- This will use the existing tenant or create a demo one if none exists
DO $$
DECLARE
    demo_tenant_id UUID;
    demo_tenant_exists BOOLEAN := FALSE;
BEGIN
    -- Check if we have any existing tenant
    SELECT id INTO demo_tenant_id FROM tenants LIMIT 1;
    
    IF demo_tenant_id IS NULL THEN
        -- Create a demo tenant if none exists
        INSERT INTO tenants (
            id,
            name,
            slug,
            status,
            settings,
            subscription_status,
            trial_ends_at
        ) VALUES (
            gen_random_uuid(),
            'Demo Organization',
            'demo-org',
            'active',
            '{"demo": true}',
            'active',
            NOW() + INTERVAL '30 days'
        ) 
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            updated_at = NOW()
        RETURNING id INTO demo_tenant_id;
        
        RAISE NOTICE 'Created demo tenant: %', demo_tenant_id;
    ELSE
        RAISE NOTICE 'Using existing tenant: %', demo_tenant_id;
    END IF;

    -- Now create demo coaches (idempotent - will update if they exist)
    
    -- 1. Goal Setting Coach - Video specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0001-000000000001',
        'sarah.goals@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Sarah", "last_name": "Mitchell"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0001-000000000001',
        demo_tenant_id,
        'sarah.goals@demo.mindshift.com',
        'Sarah',
        'Mitchell',
        'coach',
        true,
        '{"specialties": ["Goal Setting"], "preferred_meeting_types": ["video", "zoom"], "bio": "Expert in goal setting and achievement strategies with 8+ years experience."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 2. Confidence Building Coach - Phone specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0002-000000000002',
        'michael.confidence@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Michael", "last_name": "Chen"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0002-000000000002',
        demo_tenant_id,
        'michael.confidence@demo.mindshift.com',
        'Michael',
        'Chen',
        'coach',
        true,
        '{"specialties": ["Confidence Building"], "preferred_meeting_types": ["phone", "video"], "bio": "Specializes in confidence building and self-esteem coaching. Prefers phone sessions for deeper connection."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 3. Stress Management Coach - Google Meet specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0003-000000000003',
        'emma.stress@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Emma", "last_name": "Rodriguez"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0003-000000000003',
        demo_tenant_id,
        'emma.stress@demo.mindshift.com',
        'Emma',
        'Rodriguez',
        'coach',
        true,
        '{"specialties": ["Stress Management"], "preferred_meeting_types": ["google_meet", "video"], "bio": "Licensed therapist specializing in stress reduction and mindfulness techniques."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 4. Career Development Coach - Teams specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0004-000000000004',
        'david.career@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "David", "last_name": "Thompson"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0004-000000000004',
        demo_tenant_id,
        'david.career@demo.mindshift.com',
        'David',
        'Thompson',
        'coach',
        true,
        '{"specialties": ["Career Development"], "preferred_meeting_types": ["teams", "video"], "bio": "Executive coach with 15+ years in corporate leadership and career advancement."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 5. Relationship Coaching - In Person specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0005-000000000005',
        'lisa.relationships@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Lisa", "last_name": "Johnson"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0005-000000000005',
        demo_tenant_id,
        'lisa.relationships@demo.mindshift.com',
        'Lisa',
        'Johnson',
        'coach',
        true,
        '{"specialties": ["Relationship Coaching"], "preferred_meeting_types": ["in_person", "video"], "bio": "Marriage and family therapist specializing in relationship dynamics and communication."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 6. Performance Coaching - Zoom specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0006-000000000006',
        'alex.performance@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Alex", "last_name": "Rivera"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0006-000000000006',
        demo_tenant_id,
        'alex.performance@demo.mindshift.com',
        'Alex',
        'Rivera',
        'coach',
        true,
        '{"specialties": ["Performance Coaching"], "preferred_meeting_types": ["zoom", "video"], "bio": "High-performance coach working with athletes and executives to optimize performance."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 7. Life Transition Support - Video specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0007-000000000007',
        'maria.transitions@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Maria", "last_name": "Garcia"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0007-000000000007',
        demo_tenant_id,
        'maria.transitions@demo.mindshift.com',
        'Maria',
        'Garcia',
        'coach',
        true,
        '{"specialties": ["Life Transition Support"], "preferred_meeting_types": ["video", "phone"], "bio": "Specializes in helping clients navigate major life changes and transitions."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 8. Mindfulness Training - Phone specialist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0008-000000000008',
        'zen.mindfulness@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Zen", "last_name": "Patel"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0008-000000000008',
        demo_tenant_id,
        'zen.mindfulness@demo.mindshift.com',
        'Zen',
        'Patel',
        'coach',
        true,
        '{"specialties": ["Mindfulness Training"], "preferred_meeting_types": ["phone", "video"], "bio": "Certified mindfulness instructor with expertise in meditation and stress reduction techniques."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    -- 9. General Manager - All meeting types (for Custom Sessions)
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        '00000000-0000-0000-0009-000000000009',
        'jordan.manager@demo.mindshift.com',
        crypt('DemoPassword123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"first_name": "Jordan", "last_name": "Smith"}',
        false,
        'authenticated'
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    INSERT INTO profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        settings,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0009-000000000009',
        demo_tenant_id,
        'jordan.manager@demo.mindshift.com',
        'Jordan',
        'Smith',
        'manager',
        true,
        '{"specialties": ["Custom Session"], "preferred_meeting_types": ["video", "zoom", "google_meet", "teams", "phone", "in_person"], "bio": "Senior coaching manager with expertise across all coaching modalities and meeting formats."}',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        settings = EXCLUDED.settings,
        updated_at = NOW();

    RAISE NOTICE 'Successfully created/updated 9 demo coaches for testing!';
    RAISE NOTICE 'Coaches created with specialties matching session types and different meeting type preferences.';
    RAISE NOTICE 'All coaches are assigned to tenant: %', demo_tenant_id;

END $$;

-- Verify the coaches were created
SELECT 
    p.first_name,
    p.last_name,
    p.email,
    p.role,
    p.settings->>'specialties' as specialties,
    p.settings->>'preferred_meeting_types' as preferred_meeting_types,
    t.name as tenant_name
FROM profiles p
JOIN tenants t ON p.tenant_id = t.id
WHERE p.email LIKE '%@demo.mindshift.com'
ORDER BY p.first_name; 