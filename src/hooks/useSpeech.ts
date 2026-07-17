
import { useState, useCallback, useEffect, useRef } from 'react';

interface UseSpeechOptions {
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  language?: string;
}

export function useSpeech({ onResult, onEnd, onError, language = 'en-US' }: UseSpeechOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(window.speechSynthesis);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // We want it to stop after one sentence for better control
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          onResult?.(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event.error);
        setIsListening(false);
        onError?.(event);
      };

      recognition.onend = () => {
        setIsListening(false);
        onEnd?.();
      };

      recognitionRef.current = recognition;
    }
  }, [onResult, onEnd, onError, language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Recognition start error:', e);
      }
    }
  }, [isListening, isSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speakIdRef = useRef<number>(0);

  const speak = useCallback(async (text: string) => {
    const currentSpeakId = Date.now();
    speakIdRef.current = currentSpeakId;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Abort any ongoing network request for TTS
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    synthesisRef.current?.cancel();
    setIsSpeaking(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abortController.signal
      });

      // If another speak request was initiated while we were waiting, discard this one
      if (speakIdRef.current !== currentSpeakId) return;

      if (response.ok) {
        const blob = await response.blob();
        if (speakIdRef.current !== currentSpeakId) return; // Second check after blob reading

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.onended = () => {
          if (speakIdRef.current === currentSpeakId) {
            setIsSpeaking(false);
          }
          URL.revokeObjectURL(url);
        };
        
        await audio.play();
        return; // Success, skip fallback
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        // The network request was aborted intentionally because a new TTS call came in.
        return; 
      }
      console.error("Network TTS failed, falling back to browser TTS", e);
    }

    if (speakIdRef.current !== currentSpeakId) return;

    if (!synthesisRef.current) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.pitch = 1.2;
    utterance.rate = 1.1;

    // Try to find a good female voice (e.g. Google UK English Female, or similar)
    const voices = synthesisRef.current.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Victoria') || v.name.includes('Karen') || (v.lang.startsWith('en') && v.name.includes('Zira')));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => {
      if (speakIdRef.current === currentSpeakId) setIsSpeaking(false);
    };
    
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      if (speakIdRef.current === currentSpeakId) setIsSpeaking(false);
    }
    
    synthesisRef.current.speak(utterance);
  }, [language]);

  const cancelSpeech = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    hasSupport: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  };
}
