#!/bin/bash

# Convert MP3 files to Opus format
# Usage: ./scripts/convert-mp3-to-opus.sh [directory]
# Output files will be saved to [directory]/opus/

DIR="${1:-.}"
BITRATE="24k"  # Good quality for speech
OPUS_DIR="${DIR}/opus"

echo "🎵 MP3 to Opus Converter"
echo "========================"
echo "Source: $DIR"
echo "Output: $OPUS_DIR"
echo "Bitrate: $BITRATE"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: ffmpeg is not installed"
    echo "   Install it with: nix-env -iA nixpkgs.ffmpeg"
    exit 1
fi

# Create opus subdirectory
mkdir -p "$OPUS_DIR"
echo "✅ Created output directory: $OPUS_DIR"
echo ""

# Find all MP3 files
mp3_files=($(find "$DIR" -maxdepth 1 -name "*.mp3" -type f))

if [ ${#mp3_files[@]} -eq 0 ]; then
    echo "❌ No MP3 files found in $DIR"
    exit 1
fi

echo "Found ${#mp3_files[@]} MP3 file(s)"
echo ""

converted=0
skipped=0
failed=0

for file in "${mp3_files[@]}"; do
    filename=$(basename "$file")
    output="$OPUS_DIR/${filename%.mp3}.opus"

    if [ -f "$output" ]; then
        echo "⏭️  Skipping: $filename (already exists)"
        ((skipped++))
        continue
    fi

    echo "🎵 Converting: $filename"

    if ffmpeg -i "$file" -c:a libopus -b:a "$BITRATE" "$output" -loglevel error -y; then
        # Get file sizes
        mp3_size=$(du -h "$file" | cut -f1)
        opus_size=$(du -h "$output" | cut -f1)
        echo "   ✅ Saved: opus/$(basename "$output") ($mp3_size → $opus_size)"
        ((converted++))
    else
        echo "   ❌ Failed to convert $filename"
        ((failed++))
    fi
    echo ""
done

echo "========================"
echo "📊 Summary:"
echo "   Converted: $converted"
echo "   Skipped: $skipped"
echo "   Failed: $failed"
echo "========================"

if [ $converted -gt 0 ]; then
    echo ""
    echo "✅ Conversion complete!"
    echo ""
    echo "📁 Opus files saved to: $OPUS_DIR"
    echo ""
    echo "Next steps:"
    echo "   1. Test the Opus files to ensure quality is acceptable"
    echo "   2. Update your code to reference opus/*.opus files"
    echo "   3. Consider removing old .mp3 files after verification"
fi
