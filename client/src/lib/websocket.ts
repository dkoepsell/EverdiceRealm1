/**
 * WebSocket connection handler for real-time dice roll updates
 */
let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 10;
let reconnectTimer: number | null = null;
let isReconnecting = false;

export function createWSConnection(force = false) {
  // If we're already reconnecting and not forcing, exit
  if (isReconnecting && !force) return;
  
  // If socket exists and is open or connecting, and not forcing, exit
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) && !force) {
    return;
  }
  
  try {
    // Close existing socket if it exists
    if (socket) {
      try {
        // Only attempt to close if not already closed
        if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
          socket.close();
        }
      } catch (err) {
        // Silent error handling
      }
    }
    
    isReconnecting = true;
    
    // Determine if we're in a secure context
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    socket = new WebSocket(wsUrl);
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      if (socket && socket.readyState !== WebSocket.OPEN) {
        try {
          socket.close();
        } catch (err) {
          // Silent error handling
        }
        scheduleReconnect();
      }
    }, 10000);
    
    socket.onopen = () => {
      clearTimeout(connectionTimeout);
      reconnectAttempts = 0;
      isReconnecting = false;
      
      // Clear any pending reconnect timer
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // console.log('WebSocket message received:', data);
        
        // Handle different message types
        if (data.type === 'dice_roll') {
          // Dispatch custom event for dice roll results
          window.dispatchEvent(new CustomEvent('dice_roll_result', { 
            detail: data.payload 
          }));
        } else if (data.type === 'campaign_update') {
          // Dispatch event for campaign updates
          window.dispatchEvent(new CustomEvent('campaign_update', {
            detail: data.payload
          }));
        } else if (data.type === 'chat_message') {
          // Dispatch event for chat messages
          window.dispatchEvent(new CustomEvent('chat_message', {
            detail: data.payload
          }));
        } else if (data.type === 'typing_indicator') {
          // Dispatch event for typing indicators
          window.dispatchEvent(new CustomEvent('typing_indicator', {
            detail: data.payload
          }));
        } else if (data.type === 'player_action') {
          // Dispatch event for player actions
          window.dispatchEvent(new CustomEvent('player_action', {
            detail: data.payload
          }));
        } else if (data.type === 'story_advanced') {
          // Dispatch event for story advancement
          window.dispatchEvent(new CustomEvent('story_advanced', {
            detail: data.payload
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onclose = (event) => {
      clearTimeout(connectionTimeout);
      
      // Don't attempt to reconnect if closing was intentional (code 1000)
      if (event.code !== 1000) {
        scheduleReconnect();
      } else {
        isReconnecting = false;
        reconnectAttempts = 0;
      }
    };
    
    socket.onerror = (error) => {
      // Silent error handling - onclose will handle reconnection
    };
  } catch (error) {
    // Silent error handling
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  // If max attempts reached, stop trying
  if (reconnectAttempts >= maxReconnectAttempts) {
    isReconnecting = false;
    return;
  }
  
  // Clear any existing reconnect timer
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
  }
  
  // Exponential backoff with some randomness
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts) + Math.random() * 1000, 30000);
  reconnectAttempts++;
  
  reconnectTimer = window.setTimeout(() => {
    createWSConnection(true);
  }, delay);
}

export function sendWSMessage(type: string, payload: any) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, payload }));
  }
}

// Close connection when window closes
window.addEventListener('beforeunload', () => {
  if (socket) {
    socket.close();
  }
});