export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    // 16-bit PCM
    const val = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, val < 0 ? val * 0x8000 : val * 0x7fff, true); // Little endian
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Global time for gapless playback
let nextStartTime = 0;

export function playAudioChunk(audioCtx: AudioContext, base64Audio: string) {
  const binaryString = atob(base64Audio);
  const length = binaryString.length;
  
  // 16-bit PCM (2 bytes per sample) -> length / 2
  const float32Data = new Float32Array(length / 2);
  
  for (let i = 0; i < float32Data.length; i++) {
    const lsb = binaryString.charCodeAt(i * 2);
    const msb = binaryString.charCodeAt(i * 2 + 1);
    
    // Combine 2 bytes into 16 bit integer
    const int16 = ((msb << 8) | lsb) << 16 >> 16;
    float32Data[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
  }

  const audioBuffer = audioCtx.createBuffer(1, float32Data.length, 24000); // 24kHz sample rate usually returned by Google Live API Audio
  audioBuffer.copyToChannel(float32Data, 0);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  
  if (nextStartTime < audioCtx.currentTime) {
      nextStartTime = audioCtx.currentTime;
  }
  
  source.start(nextStartTime);
  nextStartTime += audioBuffer.duration;
  
  return source;
}

export function resetAudioSchedule() {
   nextStartTime = 0;
}
