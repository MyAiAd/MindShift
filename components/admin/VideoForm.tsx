'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus, Eye, AlertCircle } from 'lucide-react';

interface VideoFormData {
  title: string;
  description: string;
  video_url: string;
  thumbnail_url?: string;
  duration_text?: string;
  provider: 'youtube' | 'vimeo' | 'wistia' | 'custom';
  provider_video_id?: string;
  category_id?: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  tags: string[];
  required_subscription_tier?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface VideoFormProps {
  initialData?: Partial<VideoFormData>;
  onSubmit: (data: VideoFormData) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

export default function VideoForm({ initialData, onSubmit, onCancel, mode }: VideoFormProps) {
  const [formData, setFormData] = useState<VideoFormData>({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    duration_text: '',
    provider: 'youtube',
    provider_video_id: '',
    category_id: undefined,
    status: 'draft',
    is_featured: false,
    tags: [],
    required_subscription_tier: null,
    ...initialData,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Auto-detect provider from URL
  useEffect(() => {
    if (formData.video_url) {
      detectProvider(formData.video_url);
    }
  }, [formData.video_url]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/tutorials/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const detectProvider = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setFormData(prev => ({ ...prev, provider: 'youtube' }));
      // Extract video ID
      const match = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([^&\?\/]+)/);
      if (match) {
        setFormData(prev => ({ ...prev, provider_video_id: match[1] }));
      }
    } else if (url.includes('vimeo.com')) {
      setFormData(prev => ({ ...prev, provider: 'vimeo' }));
      const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (match) {
        setFormData(prev => ({ ...prev, provider_video_id: match[1] }));
      }
    } else if (url.includes('wistia.')) {
      setFormData(prev => ({ ...prev, provider: 'wistia' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.video_url.trim()) {
      newErrors.video_url = 'Video URL is required';
    } else if (!isValidUrl(formData.video_url)) {
      newErrors.video_url = 'Please enter a valid URL';
    }

    if (formData.provider === 'youtube' && !formData.video_url.includes('embed')) {
      newErrors.video_url = 'YouTube URL must be embed format (e.g., https://www.youtube.com/embed/VIDEO_ID)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleChange = (field: keyof VideoFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            {mode === 'create' ? 'Add a new tutorial video' : 'Edit video details'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., Welcome to Mind-Shifting"
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what viewers will learn..."
              rows={4}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration_text">Duration (e.g., "8:45")</Label>
            <Input
              id="duration_text"
              value={formData.duration_text || ''}
              onChange={(e) => handleChange('duration_text', e.target.value)}
              placeholder="8:45"
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Video URL & Provider */}
      <Card>
        <CardHeader>
          <CardTitle>Video Source</CardTitle>
          <CardDescription>Paste the embed URL from your video platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video URL */}
          <div className="space-y-2">
            <Label htmlFor="video_url">
              Video URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="video_url"
              value={formData.video_url}
              onChange={(e) => handleChange('video_url', e.target.value)}
              placeholder="https://www.youtube.com/embed/VIDEO_ID"
              className={errors.video_url ? 'border-destructive' : ''}
            />
            {errors.video_url && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.video_url}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              For YouTube: Use embed format (https://www.youtube.com/embed/VIDEO_ID)
            </p>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Video Provider</Label>
            <Select
              value={formData.provider}
              onValueChange={(value: any) => handleChange('provider', value)}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
                <SelectItem value="wistia">Wistia</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview Button */}
          {formData.video_url && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          )}

          {/* Video Preview */}
          {showPreview && formData.video_url && (
            <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
              <iframe
                src={formData.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Video preview"
              />
            </div>
          )}

          {/* Thumbnail URL */}
          <div className="space-y-2">
            <Label htmlFor="thumbnail_url">Thumbnail URL (optional)</Label>
            <Input
              id="thumbnail_url"
              value={formData.thumbnail_url || ''}
              onChange={(e) => handleChange('thumbnail_url', e.target.value)}
              placeholder="https://example.com/thumbnail.jpg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Categorize and tag your video</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(value) => handleChange('category_id', value === 'none' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
              />
              <Button type="button" onClick={handleAddTag} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure visibility and access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: any) => handleChange('status', value)}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Featured Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Featured Video</Label>
              <p className="text-sm text-muted-foreground">
                Show this video prominently on the tutorials page
              </p>
            </div>
            <Switch
              checked={formData.is_featured}
              onCheckedChange={(checked) => handleChange('is_featured', checked)}
            />
          </div>

          {/* Subscription Tier */}
          <div className="space-y-2">
            <Label htmlFor="subscription_tier">Required Subscription Tier</Label>
            <Select
              value={formData.required_subscription_tier || 'none'}
              onValueChange={(value) =>
                handleChange('required_subscription_tier', value === 'none' ? null : value)
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All users</SelectItem>
                <SelectItem value="trial">Trial and above</SelectItem>
                <SelectItem value="level_1">Level 1 and above</SelectItem>
                <SelectItem value="level_2">Level 2 and above</SelectItem>
                <SelectItem value="level_3">Level 3 only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Restrict access to specific subscription tiers
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create Video' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
