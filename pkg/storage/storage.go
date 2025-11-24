package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"sirc/pkg/irc"
)

// Storage handles persistent storage of application data
type Storage struct {
	configDir string
}

// NewStorage creates a new storage instance
func NewStorage() (*Storage, error) {
	// Get OS-specific config directory
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user config directory: %w", err)
	}

	configDir := filepath.Join(userConfigDir, "sirc")

	// Create config directory if it doesn't exist
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	return &Storage{
		configDir: configDir,
	}, nil
}

// SaveServers saves servers to disk
func (s *Storage) SaveServers(servers []*irc.Server) error {
	filePath := filepath.Join(s.configDir, "servers.json")

	data, err := json.MarshalIndent(servers, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal servers: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write servers file: %w", err)
	}

	return nil
}

// LoadServers loads servers from disk
func (s *Storage) LoadServers() ([]*irc.Server, error) {
	filePath := filepath.Join(s.configDir, "servers.json")

	// If file doesn't exist, return empty slice
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return []*irc.Server{}, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read servers file: %w", err)
	}

	var servers []*irc.Server
	if err := json.Unmarshal(data, &servers); err != nil {
		return nil, fmt.Errorf("failed to unmarshal servers: %w", err)
	}

	return servers, nil
}

// GetConfigDir returns the config directory path
func (s *Storage) GetConfigDir() string {
	return s.configDir
}
