import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

// GET /api/community/tags/[id] - Get a specific tag with posts count
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const tagId = params.id;

    // Fetch tag with creator information
    const { data: tag, error } = await supabase
      .from('community_tags')
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .eq('id', tagId)
      .single();

    if (error || !tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ tag });
  } catch (error) {
    console.error('Error fetching tag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/community/tags/[id] - Update a specific tag
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('PUT /api/community/tags/[id] - Request received', { tagId: params.id });
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('User authenticated:', { userId: user?.id, hasError: !!authError });
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('Profile fetched:', { 
      hasProfile: !!profile, 
      tenantId: profile?.tenant_id, 
      role: profile?.role 
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const tagId = params.id;
    const body = await request.json();
    const { name, description, color } = body;
    console.log('Update request body:', { name, description, color });

    // Get existing tag to verify ownership/permissions
    const { data: existingTag, error: fetchError } = await supabase
      .from('community_tags')
      .select('*')
      .eq('id', tagId)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check permissions - only tenant admins or the creator can edit tags
    const canEdit = ['tenant_admin', 'super_admin'].includes(profile.role) ||
                   existingTag.created_by === user.id;

    if (!canEdit) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build update data
    const updateData: any = {};
    
    if (name !== undefined) {
      const tagName = name.trim().toLowerCase();
      
      // Validate tag name format
      if (!/^[a-z0-9\s\-_]+$/i.test(tagName)) {
        return NextResponse.json(
          { error: 'Tag name can only contain letters, numbers, spaces, hyphens, and underscores' },
          { status: 400 }
        );
      }

      if (tagName.length > 50) {
        return NextResponse.json(
          { error: 'Tag name must be 50 characters or less' },
          { status: 400 }
        );
      }

      // Check if new name conflicts with existing tag (excluding current tag)
      if (tagName !== existingTag.name) {
        // Use the existing tag's tenant_id for the conflict check
        // (This handles super_admin users who may have NULL tenant_id in profile)
        const { data: conflictingTag } = await supabase
          .from('community_tags')
          .select('id')
          .eq('tenant_id', existingTag.tenant_id)
          .eq('name', tagName)
          .neq('id', tagId)
          .single();

        console.log('Duplicate check:', { 
          conflictingTag: !!conflictingTag, 
          existingTenantId: existingTag.tenant_id,
          newName: tagName 
        });

        if (conflictingTag) {
          return NextResponse.json(
            { error: 'A tag with this name already exists' },
            { status: 409 }
          );
        }
      }

      updateData.name = tagName;
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (color !== undefined) {
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        return NextResponse.json(
          { error: 'Color must be in hex format (#RRGGBB)' },
          { status: 400 }
        );
      }
      updateData.color = color || null;
    }

    // Update tag
    console.log('Updating tag with data:', { tagId, updateData });
    const { data: updatedTag, error: updateError } = await supabase
      .from('community_tags')
      .update(updateData)
      .eq('id', tagId)
      .select(`
        *,
        creator:profiles!created_by(id, first_name, last_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Error updating tag:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update tag', details: updateError },
        { status: 500 }
      );
    }

    console.log('Tag updated successfully:', { tagId, newName: updatedTag?.name });
    return NextResponse.json({ tag: updatedTag });
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/community/tags/[id] - Delete a specific tag
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const tagId = params.id;

    // Get existing tag to verify ownership/permissions
    const { data: existingTag, error: fetchError } = await supabase
      .from('community_tags')
      .select('*')
      .eq('id', tagId)
      .single();

    if (fetchError || !existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check permissions - only tenant admins can delete tags (to prevent accidental deletions)
    const canDelete = ['tenant_admin', 'super_admin'].includes(profile.role);

    if (!canDelete) {
      return NextResponse.json({ 
        error: 'Only tenant administrators can delete tags' 
      }, { status: 403 });
    }

    // Check if tag is currently in use
    const { data: tagUsage, error: usageError } = await supabase
      .from('community_post_tags')
      .select('post_id')
      .eq('tag_id', tagId)
      .limit(1);

    if (usageError) {
      console.error('Error checking tag usage:', usageError);
      return NextResponse.json(
        { error: 'Failed to verify tag usage' },
        { status: 500 }
      );
    }

    if (tagUsage && tagUsage.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete tag that is currently in use. Remove it from all posts first.'
      }, { status: 409 });
    }

    // Delete tag
    const { error: deleteError } = await supabase
      .from('community_tags')
      .delete()
      .eq('id', tagId);

    if (deleteError) {
      console.error('Error deleting tag:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 