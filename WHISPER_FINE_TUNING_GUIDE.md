# Whisper Fine-Tuning Guide (Option 4)

## Overview

Fine-tuning Whisper on your therapy session audio data can significantly improve transcription accuracy for your specific use case. This guide covers everything you need to fine-tune Whisper locally for free.

---

## Why Fine-Tune Whisper?

**Current Baseline (Distil-Large-v3 out-of-the-box):**
- **8.8% WER** on general audio
- May struggle with:
  - Therapy-specific vocabulary (mental health terms, treatment modalities)
  - Emotional speech patterns (crying, hesitation, soft speaking)
  - Session-specific context (patient names, recurring phrases)
  - Background noise from therapy settings

**Expected Improvement with Fine-Tuning:**
- **3-5% WER** (60-70% reduction in errors)
- Specialized in your exact domain
- Better handling of emotional/varied speech
- Reduced hallucinations on domain-specific content

---

## Prerequisites

### Hardware Requirements

**Minimum (Training will be slow):**
- CPU: 8+ cores
- RAM: 32GB
- Storage: 50GB free
- GPU: None required (CPU training possible)
- Time: 24-48 hours for small dataset

**Recommended (Practical training):**
- CPU: 16+ cores
- RAM: 64GB
- Storage: 100GB free
- GPU: NVIDIA GPU with 8GB+ VRAM (GTX 1070, RTX 2060+, or better)
- CUDA: 11.8 or 12.x
- Time: 4-12 hours for small dataset

**Your Hetzner Server Status:**
- Check GPU availability: `nvidia-smi`
- If you have a GPU, training will be 10-20x faster
- CPU-only training is feasible for small models (base/small)

---

## Step 1: Data Collection

### What You Need

**Minimum Dataset Size:**
- **10-20 hours** of transcribed therapy audio (minimum for meaningful improvement)
- **50-100 hours** (recommended for robust model)
- **100+ hours** (ideal for production-quality results)

**Data Format:**
```
dataset/
├── audio/
│   ├── session_001.wav
│   ├── session_002.wav
│   └── ...
└── transcripts/
    ├── session_001.txt
    ├── session_002.txt
    └── ...
```

### Data Sources

**1. Your Existing Sessions (Best Option)**
- Use past therapy sessions you've recorded
- Manually transcribe them (time-intensive but highest quality)
- Use current Whisper for initial transcription, then correct manually
- Focus on diverse speakers, emotions, and contexts

**2. Synthetic Therapy Data (Supplement)**
- Use Claude or GPT-4 to generate realistic therapy dialogues
- Use ElevenLabs/Bark to generate audio from scripts
- Less ideal than real data, but useful for augmentation
- **Limitation:** May not capture real emotional speech patterns

**3. Public Mental Health Datasets (Bootstrap)**
- **Counseling and Psychotherapy Transcripts** (Alexander Street Press)
- **DAIC-WOZ Database** (distress assessment interviews)
- **Limitation:** Legal/ethical constraints on use

### Data Quality Guidelines

**Audio Requirements:**
- **Format:** WAV, 16kHz, mono
- **Duration:** 1-30 seconds per clip (split long sessions)
- **Quality:** Clean audio, minimal background noise
- **Speech:** Natural therapy conversations (not scripted)

**Transcript Requirements:**
- **Accuracy:** 95%+ correct (errors propagate to model)
- **Format:** Plain text, lowercase, minimal punctuation
- **Alignment:** Must match audio exactly (no extra/missing words)
- **Normalization:** Expand abbreviations, spell out numbers

**Example Good Transcript:**
```
i've been feeling really anxious lately especially in social situations
```

**Example Bad Transcript:**
```
I've been feeling really anxious lately. Especially in social situations!!!
```

---

## Step 2: Data Preparation

### Install Required Tools

```bash
# Create virtual environment
cd ~/Code/MindShifting
python3 -m venv fine-tune-env
source fine-tune-env/bin/activate

# Install Hugging Face Transformers + Audio tools
pip install transformers==4.36.0
pip install datasets==2.16.0
pip install accelerate==0.26.0
pip install soundfile==0.12.1
pip install librosa==0.10.1
pip install evaluate==0.4.1
pip install jiwer==3.0.3  # For WER calculation

# For GPU training (if available)
pip install torch==2.1.0 torchaudio==2.1.0 --index-url https://download.pytorch.org/whl/cu118
```

### Prepare Dataset Script

Create `prepare_dataset.py`:

```python
#!/usr/bin/env python3
"""
Prepare Whisper fine-tuning dataset from audio files and transcripts.
"""

import os
import json
from pathlib import Path
from datasets import Dataset, Audio
import soundfile as sf

def create_dataset(audio_dir: str, transcript_dir: str, output_dir: str):
    """
    Create Hugging Face dataset from audio files and transcripts.
    
    Args:
        audio_dir: Directory containing WAV files
        transcript_dir: Directory containing matching TXT transcripts
        output_dir: Where to save the prepared dataset
    """
    
    data = []
    audio_files = sorted(Path(audio_dir).glob("*.wav"))
    
    for audio_path in audio_files:
        # Find matching transcript
        transcript_path = Path(transcript_dir) / f"{audio_path.stem}.txt"
        
        if not transcript_path.exists():
            print(f"⚠️  Missing transcript for {audio_path.name}, skipping")
            continue
        
        # Read transcript
        with open(transcript_path, 'r', encoding='utf-8') as f:
            transcript = f.read().strip()
        
        # Validate audio
        try:
            audio_data, sample_rate = sf.read(audio_path)
            duration = len(audio_data) / sample_rate
            
            # Skip clips that are too short or too long
            if duration < 0.5 or duration > 30:
                print(f"⚠️  Audio {audio_path.name} is {duration:.1f}s, skipping (must be 0.5-30s)")
                continue
            
            data.append({
                "audio": str(audio_path),
                "text": transcript,
                "duration": duration
            })
            print(f"✓ Added {audio_path.name} ({duration:.1f}s): {transcript[:50]}...")
        
        except Exception as e:
            print(f"❌ Error processing {audio_path.name}: {e}")
            continue
    
    # Create Hugging Face dataset
    dataset = Dataset.from_list(data)
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))
    
    # Split into train/validation (90/10 split)
    split_dataset = dataset.train_test_split(test_size=0.1, seed=42)
    
    # Save to disk
    split_dataset.save_to_disk(output_dir)
    
    print(f"\n✅ Dataset created successfully!")
    print(f"   Training samples: {len(split_dataset['train'])}")
    print(f"   Validation samples: {len(split_dataset['test'])}")
    print(f"   Total duration: {sum(d['duration'] for d in data) / 3600:.1f} hours")
    print(f"   Saved to: {output_dir}")

if __name__ == "__main__":
    create_dataset(
        audio_dir="./dataset/audio",
        transcript_dir="./dataset/transcripts",
        output_dir="./dataset/prepared"
    )
```

### Run Preparation

```bash
# Make script executable
chmod +x prepare_dataset.py

# Prepare your dataset
./prepare_dataset.py
```

---

## Step 3: Fine-Tuning

### Fine-Tuning Script

Create `fine_tune_whisper.py`:

```python
#!/usr/bin/env python3
"""
Fine-tune Whisper model on custom therapy audio dataset.
"""

import torch
from transformers import (
    WhisperProcessor,
    WhisperForConditionalGeneration,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
)
from datasets import load_from_disk
import evaluate

# Configuration
MODEL_NAME = "openai/whisper-small"  # Start with small for faster training
OUTPUT_DIR = "./whisper-therapy-finetuned"
DATASET_DIR = "./dataset/prepared"
LANGUAGE = "en"

# Check GPU availability
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🔧 Using device: {device}")

# Load model and processor
print(f"📥 Loading model: {MODEL_NAME}")
processor = WhisperProcessor.from_pretrained(MODEL_NAME)
model = WhisperForConditionalGeneration.from_pretrained(MODEL_NAME)
model.to(device)

# Load dataset
print(f"📂 Loading dataset from {DATASET_DIR}")
dataset = load_from_disk(DATASET_DIR)

# Preprocessing function
def prepare_dataset(batch):
    """Convert audio to input features and tokenize transcripts."""
    audio = batch["audio"]
    
    # Compute log-Mel input features
    batch["input_features"] = processor(
        audio["array"],
        sampling_rate=audio["sampling_rate"],
        return_tensors="pt"
    ).input_features[0]
    
    # Tokenize transcripts
    batch["labels"] = processor.tokenizer(batch["text"]).input_ids
    
    return batch

# Prepare datasets
print("🔄 Preprocessing dataset...")
dataset = dataset.map(prepare_dataset, remove_columns=dataset["train"].column_names)

# Training arguments
training_args = Seq2SeqTrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=8 if device == "cuda" else 2,  # Smaller batch for CPU
    gradient_accumulation_steps=2,  # Effective batch size = 16 (GPU) or 4 (CPU)
    learning_rate=1e-5,
    num_train_epochs=5,
    warmup_steps=500,
    eval_strategy="steps",
    eval_steps=500,
    save_steps=500,
    save_total_limit=2,
    logging_steps=100,
    predict_with_generate=True,
    generation_max_length=225,
    fp16=device == "cuda",  # Mixed precision on GPU only
    dataloader_num_workers=4 if device == "cuda" else 0,
    load_best_model_at_end=True,
    metric_for_best_model="wer",
    greater_is_better=False,
    report_to=["tensorboard"],
)

# Evaluation metric (Word Error Rate)
metric = evaluate.load("wer")

def compute_metrics(pred):
    """Calculate WER on validation set."""
    pred_ids = pred.predictions
    label_ids = pred.label_ids
    
    # Replace -100 with pad token id
    label_ids[label_ids == -100] = processor.tokenizer.pad_token_id
    
    # Decode predictions and references
    pred_str = processor.batch_decode(pred_ids, skip_special_tokens=True)
    label_str = processor.batch_decode(label_ids, skip_special_tokens=True)
    
    # Compute WER
    wer = metric.compute(predictions=pred_str, references=label_str)
    
    return {"wer": wer}

# Initialize trainer
trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    tokenizer=processor.feature_extractor,
    compute_metrics=compute_metrics,
)

# Train!
print(f"🚀 Starting fine-tuning...")
print(f"   Training samples: {len(dataset['train'])}")
print(f"   Validation samples: {len(dataset['test'])}")
print(f"   Epochs: {training_args.num_train_epochs}")
print(f"   Device: {device}")

trainer.train()

# Save final model
print(f"💾 Saving fine-tuned model to {OUTPUT_DIR}")
trainer.save_model(OUTPUT_DIR)
processor.save_pretrained(OUTPUT_DIR)

print("✅ Fine-tuning complete!")
```

### Run Fine-Tuning

```bash
# Make script executable
chmod +x fine_tune_whisper.py

# Start training (this will take several hours)
./fine_tune_whisper.py
```

**Expected Training Times:**
- **GPU (RTX 3060, 10 hours of data):** 4-6 hours
- **CPU (16 cores, 10 hours of data):** 24-36 hours

---

## Step 4: Convert to Faster-Whisper Format

Your production service uses `faster-whisper` (CTranslate2), not Hugging Face Transformers. Convert the fine-tuned model:

```bash
# Install CTranslate2 converter
pip install ctranslate2==3.24.0

# Convert model
ct2-transformers-converter \
    --model ./whisper-therapy-finetuned \
    --output_dir ./whisper-therapy-ct2 \
    --quantization float16

# Result: ./whisper-therapy-ct2/ (ready for faster-whisper)
```

---

## Step 5: Deploy Fine-Tuned Model

### Update Whisper Service

Edit `whisper-service/app/config.py`:

```python
class Settings(BaseSettings):
    # Model Configuration
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "/app/models/whisper-therapy-ct2")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "float16")
```

### Copy Model to Server

```bash
# On your local machine
scp -r ./whisper-therapy-ct2 user@your-hetzner-server:~/Code/MindShifting/whisper-service/models/

# On Hetzner server
cd ~/Code/MindShifting/whisper-service
mkdir -p models
mv ~/whisper-therapy-ct2 ./models/

# Update environment
echo "WHISPER_MODEL=/app/models/whisper-therapy-ct2" >> ../.env.local
```

### Rebuild and Deploy

```bash
# On Hetzner
cd ~/Code/MindShifting
docker-compose down
docker-compose build whisper-service
docker-compose up -d

# Verify
curl -X POST http://localhost:8000/v1/audio/transcriptions \
  -F "file=@test_audio.wav"
```

---

## Step 6: Evaluation

### Measure Improvement

Create `evaluate_model.py`:

```python
#!/usr/bin/env python3
"""Evaluate fine-tuned model on test set."""

import requests
from pathlib import Path
from jiwer import wer
from datasets import load_from_disk

WHISPER_URL = "http://localhost:8000/v1/audio/transcriptions"
DATASET_DIR = "./dataset/prepared"

# Load test set
dataset = load_from_disk(DATASET_DIR)
test_data = dataset["test"]

predictions = []
references = []

for i, sample in enumerate(test_data):
    # Transcribe with fine-tuned model
    with open(sample["audio"]["path"], "rb") as f:
        response = requests.post(WHISPER_URL, files={"file": f})
        pred_text = response.json()["text"]
    
    predictions.append(pred_text)
    references.append(sample["text"])
    
    print(f"[{i+1}/{len(test_data)}] WER: {wer(sample['text'], pred_text):.2%}")

# Overall WER
overall_wer = wer(references, predictions)
print(f"\n📊 Overall WER: {overall_wer:.2%}")
```

**Expected Results:**
- **Before fine-tuning (distil-large-v3):** 8-12% WER on your data
- **After fine-tuning:** 3-6% WER on your data

---

## Cost-Benefit Analysis

### Time Investment

| Task | Time Required |
|------|---------------|
| Data collection/transcription | 20-100 hours |
| Dataset preparation | 2-4 hours |
| Fine-tuning (GPU) | 4-12 hours |
| Fine-tuning (CPU) | 24-48 hours |
| Evaluation/iteration | 2-4 hours |
| **Total** | **30-170 hours** |

### Benefits

✅ **Accuracy:** 50-70% reduction in transcription errors
✅ **Domain-specific:** Handles therapy vocabulary perfectly
✅ **Emotional speech:** Better with crying, hesitation, soft voices
✅ **No API costs:** Fully local and free forever
✅ **Privacy:** No audio leaves your server

### Limitations

⚠️ **Time-intensive:** Requires significant upfront effort
⚠️ **Data requirements:** Need 10-100 hours of transcribed audio
⚠️ **Maintenance:** Need to retrain if domain shifts
⚠️ **Overfitting risk:** May perform worse on out-of-domain audio

---

## Recommendations

### When to Fine-Tune

**Fine-tune NOW if:**
- ✅ You have 10+ hours of therapy audio to transcribe
- ✅ You plan to use this long-term (worth the investment)
- ✅ Domain-specific vocabulary is critical
- ✅ You have time for manual transcription/correction

**Wait and use distil-large-v3 if:**
- ❌ You need results immediately (fine-tuning takes weeks)
- ❌ You have <5 hours of training data
- ❌ distil-large-v3 is already "good enough" (8.8% WER)
- ❌ You can't dedicate time to data preparation

### Recommended Path

**Phase 1: Quick Win (Now) ✓**
- ✅ Deploy distil-large-v3 + Option 5 preprocessing
- ✅ Collect session audio over next 2-3 months
- ✅ Manually correct transcriptions (create training data)

**Phase 2: Fine-Tuning (In 2-3 months)**
- Train on 20-50 hours of real therapy data
- Evaluate improvement (expect 5-7% WER)
- Deploy if significantly better

**Phase 3: Continuous Improvement**
- Collect more data over time
- Retrain periodically (quarterly)
- Maintain accuracy as vocabulary evolves

---

## Alternative: Few-Shot Fine-Tuning

If you don't have 10+ hours of data, consider **few-shot fine-tuning** with just 1-2 hours:

**Pros:**
- Requires minimal data (1-2 hours)
- Fast to train (1-2 hours on GPU)
- Can capture key vocabulary/phrases

**Cons:**
- Smaller improvement (20-30% error reduction vs 50-70%)
- Risk of overfitting to small dataset
- Less robust to domain variations

**Implementation:**
- Use same process above, but with:
  - `num_train_epochs=10` (more epochs for small dataset)
  - `learning_rate=5e-6` (lower learning rate to prevent overfitting)
  - Focus on high-error examples from your sessions

---

## Troubleshooting

### Common Issues

**1. Out of Memory (GPU)**
```bash
# Reduce batch size in fine_tune_whisper.py
per_device_train_batch_size=4  # Instead of 8
gradient_accumulation_steps=4  # Instead of 2
```

**2. Out of Memory (CPU)**
```bash
# Use smaller model
MODEL_NAME = "openai/whisper-tiny"  # Instead of small
per_device_train_batch_size=1
```

**3. Poor Validation WER**
- Check transcript quality (95%+ accuracy required)
- Ensure audio-text alignment is perfect
- Increase training data (may be overfitting)
- Try different learning rates (1e-6 to 5e-5)

**4. Model Not Loading in Faster-Whisper**
```bash
# Verify conversion worked
ls -la ./whisper-therapy-ct2/
# Should contain: model.bin, config.json, vocabulary.txt

# Check faster-whisper compatibility
python -c "from faster_whisper import WhisperModel; model = WhisperModel('./whisper-therapy-ct2')"
```

---

## Summary

Fine-tuning Whisper is the **ultimate solution** for maximizing accuracy, but requires significant time investment. 

**Current recommendation:**
1. **Deploy distil-large-v3 + Option 5 NOW** (immediate 50% improvement)
2. **Collect training data passively** over next 2-3 months
3. **Fine-tune when you have 20+ hours** of transcribed therapy audio
4. **Expect 5-7% WER** after fine-tuning (vs 8.8% now)

This gives you excellent accuracy *now*, while building toward perfection *later*.

---

**Questions? Next Steps:**
- Want help preparing a pilot fine-tuning dataset?
- Need assistance setting up GPU training?
- Want to explore few-shot fine-tuning first?

Let me know how you'd like to proceed!
