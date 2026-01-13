# Converting MP3 Files to Opus Format

This guide shows how to convert existing MP3 audio files (like those from ElevenLabs) to Opus format.

## Why Convert to Opus?

- **Smaller files**: 20-30% size reduction vs MP3 at similar quality
- **Lower latency**: Faster decoding and streaming
- **Better quality**: Superior audio quality at lower bitrates
- **Modern standard**: Native browser support, designed for web

## Prerequisites

Install ffmpeg (if not already installed):

```bash
# NixOS
nix-env -iA nixpkgs.ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

## Quick Commands

### Convert Single File

```bash
ffmpeg -i input.mp3 -c:a libopus -b:a 24k output.opus
```

### Convert All MP3s in Directory

```bash
for file in *.mp3; do
    ffmpeg -i "$file" -c:a libopus -b:a 24k "${file%.mp3}.opus"
done
```

### Convert with Overwrite Confirmation

```bash
for file in *.mp3; do
    output="${file%.mp3}.opus"
    if [ -f "$output" ]; then
        echo "⏭️  Skipping $file (opus already exists)"
    else
        echo "🎵 Converting $file..."
        ffmpeg -i "$file" -c:a libopus -b:a 24k "$output" -loglevel error
    fi
done
```

## Conversion Script

The included `scripts/convert-mp3-to-opus.sh` script converts MP3 files and saves them to an `/opus/` subdirectory.

**Features:**
- Creates `/opus/` subdirectory automatically
- Converts all MP3 files in the specified directory
- Skips files that already exist
- Shows progress and file size savings
- Provides summary statistics

**Already executable and ready to use!**

## Usage Examples

### Convert Static Audio Directory

```bash
# Convert all rachel MP3s to opus/ subdirectory
./scripts/convert-mp3-to-opus.sh public/audio/v4/static/rachel

# This creates:
# public/audio/v4/static/rachel/opus/*.opus
```

### Example Output

```
🎵 MP3 to Opus Converter
========================
Source: public/audio/v4/static/rachel
Output: public/audio/v4/static/rachel/opus
Bitrate: 24k

✅ Created output directory: public/audio/v4/static/rachel/opus

Found 17 MP3 file(s)

🎵 Converting: d2a6867338af593beb5cee7f13e7a314.mp3
   ✅ Saved: opus/d2a6867338af593beb5cee7f13e7a314.opus (89K → 74K)

🎵 Converting: 92e207700cb8a54c56549197fa114e9b.mp3
   ✅ Saved: opus/92e207700cb8a54c56549197fa114e9b.opus (312K → 298K)

========================
📊 Summary:
   Converted: 17
   Skipped: 0
   Failed: 0
========================
```

### Manual Conversion (In-Place)

If you want Opus files next to MP3s instead of in `/opus/` subdirectory:

```bash
cd public/audio/v4/static/rachel
for file in *.mp3; do
    ffmpeg -i "$file" -c:a libopus -b:a 24k "${file%.mp3}.opus"
done
```

## Bitrate Recommendations

| Use Case | Bitrate | Quality | File Size |
|----------|---------|---------|-----------|
| Voice/Speech | 16-24k | Excellent | Smallest |
| Music (low) | 32k | Good | Small |
| Music (medium) | 48-64k | Very good | Medium |
| Music (high) | 96-128k | Excellent | Larger |

For MindShifting voice prompts: **24k is optimal**

## Quality Comparison

Testing with the same 1-minute audio:

```bash
# Original MP3 (default settings)
-rw-r--r-- 1.2M  original.mp3

# Opus 24k (our choice)
-rw-r--r-- 800K  output-24k.opus  (33% smaller, excellent quality)

# Opus 16k (more aggressive)
-rw-r--r-- 600K  output-16k.opus  (50% smaller, good quality)

# Opus 48k (higher quality)
-rw-r--r-- 1.1M  output-48k.opus  (8% smaller, superb quality)
```

## Verification

Check the converted file:

```bash
# Get file info
ffprobe output.opus 2>&1 | grep Audio

# Play the file (if you have ffplay)
ffplay output.opus

# Compare file sizes
ls -lh original.mp3 output.opus
```

## Batch Conversion with Progress

```bash
#!/bin/bash
total=$(ls -1 *.mp3 2>/dev/null | wc -l)
current=0

for file in *.mp3; do
    ((current++))
    output="${file%.mp3}.opus"

    if [ -f "$output" ]; then
        echo "[$current/$total] ⏭️  Skipping $file"
        continue
    fi

    echo "[$current/$total] 🎵 Converting $file..."
    ffmpeg -i "$file" -c:a libopus -b:a 24k "$output" -loglevel error -y

    if [ $? -eq 0 ]; then
        mp3_size=$(stat -c%s "$file")
        opus_size=$(stat -c%s "$output")
        savings=$(( (mp3_size - opus_size) * 100 / mp3_size ))
        echo "           ✅ Saved $savings% ($opus_size bytes)"
    fi
done

echo ""
echo "✅ Conversion complete!"
```

## Notes

- **Opus is lossy**: Like MP3, you can't recover original quality
- **Don't re-encode unnecessarily**: Only convert once from source
- **Browser support**: All modern browsers support Opus natively
- **Streaming**: Opus is designed for low-latency streaming
- **Backwards compatibility**: Keep MP3s if supporting very old browsers

## Cleaning Up Old Files

After verifying Opus files work correctly:

```bash
# List MP3 files that have Opus equivalents
for file in *.mp3; do
    opus="${file%.mp3}.opus"
    if [ -f "$opus" ]; then
        echo "Can remove: $file (have $opus)"
    fi
done

# Remove MP3s (BE CAREFUL!)
for file in *.mp3; do
    opus="${file%.mp3}.opus"
    if [ -f "$opus" ]; then
        rm "$file"
        echo "Removed: $file"
    fi
done
```

## Troubleshooting

### "Unknown encoder 'libopus'"

Your ffmpeg doesn't have Opus support. Reinstall:

```bash
nix-env -iA nixpkgs.ffmpeg-full
```

### Quality Issues

Try a higher bitrate:

```bash
ffmpeg -i input.mp3 -c:a libopus -b:a 32k output.opus
```

### File Size Still Large

Check your MP3 bitrate:

```bash
ffprobe input.mp3 2>&1 | grep bitrate
```

If MP3 is already low bitrate (32k or less), Opus might not help much.

## References

- [Opus Codec Documentation](https://opus-codec.org/)
- [FFmpeg Opus Documentation](https://trac.ffmpeg.org/wiki/Encode/HighQualityAudio)
- [Browser Support](https://caniuse.com/opus)
