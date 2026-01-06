'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
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
import { MoreVertical, Pin, PinOff, Edit, Trash2, Loader2 } from 'lucide-react';

interface PostAdminMenuProps {
  postId: string;
  isPinned: boolean;
  isAuthor: boolean;
  isAdmin: boolean;
  onPinToggle: (postId: string, pin: boolean) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
}

export default function PostAdminMenu({
  postId,
  isPinned,
  isAuthor,
  isAdmin,
  onPinToggle,
  onDelete,
}: PostAdminMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'pin' | 'delete' | null>(null);

  const handlePinToggle = async () => {
    try {
      setLoading(true);
      setActionType('pin');
      await onPinToggle(postId, !isPinned);
    } catch (error) {
      console.error('Error toggling pin:', error);
      alert('Failed to update post. Please try again.');
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      setActionType('delete');
      await onDelete(postId);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  // Don't show menu if user has no permissions
  if (!isAuthor && !isAdmin) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* Pin/Unpin - Admin only */}
          {isAdmin && (
            <>
              <DropdownMenuItem
                onClick={handlePinToggle}
                disabled={loading && actionType === 'pin'}
              >
                {isPinned ? (
                  <>
                    <PinOff className="h-4 w-4 mr-2" />
                    Unpin Post
                  </>
                ) : (
                  <>
                    <Pin className="h-4 w-4 mr-2" />
                    Pin Post
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Edit - Author or Admin */}
          {(isAuthor || isAdmin) && (
            <DropdownMenuItem disabled>
              <Edit className="h-4 w-4 mr-2" />
              Edit Post
              <span className="ml-auto text-xs text-muted-foreground">(Soon)</span>
            </DropdownMenuItem>
          )}

          {/* Delete - Author or Admin */}
          {(isAuthor || isAdmin) && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Post
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the post
              and all of its comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading && actionType === 'delete' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

