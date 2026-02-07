import { useState, useCallback, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export type StoryPhase = 'idle' | 'commit' | 'reveal' | 'deepen' | 'complete' | 'error';

interface StreamState {
  phase: StoryPhase;
  commitId: string | null;
  revealText: string;
  isStreaming: boolean;
  error: string | null;
}

interface UseStoryStreamOptions {
  campaignId: number;
  onComplete?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useStoryStream({ campaignId, onComplete, onError }: UseStoryStreamOptions) {
  const [state, setState] = useState<StreamState>({
    phase: 'idle',
    commitId: null,
    revealText: '',
    isStreaming: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const advanceStoryStream = useCallback(async (choice: string, rollResult?: any, currentLocation?: string, storyState?: any, campaignTitle?: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      phase: 'commit',
      commitId: null,
      revealText: '',
      isStreaming: true,
      error: null,
    });

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/advance-story-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          choice,
          rollResult,
          currentLocation,
          storyState,
          campaignTitle
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No readable stream available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.substring(6));

              switch (currentEvent) {
                case 'commit':
                  setState(prev => ({
                    ...prev,
                    phase: 'commit',
                    commitId: data.commitId,
                  }));
                  break;

                case 'reveal':
                  setState(prev => ({
                    ...prev,
                    phase: 'reveal',
                    revealText: data.revealText || '',
                  }));
                  break;

                case 'deepen_start':
                  setState(prev => ({
                    ...prev,
                    phase: 'deepen',
                  }));
                  break;

                case 'deepen':
                  setState(prev => ({
                    ...prev,
                    phase: 'complete',
                    isStreaming: false,
                  }));
                  if (data.data) {
                    onComplete?.(data.data);
                  }
                  break;

                case 'error':
                  setState(prev => ({
                    ...prev,
                    phase: 'error',
                    error: data.message || 'Unknown error',
                    isStreaming: false,
                  }));
                  onError?.(data.message || 'Unknown error');
                  break;

                case 'done':
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                  }));
                  break;
              }
            } catch (parseErr) {
            }
            currentEvent = '';
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;

      console.error('[StoryStream] Error:', error);
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: error.message || 'Stream failed',
        isStreaming: false,
      }));
      onError?.(error.message || 'Stream failed');
    }
  }, [campaignId, onComplete, onError]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setState({
      phase: 'idle',
      commitId: null,
      revealText: '',
      isStreaming: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    advanceStoryStream,
    reset,
  };
}
