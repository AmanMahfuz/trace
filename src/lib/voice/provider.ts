export interface VoiceProvider {
  startListening(onPartial: (text: string) => void, onFinal: (text: string) => void): void;
  stopListening(): void;
  speak(text: string): Promise<void>;
  isSupported(): boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface WebkitSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  start: () => void;
  stop: () => void;
}

export class BrowserVoiceProvider implements VoiceProvider {
  private recognition: WebkitSpeechRecognition | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const windowWithSpeech = window as unknown as {
        SpeechRecognition?: new () => WebkitSpeechRecognition;
        webkitSpeechRecognition?: new () => WebkitSpeechRecognition;
      };

      const SpeechRecognition =
        windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
      }
    }
  }

  isSupported(): boolean {
    return this.recognition !== null && typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  startListening(onPartial: (text: string) => void, onFinal: (text: string) => void): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          onFinal(event.results[i][0].transcript);
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (interim) onPartial(interim);
    };

    try {
      this.recognition.start();
    } catch {
      // In case start was already called
    }
  }

  stopListening(): void {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      // Ignore if not running
    }
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }
}

export class DeepgramCartesiaProvider implements VoiceProvider {
  startListening(): void {
    throw new Error('DeepgramCartesiaProvider not implemented in MVP');
  }
  stopListening(): void {
    throw new Error('DeepgramCartesiaProvider not implemented in MVP');
  }
  speak(): Promise<void> {
    throw new Error('DeepgramCartesiaProvider not implemented in MVP');
  }
  isSupported(): boolean {
    return false;
  }
}
