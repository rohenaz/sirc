package irc

import (
	"sync"
	"time"
)

// Server represents an IRC server configuration
type Server struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	SSL      bool   `json:"ssl"`
	Nick     string `json:"nick"`
	User     string `json:"user"`
	RealName string `json:"realName"`
	Password string `json:"password,omitempty"`
}

// Channel represents an IRC channel
type Channel struct {
	Name     string     `json:"name"`
	Topic    string     `json:"topic"`
	Users    int        `json:"users"`
	UserList []string   `json:"userList"` // List of nicknames in the channel
	Joined   bool       `json:"joined"`
	Messages []*Message `json:"messages"`
	mu       sync.RWMutex
}

// Message represents an IRC message
type Message struct {
	Timestamp time.Time `json:"timestamp"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Text      string    `json:"text"`
	Type      string    `json:"type"` // message, notice, action, join, part, quit
}

// ConnectionState represents the state of an IRC connection
type ConnectionState int

const (
	Disconnected ConnectionState = iota
	Connecting
	Connected
	Registered
)

// LogEntry represents an IRC protocol log entry
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Direction string    `json:"direction"` // "in" or "out"
	Raw       string    `json:"raw"`
	Type      string    `json:"type"` // "info", "error", "protocol"
}

// Client represents an IRC client connection
type Client struct {
	Server         *Server
	State          ConnectionState
	Channels       map[string]*Channel // Joined channels (Joined=true)
	ChannelList    []*Channel          // All channels from LIST command (Joined=false)
	Logs           []*LogEntry
	conn           interface{} // net.Conn
	mu             sync.RWMutex
	listMu         sync.Mutex // Separate mutex for ChannelList and listInProgress
	stopCh         chan struct{}
	maxMessages    int  // Maximum messages to store per channel
	maxLogs        int  // Maximum log entries to store
	listInProgress bool // Track if LIST command is in progress
}
