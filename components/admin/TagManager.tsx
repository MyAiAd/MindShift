'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Loader2, MoreVertical, Edit, Trash2, Merge, Tag as TagIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  id: string;
  name: string;
  slug: string;
  usage_count?: number;
}

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TagManager({ isOpen, onClose }: TagManagerProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tags',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      setCreating(true);
      const response = await fetch('/api/community/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tag created successfully',
        });
        setNewTagName('');
        fetchTags();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create tag',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to create tag',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateTag = async (tag: Tag, newName: string) => {
    if (!newName.trim()) return;

    try {
      const response = await fetch(`/api/community/tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tag updated successfully',
        });
        setEditingTag(null);
        fetchTags();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update tag',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tag',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTag = async () => {
    if (!deletingTag) return;

    try {
      const response = await fetch(`/api/community/tags/${deletingTag.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Tag deleted successfully',
        });
        setDeletingTag(null);
        fetchTags();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to delete tag',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete tag',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Create, edit, and delete tags for community posts
            </DialogDescription>
          </DialogHeader>

          {/* Create New Tag */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create New Tag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateTag()}
                />
                <Button onClick={handleCreateTag} disabled={creating || !newTagName.trim()}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Tags */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Existing Tags ({tags.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TagIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No tags yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{tag.name}</Badge>
                        {tag.usage_count !== undefined && (
                          <span className="text-sm text-muted-foreground">
                            {tag.usage_count} {tag.usage_count === 1 ? 'post' : 'posts'}
                          </span>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingTag(tag)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeletingTag(tag)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      {editingTag && (
        <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tag</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Tag Name</Label>
                <Input
                  id="tag-name"
                  defaultValue={editingTag.name}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateTag(editingTag, e.currentTarget.value);
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTag(null)}>
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  const input = e.currentTarget
                    .closest('.space-y-4')
                    ?.querySelector('input') as HTMLInputElement;
                  if (input) {
                    handleUpdateTag(editingTag, input.value);
                  }
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag <strong>{deletingTag?.name}</strong>?
              {deletingTag?.usage_count && deletingTag.usage_count > 0 && (
                <>
                  <br />
                  <br />
                  This tag is currently used by {deletingTag.usage_count}{' '}
                  {deletingTag.usage_count === 1 ? 'post' : 'posts'}. The tag will be removed
                  from all posts.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
