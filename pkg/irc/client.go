package irc

import (
	"bufio"
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"regexp"
	"strings"
	"time"
)

// stripIRCFormatting removes IRC formatting codes (colors, bold, etc.)
func stripIRCFormatting(text string) string {
	// Remove color codes: \x03 followed by optional digits
	colorRegex := regexp.MustCompile(`\x03(\d{1,2}(,\d{1,2})?)?`)
	text = colorRegex.ReplaceAllString(text, "")

	// Remove other formatting codes
	text = strings.ReplaceAll(text, "\x02", "") // Bold
	text = strings.ReplaceAll(text, "\x1F", "") // Underline
	text = strings.ReplaceAll(text, "\x16", "") // Reverse
	text = strings.ReplaceAll(text, "\x0F", "") // Reset
	text = strings.ReplaceAll(text, "\x1D", "") // Italic
	text = strings.ReplaceAll(text, "\x1E", "") // Strikethrough
	text = strings.ReplaceAll(text, "\x11", "") // Monospace

	return text
}

// getChannelNames returns a list of channel names (for debugging)
// NOTE: Caller must hold c.mu lock
func (c *Client) getChannelNames() []string {
	names := make([]string, 0, len(c.Channels))
	for name := range c.Channels {
		names = append(names, name)
	}
	return names
}

// NewClient creates a new IRC client
func NewClient(server *Server) *Client {
	return &Client{
		Server:         server,
		State:          Disconnected,
		Channels:       make(map[string]*Channel),
		ChannelList:    make([]*Channel, 0),
		Logs:           make([]*LogEntry, 0),
		stopCh:         make(chan struct{}),
		maxMessages:    500, // Store last 500 messages per channel
		maxLogs:        200, // Store last 200 log entries
		listInProgress: false,
		whoisData:      make(map[string]*WhoisInfo),
	}
}

// addLog adds a log entry to the client
func (c *Client) addLog(direction, raw, logType string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := &LogEntry{
		Timestamp: time.Now(),
		Direction: direction,
		Raw:       raw,
		Type:      logType,
	}

	c.Logs = append(c.Logs, entry)
	if len(c.Logs) > c.maxLogs {
		c.Logs = c.Logs[len(c.Logs)-c.maxLogs:]
	}
}

// Connect establishes connection to the IRC server
func (c *Client) Connect() error {
	c.mu.Lock()
	if c.State != Disconnected {
		c.mu.Unlock()
		return fmt.Errorf("client already connected or connecting")
	}
	c.State = Connecting
	// Recreate stopCh for new connection
	c.stopCh = make(chan struct{})
	c.mu.Unlock()

	address := fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
	log.Printf("[IRC] Connecting to %s...", address)
	c.addLog("info", fmt.Sprintf("Connecting to %s...", address), "info")

	var conn net.Conn
	var err error

	// Add 30 second timeout
	dialer := &net.Dialer{
		Timeout: 30 * time.Second,
	}

	if c.Server.SSL {
		log.Printf("[IRC] Using SSL/TLS")
		c.addLog("info", "Using SSL/TLS", "info")
		conn, err = tls.DialWithDialer(dialer, "tcp", address, &tls.Config{
			ServerName:         c.Server.Host,
			InsecureSkipVerify: true, // Skip certificate verification (common for IRC servers with self-signed certs)
		})
	} else {
		log.Printf("[IRC] Using plaintext connection")
		c.addLog("info", "Using plaintext connection", "info")
		conn, err = dialer.Dial("tcp", address)
	}

	if err != nil {
		log.Printf("[IRC] Connection failed: %v", err)
		c.addLog("error", fmt.Sprintf("Connection failed: %v", err), "error")
		c.mu.Lock()
		c.State = Disconnected
		c.mu.Unlock()
		return fmt.Errorf("failed to connect: %w", err)
	}

	log.Printf("[IRC] Connected to %s", address)
	c.addLog("info", fmt.Sprintf("Connected to %s", address), "info")

	c.mu.Lock()
	c.conn = conn
	c.State = Connected
	c.mu.Unlock()

	// Start the read loop
	go c.readLoop()

	// Register with the IRC server
	log.Printf("[IRC] Registering as %s", c.Server.Nick)
	c.addLog("info", fmt.Sprintf("Registering as %s", c.Server.Nick), "info")
	if c.Server.Password != "" {
		cmd := fmt.Sprintf("PASS %s", c.Server.Password)
		c.sendRaw(cmd)
		c.addLog("out", "PASS ********", "protocol")
	}
	nickCmd := fmt.Sprintf("NICK %s", c.Server.Nick)
	c.sendRaw(nickCmd)
	c.addLog("out", nickCmd, "protocol")

	userCmd := fmt.Sprintf("USER %s 0 * :%s", c.Server.User, c.Server.RealName)
	c.sendRaw(userCmd)
	c.addLog("out", userCmd, "protocol")

	return nil
}

// Disconnect closes the IRC connection
func (c *Client) Disconnect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.State == Disconnected {
		return nil
	}

	close(c.stopCh)

	if c.conn != nil {
		c.sendRaw("QUIT :Goodbye")
		if conn, ok := c.conn.(net.Conn); ok {
			conn.Close()
		}
		c.conn = nil
	}

	c.State = Disconnected
	return nil
}

// JoinChannel joins an IRC channel
func (c *Client) JoinChannel(channel string) error {
	log.Printf("[Client] JoinChannel called for channel: %s", channel)

	if !strings.HasPrefix(channel, "#") {
		channel = "#" + channel
	}

	log.Printf("[Client] JoinChannel: calling sendRaw with JOIN %s", channel)
	err := c.sendRaw(fmt.Sprintf("JOIN %s", channel))
	if err != nil {
		log.Printf("[Client] JoinChannel: sendRaw returned error: %v", err)
	} else {
		log.Printf("[Client] JoinChannel: sendRaw returned successfully")
	}
	return err
}

// PartChannel leaves an IRC channel
func (c *Client) PartChannel(channel string) error {
	return c.sendRaw(fmt.Sprintf("PART %s", channel))
}

// SendMessage sends a message to a channel or user
func (c *Client) SendMessage(target, message string) error {
	return c.sendRaw(fmt.Sprintf("PRIVMSG %s :%s", target, message))
}

// SendCTCP sends a CTCP message (used for XDCC requests)
func (c *Client) SendCTCP(target, command string) error {
	return c.sendRaw(fmt.Sprintf("PRIVMSG %s :\x01%s\x01", target, command))
}

// ListChannels requests the channel list from the server
func (c *Client) ListChannels() error {
	c.listMu.Lock()
	// Clear previous channel list and mark in progress
	c.ChannelList = make([]*Channel, 0)
	c.listInProgress = true
	c.listMu.Unlock()

	log.Printf("[IRC] Requesting channel list...")
	c.addLog("info", "Requesting channel list...", "info")
	return c.sendRaw("LIST")
}

// Whois requests WHOIS information for a nickname
func (c *Client) Whois(nick string) error {
	log.Printf("[IRC] Requesting WHOIS for %s...", nick)
	c.addLog("info", fmt.Sprintf("Requesting WHOIS for %s...", nick), "info")

	// Initialize WHOIS data for this nick
	c.whoisMu.Lock()
	c.whoisData[nick] = &WhoisInfo{
		Nick:     nick,
		Channels: make([]string, 0),
	}
	c.whoisMu.Unlock()

	return c.sendRaw(fmt.Sprintf("WHOIS %s", nick))
}

// GetWhoisInfo returns WHOIS information for a nickname
func (c *Client) GetWhoisInfo(nick string) *WhoisInfo {
	c.whoisMu.Lock()
	defer c.whoisMu.Unlock()

	if info, ok := c.whoisData[nick]; ok {
		// Return a copy
		infoCopy := *info
		return &infoCopy
	}
	return nil
}

// GetChannelList returns the stored channel list
func (c *Client) GetChannelList() []*Channel {
	c.listMu.Lock()
	defer c.listMu.Unlock()

	// Return a copy of the channel list
	list := make([]*Channel, len(c.ChannelList))
	copy(list, c.ChannelList)
	return list
}

// IsListInProgress returns true if a channel list request is still in progress
func (c *Client) IsListInProgress() bool {
	c.listMu.Lock()
	defer c.listMu.Unlock()
	return c.listInProgress
}

// sendRaw sends a raw IRC command
func (c *Client) sendRaw(command string) error {
	log.Printf("[Client] sendRaw called with command: %s", command)
	log.Printf("[Client] sendRaw: attempting to acquire RLock...")
	c.mu.RLock()
	log.Printf("[Client] sendRaw: RLock acquired")
	conn := c.conn
	c.mu.RUnlock()
	log.Printf("[Client] sendRaw: RLock released")

	if conn == nil {
		return fmt.Errorf("not connected")
	}

	netConn, ok := conn.(net.Conn)
	if !ok {
		return fmt.Errorf("invalid connection type")
	}

	// Set write deadline to prevent indefinite hangs
	deadline := time.Now().Add(10 * time.Second)
	if err := netConn.SetWriteDeadline(deadline); err != nil {
		log.Printf("[IRC] Failed to set write deadline: %v", err)
		return fmt.Errorf("failed to set write deadline: %w", err)
	}

	_, err := fmt.Fprintf(netConn, "%s\r\n", command)
	if err != nil {
		log.Printf("[IRC] Failed to write command %q: %v", command, err)
		return fmt.Errorf("failed to write command: %w", err)
	}

	// Clear write deadline after successful write
	netConn.SetWriteDeadline(time.Time{})

	return nil
}

// readLoop reads messages from the IRC server
func (c *Client) readLoop() {
	c.mu.RLock()
	conn := c.conn
	c.mu.RUnlock()

	netConn, ok := conn.(net.Conn)
	if !ok {
		return
	}

	scanner := bufio.NewScanner(netConn)
	for scanner.Scan() {
		select {
		case <-c.stopCh:
			return
		default:
			line := scanner.Text()
			c.handleMessage(line)
		}
	}

	// Connection lost - check if we should reconnect
	select {
	case <-c.stopCh:
		// Intentional disconnect, don't reconnect
		return
	default:
		// Unexpected disconnect
		c.mu.Lock()
		wasConnected := c.State == Connected || c.State == Registered
		autoReconnect := c.Server.AutoReconnect
		c.State = Disconnected
		c.mu.Unlock()

		if wasConnected && autoReconnect {
			log.Printf("[IRC] Connection lost, attempting to reconnect...")
			c.addLog("error", "Connection lost, attempting to reconnect...", "error")
			go c.attemptReconnect()
		} else {
			log.Printf("[IRC] Connection closed")
			c.addLog("info", "Connection closed", "info")
		}
	}
}

// attemptReconnect attempts to reconnect with exponential backoff
func (c *Client) attemptReconnect() {
	c.mu.Lock()
	if c.reconnecting {
		c.mu.Unlock()
		return // Already reconnecting
	}
	c.reconnecting = true
	c.reconnectCount = 0
	c.mu.Unlock()

	const maxAttempts = 10
	const maxBackoff = 60 * time.Second

	for {
		c.mu.Lock()
		count := c.reconnectCount
		c.mu.Unlock()

		if count >= maxAttempts {
			log.Printf("[IRC] Max reconnect attempts (%d) reached, giving up", maxAttempts)
			c.addLog("error", fmt.Sprintf("Max reconnect attempts (%d) reached, giving up", maxAttempts), "error")
			c.mu.Lock()
			c.reconnecting = false
			c.mu.Unlock()
			return
		}

		// Calculate exponential backoff: 2^count seconds, capped at maxBackoff
		backoff := time.Duration(1<<uint(count)) * time.Second
		if backoff > maxBackoff {
			backoff = maxBackoff
		}

		log.Printf("[IRC] Reconnect attempt %d/%d in %v...", count+1, maxAttempts, backoff)
		c.addLog("info", fmt.Sprintf("Reconnect attempt %d/%d in %v...", count+1, maxAttempts, backoff), "info")

		time.Sleep(backoff)

		// Try to reconnect
		c.mu.Lock()
		c.reconnectCount++
		// Save joined channels before reconnecting
		joinedChannels := make([]string, 0)
		for name, ch := range c.Channels {
			if ch.Joined {
				joinedChannels = append(joinedChannels, name)
			}
		}
		c.joinedChannels = joinedChannels
		c.mu.Unlock()

		err := c.Connect()
		if err != nil {
			log.Printf("[IRC] Reconnect failed: %v", err)
			c.addLog("error", fmt.Sprintf("Reconnect failed: %v", err), "error")
			continue
		}

		log.Printf("[IRC] Reconnected successfully!")
		c.addLog("info", "Reconnected successfully!", "info")

		// Wait a moment for registration
		time.Sleep(2 * time.Second)

		// Rejoin channels
		c.mu.RLock()
		channels := c.joinedChannels
		c.mu.RUnlock()

		for _, channel := range channels {
			log.Printf("[IRC] Rejoining channel %s...", channel)
			c.addLog("info", fmt.Sprintf("Rejoining channel %s...", channel), "info")
			c.JoinChannel(channel)
		}

		c.mu.Lock()
		c.reconnecting = false
		c.reconnectCount = 0
		c.mu.Unlock()

		return
	}
}

// handleMessage processes incoming IRC messages
func (c *Client) handleMessage(line string) {
	log.Printf("[IRC] << %s", line)
	c.addLog("in", line, "protocol")

	// Handle PING
	if strings.HasPrefix(line, "PING ") {
		pong := strings.Replace(line, "PING", "PONG", 1)
		c.sendRaw(pong)
		c.addLog("out", pong, "protocol")
		return
	}

	// Parse IRC message
	parts := strings.Split(line, " ")
	if len(parts) < 2 {
		return
	}

	// Handle RPL_WELCOME (001) - registration successful
	if parts[1] == "001" {
		log.Printf("[IRC] Registration successful! We are now registered on the network")
		c.addLog("info", "Registration successful! We are now registered on the network", "info")
		c.mu.Lock()
		c.State = Registered
		c.mu.Unlock()
		return
	}

	// Handle RPL_ENDOFMOTD (376) or ERR_NOMOTD (422) - end of MOTD, perform NickServ auth
	if parts[1] == "376" || parts[1] == "422" {
		log.Printf("[IRC] End of MOTD/Registration complete")
		c.mu.RLock()
		nickServPassword := c.Server.NickServPassword
		c.mu.RUnlock()

		// Authenticate with NickServ if password is configured
		if nickServPassword != "" {
			log.Printf("[IRC] Authenticating with NickServ...")
			c.addLog("info", "Authenticating with NickServ...", "info")
			c.sendRaw(fmt.Sprintf("PRIVMSG NickServ :IDENTIFY %s", nickServPassword))
			c.addLog("out", "PRIVMSG NickServ :IDENTIFY ********", "protocol")
		}
		return
	}

	// Handle JOIN
	if len(parts) >= 3 && parts[1] == "JOIN" {
		channel := strings.TrimPrefix(parts[2], ":")
		// Extract nick from prefix to see if it's us
		prefix := parts[0]
		nick := strings.TrimPrefix(prefix, ":")
		if idx := strings.Index(nick, "!"); idx != -1 {
			nick = nick[:idx]
		}

		c.mu.Lock()
		// Only create channel if it's our own join
		if nick == c.Server.Nick {
			if c.Channels[channel] == nil {
				log.Printf("[IRC] Successfully joined channel: %s", channel)
				c.Channels[channel] = &Channel{
					Name:     channel,
					Joined:   true,
					Messages: make([]*Message, 0, c.maxMessages),
					UserList: make([]string, 0),
				}
			} else {
				// Clear user list if rejoining existing channel
				c.Channels[channel].UserList = make([]string, 0)
				c.Channels[channel].Joined = true
				log.Printf("[IRC] Rejoined existing channel: %s", channel)
			}
		}
		c.mu.Unlock()
		return
	}

	// Handle PART
	if len(parts) >= 3 && parts[1] == "PART" {
		channel := strings.TrimPrefix(parts[2], ":")
		// Extract nick from prefix to see if it's us
		prefix := parts[0]
		nick := strings.TrimPrefix(prefix, ":")
		if idx := strings.Index(nick, "!"); idx != -1 {
			nick = nick[:idx]
		}

		c.mu.Lock()
		// Only remove channel if it's our own part
		if nick == c.Server.Nick {
			if c.Channels[channel] != nil {
				log.Printf("[IRC] Successfully left channel: %s", channel)
				delete(c.Channels, channel)
			}
		}
		c.mu.Unlock()
		return
	}

	// Handle NAMES list (RPL_NAMREPLY = 353)
	if len(parts) >= 5 && parts[1] == "353" {
		// :server 353 nick = #channel :user1 user2 user3
		log.Printf("[IRC] 353 NAMES: parsing message with %d parts", len(parts))

		channelIdx := -1
		for i, part := range parts {
			if strings.HasPrefix(part, "#") {
				channelIdx = i
				log.Printf("[IRC] 353 NAMES: found channel at index %d: %s", i, part)
				break
			}
		}

		if channelIdx > 0 && channelIdx < len(parts)-1 {
			channel := parts[channelIdx]
			// Users start after the channel name and :
			userList := strings.Join(parts[channelIdx+1:], " ")
			userList = strings.TrimPrefix(userList, ":")
			users := strings.Fields(userList) // Use Fields to properly split and trim whitespace

			log.Printf("[IRC] 353 NAMES: channel=%s, extracted %d users", channel, len(users))

			c.mu.Lock()
			ch := c.Channels[channel]
			if ch != nil {
				log.Printf("[IRC] 353 NAMES: channel %s found in map, current UserList has %d entries", channel, len(ch.UserList))
				// Keep mode prefixes (@, +, %, &, ~, !) for display
				// Filter out empty entries
				validNicks := make([]string, 0, len(users))
				for _, nick := range users {
					nick = strings.TrimSpace(nick)
					if nick != "" {
						validNicks = append(validNicks, nick)
					}
				}

				// Append to existing list (353 can come in multiple messages)
				ch.UserList = append(ch.UserList, validNicks...)
				ch.Users = len(ch.UserList)
				log.Printf("[IRC] Channel %s: added %d users (total: %d)", channel, len(validNicks), ch.Users)
			} else {
				log.Printf("[IRC] 353 NAMES: WARNING - channel %s NOT FOUND in Channels map! Available channels: %v", channel, c.getChannelNames())
			}
			c.mu.Unlock()
		} else {
			log.Printf("[IRC] 353 NAMES: WARNING - channelIdx invalid: %d (parts: %d)", channelIdx, len(parts))
		}
		return
	}

	// Handle end of NAMES (RPL_ENDOFNAMES = 366)
	if len(parts) >= 4 && parts[1] == "366" {
		// Just log it, we already counted users in 353
		channel := parts[3]
		log.Printf("[IRC] End of NAMES for %s", channel)
		return
	}

	// Handle TOPIC (RPL_TOPIC = 332)
	if len(parts) >= 4 && parts[1] == "332" {
		channel := parts[3]
		topic := strings.Join(parts[4:], " ")
		topic = strings.TrimPrefix(topic, ":")

		c.mu.Lock()
		if ch := c.Channels[channel]; ch != nil {
			ch.Topic = topic
			log.Printf("[IRC] Topic for %s: %s", channel, topic)
		}
		c.mu.Unlock()
		return
	}

	// Handle RPL_LIST (322) - channel list entry
	// Format: :server 322 nick #channel usercount :topic
	if len(parts) >= 5 && parts[1] == "322" {
		channelName := parts[3]
		userCount := 0
		if count, err := fmt.Sscanf(parts[4], "%d", &userCount); err == nil && count == 1 {
			topic := ""
			if len(parts) > 5 {
				topic = strings.Join(parts[5:], " ")
				topic = strings.TrimPrefix(topic, ":")
			}

			c.listMu.Lock()
			c.ChannelList = append(c.ChannelList, &Channel{
				Name:     channelName,
				Topic:    topic,
				Users:    userCount,
				Joined:   false,
				Messages: nil,
			})
			c.listMu.Unlock()
		}
		return
	}

	// Handle RPL_LISTEND (323) - end of channel list
	// Format: :server 323 nick :End of LIST
	if parts[1] == "323" {
		c.listMu.Lock()
		c.listInProgress = false
		log.Printf("[IRC] Channel list complete: %d channels", len(c.ChannelList))
		c.addLog("info", fmt.Sprintf("Channel list complete: %d channels", len(c.ChannelList)), "info")
		c.listMu.Unlock()
		return
	}

	// Handle RPL_WHOISUSER (311) - WHOIS user info
	// Format: :server 311 client nick username host * :realname
	if len(parts) >= 8 && parts[1] == "311" {
		nick := parts[3]
		username := parts[4]
		host := parts[5]
		realname := strings.Join(parts[7:], " ")
		realname = strings.TrimPrefix(realname, ":")

		c.whoisMu.Lock()
		if info, ok := c.whoisData[nick]; ok {
			info.Username = username
			info.Host = host
			info.RealName = realname
		}
		c.whoisMu.Unlock()
		log.Printf("[IRC] WHOIS %s: %s@%s (%s)", nick, username, host, realname)
		return
	}

	// Handle RPL_WHOISSERVER (312) - WHOIS server info
	// Format: :server 312 client nick servername :serverinfo
	if len(parts) >= 5 && parts[1] == "312" {
		nick := parts[3]
		server := parts[4]
		serverInfo := strings.Join(parts[5:], " ")
		serverInfo = strings.TrimPrefix(serverInfo, ":")

		c.whoisMu.Lock()
		if info, ok := c.whoisData[nick]; ok {
			info.Server = server
			info.ServerInfo = serverInfo
		}
		c.whoisMu.Unlock()
		log.Printf("[IRC] WHOIS %s: on server %s (%s)", nick, server, serverInfo)
		return
	}

	// Handle RPL_WHOISOPERATOR (313) - WHOIS operator status
	// Format: :server 313 client nick :is an IRC operator
	if len(parts) >= 4 && parts[1] == "313" {
		nick := parts[3]

		c.whoisMu.Lock()
		if info, ok := c.whoisData[nick]; ok {
			info.IsOperator = true
		}
		c.whoisMu.Unlock()
		log.Printf("[IRC] WHOIS %s: is an IRC operator", nick)
		return
	}

	// Handle RPL_WHOISIDLE (317) - WHOIS idle time
	// Format: :server 317 client nick idle signon :seconds idle, signon time
	if len(parts) >= 6 && parts[1] == "317" {
		nick := parts[3]
		var idleTime, signOnTime int64
		fmt.Sscanf(parts[4], "%d", &idleTime)
		fmt.Sscanf(parts[5], "%d", &signOnTime)

		c.whoisMu.Lock()
		if info, ok := c.whoisData[nick]; ok {
			info.IdleTime = int(idleTime)
			info.SignOnTime = signOnTime
		}
		c.whoisMu.Unlock()
		log.Printf("[IRC] WHOIS %s: idle %ds, signon %d", nick, idleTime, signOnTime)
		return
	}

	// Handle RPL_ENDOFWHOIS (318) - End of WHOIS
	// Format: :server 318 client nick :End of /WHOIS list
	if len(parts) >= 4 && parts[1] == "318" {
		nick := parts[3]
		log.Printf("[IRC] WHOIS %s: complete", nick)
		c.addLog("info", fmt.Sprintf("WHOIS %s complete", nick), "info")
		return
	}

	// Handle RPL_WHOISCHANNELS (319) - WHOIS channels
	// Format: :server 319 client nick :channel1 channel2 channel3...
	if len(parts) >= 5 && parts[1] == "319" {
		nick := parts[3]
		channelsStr := strings.Join(parts[4:], " ")
		channelsStr = strings.TrimPrefix(channelsStr, ":")
		channels := strings.Fields(channelsStr)

		c.whoisMu.Lock()
		if info, ok := c.whoisData[nick]; ok {
			info.Channels = append(info.Channels, channels...)
		}
		c.whoisMu.Unlock()
		log.Printf("[IRC] WHOIS %s: in channels %v", nick, channels)
		return
	}

	// Handle RPL_WHOISACCOUNT (330) - WHOIS account (services login)
	// Format: :server 330 client nick accountname :is logged in as
	if len(parts) >= 5 && parts[1] == "330" {
		nick := parts[3]
		account := parts[4]

		c.whoisMu.Lock()
		if info, ok := c.whoisData[nick]; ok {
			info.Account = account
		}
		c.whoisMu.Unlock()
		log.Printf("[IRC] WHOIS %s: logged in as %s", nick, account)
		return
	}

	// Handle RPL_TRYAGAIN (263) - server rejected LIST command
	// Format: :server 263 nick :Server load is temporarily too heavy. Please wait a while and try again.
	if parts[1] == "263" {
		c.listMu.Lock()
		c.listInProgress = false
		c.ChannelList = []*Channel{} // Clear the channel list
		errorMsg := "Server rejected channel list request"
		if len(parts) > 3 {
			errorMsg = strings.Join(parts[3:], " ")
			errorMsg = strings.TrimPrefix(errorMsg, ":")
		}
		log.Printf("[IRC] Channel list request rejected: %s", errorMsg)
		c.addLog("error", fmt.Sprintf("Channel list request failed: %s", errorMsg), "error")
		c.listMu.Unlock()
		return
	}

	// Handle RPL_NAMREPLY (353) - names list for a channel
	// Format: :server 353 nick = #channel :nick1 nick2 @nick3 +nick4 ...
	if len(parts) >= 6 && parts[1] == "353" {
		channelName := parts[4]
		nicksStr := strings.Join(parts[5:], " ")
		nicksStr = strings.TrimPrefix(nicksStr, ":")

		// Split nicknames and strip mode prefixes (@, +, %, etc.)
		nickList := strings.Fields(nicksStr)
		cleanNicks := make([]string, 0, len(nickList))
		for _, nick := range nickList {
			// Strip common channel mode prefixes
			cleanNick := strings.TrimLeft(nick, "@+%&~!")
			if cleanNick != "" {
				cleanNicks = append(cleanNicks, cleanNick)
			}
		}

		c.mu.Lock()
		if ch := c.Channels[channelName]; ch != nil {
			// Append to existing user list (NAMES can be sent in multiple 353 messages)
			ch.UserList = append(ch.UserList, cleanNicks...)
			log.Printf("[IRC] Names for %s: added %d users (total: %d)", channelName, len(cleanNicks), len(ch.UserList))
		}
		c.mu.Unlock()
		return
	}

	// Handle RPL_ENDOFNAMES (366) - end of names list
	// Format: :server 366 nick #channel :End of /NAMES list.
	if len(parts) >= 4 && parts[1] == "366" {
		channelName := parts[3]

		c.mu.Lock()
		if ch := c.Channels[channelName]; ch != nil {
			log.Printf("[IRC] Names list complete for %s: %d users", channelName, len(ch.UserList))
		}
		c.mu.Unlock()
		return
	}

	// Handle PRIVMSG (channel messages)
	if len(parts) >= 4 && parts[1] == "PRIVMSG" {
		// Parse: :nick!user@host PRIVMSG #channel :message text
		prefix := parts[0]
		target := parts[2]
		messageText := strings.Join(parts[3:], " ")
		messageText = strings.TrimPrefix(messageText, ":")

		// Strip IRC formatting codes
		messageText = stripIRCFormatting(messageText)

		// Extract nick from prefix
		nick := strings.TrimPrefix(prefix, ":")
		if idx := strings.Index(nick, "!"); idx != -1 {
			nick = nick[:idx]
		}

		c.storeMessage(target, nick, messageText, "message")
		return
	}

	// TODO: Handle more IRC commands (PART, QUIT, NOTICE, etc.)
}

// storeMessage stores a message in the appropriate channel
func (c *Client) storeMessage(target, from, text, msgType string) {
	log.Printf("[IRC] storeMessage: target=%q from=%q text=%q", target, from, text)
	c.mu.RLock()
	channel := c.Channels[target]
	// Debug: Show what channels we have
	channelNames := make([]string, 0, len(c.Channels))
	for name := range c.Channels {
		channelNames = append(channelNames, name)
	}
	c.mu.RUnlock()

	if channel == nil {
		log.Printf("[IRC] storeMessage: channel %q not found! We have channels: %v", target, channelNames)
		return
	}
	log.Printf("[IRC] storeMessage: storing message in channel %q", target)

	msg := &Message{
		Timestamp: time.Now(),
		From:      from,
		To:        target,
		Text:      text,
		Type:      msgType,
	}

	channel.mu.Lock()
	defer channel.mu.Unlock()

	// Add message and maintain max size
	channel.Messages = append(channel.Messages, msg)
	if len(channel.Messages) > c.maxMessages {
		channel.Messages = channel.Messages[len(channel.Messages)-c.maxMessages:]
	}
}

// GetChannels returns the list of joined channels
func (c *Client) GetChannels() []*Channel {
	c.mu.RLock()
	defer c.mu.RUnlock()

	channels := make([]*Channel, 0, len(c.Channels))
	for _, ch := range c.Channels {
		channels = append(channels, ch)
	}
	return channels
}

// GetMessages returns messages for a specific channel
func (c *Client) GetMessages(channelName string) ([]*Message, error) {
	c.mu.RLock()
	channel, exists := c.Channels[channelName]
	c.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("not in channel: %s", channelName)
	}

	channel.mu.RLock()
	defer channel.mu.RUnlock()

	// Return a copy of the messages
	messages := make([]*Message, len(channel.Messages))
	copy(messages, channel.Messages)

	return messages, nil
}

// GetState returns the current connection state
func (c *Client) GetState() ConnectionState {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.State
}

// GetLogs returns a copy of the IRC logs
func (c *Client) GetLogs() []*LogEntry {
	c.mu.RLock()
	defer c.mu.RUnlock()

	logs := make([]*LogEntry, len(c.Logs))
	copy(logs, c.Logs)
	return logs
}
