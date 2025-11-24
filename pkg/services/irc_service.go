package services

import (
	"fmt"
	"log"
	"sync"

	"sirc/pkg/irc"
	"sirc/pkg/storage"
)

// IRCService provides IRC functionality to the frontend
type IRCService struct {
	clients map[string]*irc.Client
	servers map[string]*irc.Server
	storage *storage.Storage
	mu      sync.RWMutex
}

// NewIRCService creates a new IRC service
func NewIRCService() *IRCService {
	// Initialize storage
	stor, err := storage.NewStorage()
	if err != nil {
		log.Printf("Failed to initialize storage: %v", err)
		// Continue without persistence
		return &IRCService{
			clients: make(map[string]*irc.Client),
			servers: make(map[string]*irc.Server),
		}
	}

	// Load saved servers
	savedServers, err := stor.LoadServers()
	if err != nil {
		log.Printf("Failed to load servers: %v", err)
		savedServers = []*irc.Server{}
	}

	// Convert to map
	serverMap := make(map[string]*irc.Server)
	for _, srv := range savedServers {
		serverMap[srv.ID] = srv
	}

	log.Printf("Loaded %d saved servers from %s", len(savedServers), stor.GetConfigDir())

	return &IRCService{
		clients: make(map[string]*irc.Client),
		servers: serverMap,
		storage: stor,
	}
}

// saveServers persists the current server list to disk
func (s *IRCService) saveServers() error {
	if s.storage == nil {
		return nil // Storage not available
	}

	servers := make([]*irc.Server, 0, len(s.servers))
	for _, srv := range s.servers {
		servers = append(servers, srv)
	}

	return s.storage.SaveServers(servers)
}

// AddServer adds a new IRC server
func (s *IRCService) AddServer(server *irc.Server) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.servers[server.ID]; exists {
		return fmt.Errorf("server already exists: %s", server.ID)
	}

	s.servers[server.ID] = server

	// Persist to disk
	if err := s.saveServers(); err != nil {
		log.Printf("Failed to save servers: %v", err)
	}

	return nil
}

// RemoveServer removes an IRC server
func (s *IRCService) RemoveServer(serverID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Disconnect if connected
	if client, exists := s.clients[serverID]; exists {
		client.Disconnect()
		delete(s.clients, serverID)
	}

	delete(s.servers, serverID)

	// Persist to disk
	if err := s.saveServers(); err != nil {
		log.Printf("Failed to save servers: %v", err)
	}

	return nil
}

// GetServers returns all configured servers
func (s *IRCService) GetServers() []*irc.Server {
	s.mu.RLock()
	defer s.mu.RUnlock()

	servers := make([]*irc.Server, 0, len(s.servers))
	for _, srv := range s.servers {
		servers = append(servers, srv)
	}
	return servers
}

// Connect connects to an IRC server
// Connections are made asynchronously to allow multiple servers to connect concurrently
func (s *IRCService) Connect(serverID string) error {
	s.mu.RLock()
	server, exists := s.servers[serverID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("server not found: %s", serverID)
	}

	client := irc.NewClient(server)

	// Register client immediately so UI shows connecting state
	s.mu.Lock()
	s.clients[serverID] = client
	s.mu.Unlock()

	// Connect asynchronously to avoid blocking
	// This allows multiple servers to connect concurrently
	go func() {
		err := client.Connect()
		if err != nil {
			log.Printf("[IRCService] Failed to connect to %s: %v", serverID, err)
			// Client state will show as disconnected/error
		}
	}()

	return nil
}

// Disconnect disconnects from an IRC server
func (s *IRCService) Disconnect(serverID string) error {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("not connected to server: %s", serverID)
	}

	err := client.Disconnect()
	if err != nil {
		return err
	}

	s.mu.Lock()
	delete(s.clients, serverID)
	s.mu.Unlock()

	return nil
}

// JoinChannel joins a channel on a server
func (s *IRCService) JoinChannel(serverID, channel string) error {
	log.Printf("[IRCService] JoinChannel called: serverID=%s, channel=%s", serverID, channel)

	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		log.Printf("[IRCService] JoinChannel: client not found for serverID=%s", serverID)
		return fmt.Errorf("not connected to server: %s", serverID)
	}

	log.Printf("[IRCService] JoinChannel: calling client.JoinChannel for %s", channel)
	err := client.JoinChannel(channel)
	if err != nil {
		log.Printf("[IRCService] JoinChannel: error from client.JoinChannel: %v", err)
	} else {
		log.Printf("[IRCService] JoinChannel: client.JoinChannel returned successfully")
	}
	return err
}

// PartChannel leaves a channel
func (s *IRCService) PartChannel(serverID, channel string) error {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("not connected to server: %s", serverID)
	}

	return client.PartChannel(channel)
}

// SendMessage sends a message to a channel or user
func (s *IRCService) SendMessage(serverID, target, message string) error {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("not connected to server: %s", serverID)
	}

	return client.SendMessage(target, message)
}

// SendCTCP sends a CTCP command
func (s *IRCService) SendCTCP(serverID, target, command string) error {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("not connected to server: %s", serverID)
	}

	return client.SendCTCP(target, command)
}

// GetChannels returns joined channels for a server
func (s *IRCService) GetChannels(serverID string) ([]*irc.Channel, error) {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("not connected to server: %s", serverID)
	}

	return client.GetChannels(), nil
}

// GetClient returns the IRC client for a server
func (s *IRCService) GetClient(serverID string) (*irc.Client, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	client, exists := s.clients[serverID]
	if !exists {
		return nil, fmt.Errorf("not connected to server: %s", serverID)
	}

	return client, nil
}

// GetConnectionState returns the connection state for a server
func (s *IRCService) GetConnectionState(serverID string) (string, error) {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return "disconnected", nil
	}

	state := client.GetState()
	switch state {
	case irc.Disconnected:
		return "disconnected", nil
	case irc.Connecting:
		return "connecting", nil
	case irc.Connected:
		return "connected", nil
	case irc.Registered:
		return "registered", nil
	default:
		return "unknown", nil
	}
}

// GetMessages returns messages for a specific channel
func (s *IRCService) GetMessages(serverID, channelName string) ([]*irc.Message, error) {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("not connected to server: %s", serverID)
	}

	return client.GetMessages(channelName)
}

// GetLogs returns IRC protocol logs for a server
func (s *IRCService) GetLogs(serverID string) ([]*irc.LogEntry, error) {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return []*irc.LogEntry{}, nil // Return empty array instead of error
	}

	return client.GetLogs(), nil
}

// ListChannels requests the channel list from a server
func (s *IRCService) ListChannels(serverID string) error {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return fmt.Errorf("not connected to server: %s", serverID)
	}

	return client.ListChannels()
}

// GetChannelList returns the stored channel list for a server
func (s *IRCService) GetChannelList(serverID string) ([]*irc.Channel, error) {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return []*irc.Channel{}, nil // Return empty array instead of error
	}

	return client.GetChannelList(), nil
}

// IsChannelListInProgress returns true if a channel list request is still in progress
func (s *IRCService) IsChannelListInProgress(serverID string) (bool, error) {
	s.mu.RLock()
	client, exists := s.clients[serverID]
	s.mu.RUnlock()

	if !exists {
		return false, nil // Not connected = not in progress
	}

	return client.IsListInProgress(), nil
}

// GetServerTemplates returns available server templates/presets
func (s *IRCService) GetServerTemplates() []irc.ServerTemplate {
	return irc.GetServerTemplates()
}

// GetCurrentNick returns the current nickname for a server
func (s *IRCService) GetCurrentNick(serverID string) (string, error) {
	s.mu.RLock()
	server, exists := s.servers[serverID]
	s.mu.RUnlock()

	if !exists {
		return "", fmt.Errorf("server not found: %s", serverID)
	}

	return server.Nick, nil
}
