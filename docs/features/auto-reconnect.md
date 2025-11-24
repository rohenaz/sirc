# Auto-Reconnect Feature

## Overview

SIRC automatically reconnects to IRC servers when connections are unexpectedly lost, ensuring you stay connected even when network issues occur. The system uses exponential backoff to avoid overwhelming servers and automatically rejoins your channels after successful reconnection.

## Features

- **Automatic Detection**: Detects unexpected disconnects vs intentional disconnects
- **Exponential Backoff**: Increases wait time between attempts (1s, 2s, 4s, 8s, ...)
- **Channel Rejoin**: Automatically rejoins all channels you were in
- **Max Attempts**: Gives up after 10 attempts to avoid infinite loops
- **Graceful Degradation**: Falls back to disconnected state if all attempts fail
- **Intentional Disconnect Respect**: Doesn't reconnect when you manually disconnect

## How It Works

### Connection Monitoring

The IRC client monitors the connection via the `readLoop()` function. When the connection drops:

1. **Check if intentional**: If `stopCh` is closed, this was a manual disconnect - don't reconnect
2. **Check if enabled**: Only reconnect if `Server.AutoReconnect` is `true`
3. **Trigger reconnect**: Start the reconnection process in a goroutine

### Reconnection Process

1. **Exponential Backoff**:
   - Attempt 1: Wait 1 second
   - Attempt 2: Wait 2 seconds
   - Attempt 3: Wait 4 seconds
   - Attempt 4: Wait 8 seconds
   - ...
   - Max wait: 60 seconds (1 minute)

2. **Save Channel State**:
   - Collect all channels you were joined to
   - Store for rejoining after reconnect

3. **Attempt Connection**:
   - Call `Connect()` method
   - If fails, wait and retry
   - If succeeds, proceed to channel rejoin

4. **Rejoin Channels**:
   - Wait 2 seconds for registration
   - Loop through saved channels
   - Send `JOIN` command for each
   - Restore your previous session

5. **Reset State**:
   - Clear reconnect counter
   - Mark reconnecting as false
   - Resume normal operation

### Max Attempts

After 10 failed attempts, the system gives up:
- Logs error message
- Sets reconnecting to false
- Leaves client in disconnected state
- User can manually reconnect if desired

## Configuration

### Server-Level Setting

Auto-reconnect is configured per-server in the `Server` struct:

```go
type Server struct {
    // ... other fields ...
    AutoReconnect bool `json:"autoReconnect"` // Enable automatic reconnection
}
```

### Default Behavior

Currently, auto-reconnect defaults to `false` for new servers. This is conservative to avoid unexpected behavior.

**Future Enhancement**: Add UI toggle in server settings to enable/disable per-server.

## Usage

### Enabling Auto-Reconnect (Backend)

When adding a server programmatically:

```go
server := &irc.Server{
    ID:           "server-123",
    Name:         "Freenode",
    Host:         "irc.freenode.net",
    Port:         6667,
    SSL:          false,
    Nick:         "mynick",
    User:         "myuser",
    RealName:     "My Real Name",
    AutoReconnect: true,  // Enable auto-reconnect
}
```

### Frontend Integration (Future)

In the "Add Server" dialog, add a checkbox:

```typescript
<input
  type="checkbox"
  checked={autoReconnect}
  onChange={(e) => setAutoReconnect(e.target.checked)}
/>
<label>Automatically reconnect on disconnect</label>
```

## Reconnection Behavior

### Successful Reconnect

```
[INFO] Connection lost, attempting to reconnect...
[INFO] Reconnect attempt 1/10 in 1s...
[INFO] Connecting to irc.example.com:6667...
[INFO] Connected to irc.example.com:6667
[INFO] Reconnected successfully!
[INFO] Rejoining channel #dev...
[INFO] Rejoining channel #support...
```

### Failed Reconnect (Max Attempts)

```
[INFO] Connection lost, attempting to reconnect...
[INFO] Reconnect attempt 1/10 in 1s...
[ERROR] Reconnect failed: connection refused
[INFO] Reconnect attempt 2/10 in 2s...
[ERROR] Reconnect failed: connection refused
...
[INFO] Reconnect attempt 10/10 in 60s...
[ERROR] Reconnect failed: connection refused
[ERROR] Max reconnect attempts (10) reached, giving up
```

### Intentional Disconnect (No Reconnect)

```
User clicks "Disconnect" button
[INFO] Connection closed
(No reconnect attempt)
```

## Implementation Details

### Files Modified

**Backend:**
- `/pkg/irc/types.go` - Added `AutoReconnect` to Server, reconnect tracking to Client
- `/pkg/irc/client.go` - Added `attemptReconnect()` method, updated `readLoop()`

### Client struct additions

```go
type Client struct {
    // ... existing fields ...
    reconnectCount  int      // Number of reconnect attempts
    reconnecting    bool     // Currently attempting reconnect
    joinedChannels  []string // List of channels to rejoin on reconnect
}
```

### Reconnect Algorithm

```go
func (c *Client) attemptReconnect() {
    const maxAttempts = 10
    const maxBackoff = 60 * time.Second

    for attempt := 0; attempt < maxAttempts; attempt++ {
        // Calculate exponential backoff
        backoff := time.Duration(1<<uint(attempt)) * time.Second
        if backoff > maxBackoff {
            backoff = maxBackoff
        }

        time.Sleep(backoff)

        // Save channels to rejoin
        joinedChannels := getJoinedChannels()

        // Try to connect
        err := c.Connect()
        if err != nil {
            continue // Retry
        }

        // Wait for registration
        time.Sleep(2 * time.Second)

        // Rejoin channels
        for _, channel := range joinedChannels {
            c.JoinChannel(channel)
        }

        return // Success
    }

    // Max attempts reached
    log.Println("Giving up on reconnect")
}
```

### Connection Loss Detection

```go
func (c *Client) readLoop() {
    scanner := bufio.NewScanner(conn)
    for scanner.Scan() {
        select {
        case <-c.stopCh:
            return // Intentional disconnect
        default:
            c.handleMessage(scanner.Text())
        }
    }

    // Scanner ended - connection lost
    select {
    case <-c.stopCh:
        return // Intentional disconnect
    default:
        // Unexpected disconnect - reconnect if enabled
        if c.Server.AutoReconnect {
            go c.attemptReconnect()
        }
    }
}
```

## Exponential Backoff Explained

Exponential backoff prevents overwhelming the server with rapid reconnect attempts:

| Attempt | Formula | Wait Time |
|---------|---------|-----------|
| 1 | 2^0 = 1s | 1 second |
| 2 | 2^1 = 2s | 2 seconds |
| 3 | 2^2 = 4s | 4 seconds |
| 4 | 2^3 = 8s | 8 seconds |
| 5 | 2^4 = 16s | 16 seconds |
| 6 | 2^5 = 32s | 32 seconds |
| 7 | 2^6 = 64s → 60s | 60 seconds (capped) |
| 8-10 | Capped | 60 seconds |

**Total time before giving up**: ~7.5 minutes

## Edge Cases

### Multiple Simultaneous Disconnects

If multiple servers disconnect at once, each reconnects independently in its own goroutine. No shared state or contention.

### Reconnect During Shutdown

When app is shutting down:
1. `Disconnect()` is called for all servers
2. `stopCh` is closed
3. `readLoop()` detects stopCh and returns
4. No reconnect attempt is made

### Race Conditions

The `reconnecting` flag prevents multiple simultaneous reconnection attempts:

```go
c.mu.Lock()
if c.reconnecting {
    c.mu.Unlock()
    return // Already reconnecting
}
c.reconnecting = true
c.mu.Unlock()
```

### Channel State Preservation

Channels are saved before reconnecting:

```go
joinedChannels := make([]string, 0)
for name, ch := range c.Channels {
    if ch.Joined {
        joinedChannels = append(joinedChannels, name)
    }
}
```

## Future Enhancements

Planned improvements:

1. **UI Toggle**: Add checkbox in "Add Server" dialog to enable/disable
2. **Per-Channel Rejoin**: Remember which channels to rejoin vs skip
3. **Backoff Configuration**: Allow customizing max attempts and backoff
4. **Network Change Detection**: Reconnect faster when network becomes available
5. **Notification**: Show desktop notification when reconnected
6. **Status Indicator**: Visual indicator in UI showing reconnection progress
7. **Manual Retry**: Button to retry connection without waiting for backoff
8. **Reconnect on Ping Timeout**: Detect and reconnect on PING timeout

## Troubleshooting

### Reconnect Not Working

1. **Check AutoReconnect Setting**:
   ```
   Server AutoReconnect must be true
   ```

2. **Check Logs**:
   - Look for "attempting to reconnect" messages
   - Check for "Max reconnect attempts reached"

3. **Manual Disconnect**:
   - Verify you didn't manually disconnect
   - Manual disconnects don't trigger auto-reconnect

### Too Many Reconnect Attempts

If reconnecting too aggressively:
- Default is 10 attempts over ~7.5 minutes
- This is conservative and follows IRC best practices
- Don't modify without good reason

### Channels Not Rejoining

If channels aren't rejoined after reconnect:
1. Check channel was marked as "Joined" before disconnect
2. Verify 2-second wait for registration completed
3. Check server didn't ban/kick you from channel
4. Look for JOIN errors in IRC log

## Performance Impact

- **CPU**: Minimal - goroutine sleeps between attempts
- **Memory**: Tiny - stores list of channel names
- **Network**: Only reconnects on disconnect (not polling)
- **Goroutines**: One per reconnecting server (cleaned up after completion)

## Security Considerations

### Password Storage

Server password is stored in memory and reused for reconnection. This is necessary for auto-reconnect to work.

### SSL/TLS

Auto-reconnect preserves SSL/TLS settings. If original connection was SSL, reconnection uses SSL.

### No Credential Validation

Reconnect uses same credentials. If credentials changed server-side, reconnect will fail and give up after max attempts.

## Comparison to Other Clients

### LimeChat

- Has auto-reconnect with similar exponential backoff
- Configurable per-server
- Shows reconnection status in status bar

### mIRC

- Auto-reconnect with configurable retry count
- Optional sound notification on reconnect
- Supports reconnect on DCC failures

### SIRC

- Similar to LimeChat approach
- Conservative defaults (disabled by default)
- Automatic channel rejoin
- Exponential backoff capped at 60s

## Testing

### Manual Testing

1. **Start server connection** with AutoReconnect enabled
2. **Join channels** (#test, #dev)
3. **Simulate disconnect**: Kill server or break network
4. **Observe logs**: Should see reconnect attempts
5. **Verify reconnect**: After connection restored, should reconnect
6. **Check channels**: Should auto-rejoin #test and #dev

### Automated Testing

```go
func TestAutoReconnect(t *testing.T) {
    server := &Server{
        Host:          "irc.example.com",
        Port:          6667,
        AutoReconnect: true,
    }

    client := NewClient(server)
    client.Connect()

    // Simulate disconnect
    client.conn.Close()

    // Wait for reconnect
    time.Sleep(2 * time.Second)

    // Verify reconnected
    assert.Equal(t, Connected, client.State)
}
```

## Logging

Auto-reconnect generates these log entries:

| Level | Message | Meaning |
|-------|---------|---------|
| ERROR | Connection lost, attempting to reconnect | Unexpected disconnect detected |
| INFO | Reconnect attempt X/10 in Ys | Starting attempt X after Y seconds |
| INFO | Reconnected successfully! | Connection restored |
| INFO | Rejoining channel #foo | Attempting to rejoin channel |
| ERROR | Reconnect failed: [error] | Connection attempt failed |
| ERROR | Max reconnect attempts reached | Giving up after 10 attempts |

All reconnect events are also added to the IRC protocol log visible in the UI.

## Configuration Options (Future)

Potential configuration options to add:

```go
type ReconnectConfig struct {
    Enabled     bool          // Enable auto-reconnect
    MaxAttempts int           // Max reconnect attempts (default: 10)
    MaxBackoff  time.Duration // Max wait between attempts (default: 60s)
    RejoinDelay time.Duration // Wait before rejoining channels (default: 2s)
    Notification bool         // Show desktop notification on reconnect
}
```

## Related Features

- [SSL/TLS Support](./ssl-tls.md) - Secure connections are preserved during reconnect
- [Desktop Notifications](./desktop-notifications.md) - Could notify on reconnect
- Connection Status Indicator - Visual feedback for reconnection state

## Changelog

### Version 1.0.0 (2025-11-24)

- Initial implementation of auto-reconnect feature
- Exponential backoff with 10 max attempts
- Automatic channel rejoin after reconnect
- Per-server configuration via `AutoReconnect` field
- Detection of intentional vs unexpected disconnects
- Graceful handling of max attempts reached
- Thread-safe reconnection state management

## Known Issues

None currently reported.

## Support

For issues with auto-reconnect:
- Check IRC protocol log for reconnect messages
- Verify `AutoReconnect` is `true` in server config
- Look for "Max reconnect attempts reached" if failing
- File issue on GitHub with logs

**Common Issues**:
- "Reconnect not triggering" → Check AutoReconnect setting
- "Too many attempts" → Working as designed (10 max)
- "Channels not rejoining" → Check JOIN errors in log
