'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  selectedTags: string[]; // Array of tag IDs
  onChange: (tagIds: string[]) => void;
  maxTags?: number;
}

export default function TagSelector({ selectedTags, onChange, maxTags = 5 }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch available tags
  useEffect(() => {
    fetchTags();
  }, []);

  // Filter tags based on search
  useEffect(() => {
    if (searchQuery) {
      setFilteredTags(
        tags.filter(tag =>
          tag.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredTags(tags);
    }
  }, [searchQuery, tags]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/tags?sort_by=use_count&limit=100');
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onChange(selectedTags.filter(id => id !== tagId));
    } else if (selectedTags.length < maxTags) {
      onChange([...selectedTags, tagId]);
    }
  };

  const createNewTag = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch('/api/community/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: searchQuery.trim(),
          color: '#6366f1', // Default indigo color
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTags([...tags, data.tag]);
        onChange([...selectedTags, data.tag.id]);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const selectedTagObjects = tags.filter(tag => selectedTags.includes(tag.id));

  return (
    <div className="relative">
      {/* Selected Tags Display */}
      <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
        {selectedTagObjects.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
            }}
          >
            {tag.name}
            <button
              onClick={() => toggleTag(tag.id)}
              className="hover:bg-black/10 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Tag Input/Dropdown */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search or add tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            className="pl-10"
          />
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Loading tags...</div>
              ) : filteredTags.length === 0 ? (
                <div className="p-4">
                  <p className="text-muted-foreground text-sm mb-2">No tags found</p>
                  {searchQuery && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={createNewTag}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create &quot;{searchQuery}&quot;
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-2">
                  {filteredTags.map(tag => {
                    const isSelected = selectedTags.includes(tag.id);
                    const isMaxed = selectedTags.length >= maxTags && !isSelected;
                    
                    return (
                      <button
                        key={tag.id}
                        onClick={() => !isMaxed && toggleTag(tag.id)}
                        disabled={isMaxed}
                        className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-accent ${
                          isMaxed ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span
                          className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedTags.length >= maxTags && (
        <p className="text-xs text-muted-foreground mt-1">
          Maximum {maxTags} tags per post
        </p>
      )}
    </div>
  );
}

