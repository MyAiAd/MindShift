/**
 * Audio Capture Processor
 * Runs in AudioWorklet thread (separate from main thread)
 * Captures audio samples and sends to main thread for transcription
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // Process in 4096-sample chunks (~256ms at 16kHz)
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Handle mono input
    if (input.length > 0) {
      const inputChannel = input[0];
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        
        // When buffer is full, send to main thread
        if (this.bufferIndex >= this.bufferSize) {
          // Copy buffer to avoid race conditions
          const audioData = new Float32Array(this.buffer);
          this.port.postMessage({ audioData });
          
          // Reset buffer
          this.bufferIndex = 0;
        }
      }
    }
    
    // Return true to keep processor alive
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
