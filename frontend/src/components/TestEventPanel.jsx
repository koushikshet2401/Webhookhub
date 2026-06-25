// frontend/src/components/TestEventPanel.jsx

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { endpointsApi } from '../services/endpoints.api';
import { deliveriesApi } from '../services/deliveries.api';
import { socket, joinProjectRoom } from '../services/socket';
import Button from './Button';
import Input from './Input';

export default function TestEventPanel({ endpoint }) {
  const [eventType, setEventType] = useState('test.event');
  const [payloadStr, setPayloadStr] = useState('{\n  "hello": "world"\n}');
  const [sending, setSending] = useState(false);
  
  // Array of log objects: { id: string, text: string, type: 'info' | 'success' | 'danger' | 'warning', action?: 'replay' }
  const [logs, setLogs] = useState([]);
  const [activeDeliveryId, setActiveDeliveryId] = useState(null);

  useEffect(() => {
    if (endpoint?.projectId) {
      joinProjectRoom(endpoint.projectId);
    }
  }, [endpoint?.projectId]);

  const appendLog = useCallback((text, type = 'info', action = null) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).slice(2), text, type, action }]);
  }, []);

  const handleUpdate = useCallback((update) => {
    if (!activeDeliveryId || update.deliveryId !== activeDeliveryId) return;

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const prefix = `[${time}] attempt ${update.attemptNumber} \u2192`;

    if (update.status === 'SUCCESS') {
      appendLog(`${prefix} ${update.statusCode || 200} SUCCESS (${update.latencyMs}ms)`, 'success');
    } else if (update.status === 'DELIVERING') {
      appendLog(`${prefix} ${update.statusCode || 'ERROR'}`, 'warning');
      appendLog(`[${time}] retrying...`, 'info');
    } else if (update.status === 'DEAD_LETTERED') {
      if (update.reason === 'blocked_url') {
        appendLog(`[${time}] \u2192 BLOCKED (SSRF / DNS rebinding protection)`, 'danger');
      } else {
        appendLog(`[${time}] \u2192 DEAD LETTERED (exhausted retries)`, 'danger', 'replay');
      }
    }
  }, [activeDeliveryId, appendLog]);

  useEffect(() => {
    socket.on('delivery_update', handleUpdate);
    return () => socket.off('delivery_update', handleUpdate);
  }, [handleUpdate]);

  async function handleSend(e) {
    e.preventDefault();
    let payload;
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      toast.error('Payload must be valid JSON');
      return;
    }

    setSending(true);
    setLogs([]);
    setActiveDeliveryId(null);
    try {
      const result = await endpointsApi.sendTestEvent(endpoint.id, { eventType, payload });
      setActiveDeliveryId(result.deliveryId);
      appendLog(`\u2192 queued as delivery #${result.deliveryId}`, 'info');
    } catch (err) {
      toast.error('Failed to send test event');
      appendLog(`\u2192 failed to enqueue test event`, 'danger');
    } finally {
      setSending(false);
    }
  }

  async function handleReplay() {
    if (!activeDeliveryId) return;
    try {
      await deliveriesApi.replay(activeDeliveryId);
      appendLog(`\u2192 Replaying delivery #${activeDeliveryId}...`, 'info');
    } catch {
      toast.error('Failed to replay delivery');
    }
  }

  return (
    <div className="border border-border rounded-lg bg-bg-elevated overflow-hidden flex flex-col mt-4">
      <div className="p-4 border-b border-border bg-bg-muted">
        <h3 className="text-sm font-medium mb-3">Test Event</h3>
        <form onSubmit={handleSend} className="flex flex-col gap-3">
          <Input 
            label="Event Type" 
            value={eventType} 
            onChange={(e) => setEventType(e.target.value)} 
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm text-text-muted">Payload (JSON)</label>
            <textarea
              className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-accent min-h-[100px]"
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              required
            />
          </div>
          
          <div className="font-mono text-xs text-text-faint bg-bg p-2 rounded truncate">
            $ webhookhub events:send --type "{eventType || '...'}" --payload '{payloadStr.replace(/\n/g, '')}'
          </div>

          <Button type="submit" size="sm" loading={sending} className="self-start">
            Send Event
          </Button>
        </form>
      </div>

      {(logs.length > 0 || sending) && (
        <div className="p-4 font-mono text-xs bg-[var(--color-mono-bg)] text-text-muted min-h-[120px] max-h-[300px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="mb-1 flex items-start gap-2">
              <span className={
                log.type === 'success' ? 'text-success' :
                log.type === 'danger' ? 'text-danger' :
                log.type === 'warning' ? 'text-warning' :
                'text-text-muted'
              }>
                {log.text}
              </span>
              {log.action === 'replay' && (
                <button 
                  onClick={handleReplay}
                  className="text-accent hover:underline ml-2"
                >
                  [Replay]
                </button>
              )}
            </div>
          ))}
          {activeDeliveryId && logs.length > 0 && !logs[logs.length-1].action && logs[logs.length-1].type !== 'success' && logs[logs.length-1].text.includes('DEAD_LETTERED') === false && (
            <span className="animate-pulse">_</span>
          )}
        </div>
      )}
    </div>
  );
}
