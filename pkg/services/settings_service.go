package services

import (
	"log"
	"sync"

	"sirc/pkg/config"
)

// SettingsService provides settings management functionality to the frontend
type SettingsService struct {
	config   *config.Config
	settings *config.Settings
	mu       sync.RWMutex
}

// NewSettingsService creates a new settings service
func NewSettingsService() *SettingsService {
	// Initialize config
	cfg, err := config.NewConfig()
	if err != nil {
		log.Printf("Failed to initialize config: %v", err)
		// Return service with default settings
		return &SettingsService{
			settings: config.DefaultSettings(),
		}
	}

	// Load settings
	settings, err := cfg.LoadSettings()
	if err != nil {
		log.Printf("Failed to load settings: %v", err)
		settings = config.DefaultSettings()
	}

	log.Printf("Loaded settings from %s", cfg.GetConfigDir())

	return &SettingsService{
		config:   cfg,
		settings: settings,
	}
}

// GetSettings returns the current settings
func (s *SettingsService) GetSettings() (*config.Settings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.settings, nil
}

// SaveSettings saves the settings to disk
func (s *SettingsService) SaveSettings(settings *config.Settings) error {
	s.mu.Lock()
	s.settings = settings
	s.mu.Unlock()

	if s.config == nil {
		return nil // Config not available, settings only in memory
	}

	if err := s.config.SaveSettings(settings); err != nil {
		log.Printf("Failed to save settings: %v", err)
		return err
	}

	log.Printf("Settings saved successfully")
	return nil
}

// ResetSettings resets settings to defaults
func (s *SettingsService) ResetSettings() error {
	defaults := config.DefaultSettings()
	return s.SaveSettings(defaults)
}

// GetNotificationSettings returns notification settings
func (s *SettingsService) GetNotificationSettings() (*config.NotificationSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &s.settings.Notifications, nil
}

// UpdateNotificationSettings updates notification settings
func (s *SettingsService) UpdateNotificationSettings(settings *config.NotificationSettings) error {
	s.mu.Lock()
	s.settings.Notifications = *settings
	s.mu.Unlock()

	if s.config != nil {
		return s.config.SaveSettings(s.settings)
	}
	return nil
}

// GetReconnectSettings returns reconnect settings
func (s *SettingsService) GetReconnectSettings() (*config.ReconnectSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &s.settings.Reconnect, nil
}

// UpdateReconnectSettings updates reconnect settings
func (s *SettingsService) UpdateReconnectSettings(settings *config.ReconnectSettings) error {
	s.mu.Lock()
	s.settings.Reconnect = *settings
	s.mu.Unlock()

	if s.config != nil {
		return s.config.SaveSettings(s.settings)
	}
	return nil
}

// GetInterfaceSettings returns interface settings
func (s *SettingsService) GetInterfaceSettings() (*config.InterfaceSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &s.settings.Interface, nil
}

// UpdateInterfaceSettings updates interface settings
func (s *SettingsService) UpdateInterfaceSettings(settings *config.InterfaceSettings) error {
	s.mu.Lock()
	s.settings.Interface = *settings
	s.mu.Unlock()

	if s.config != nil {
		return s.config.SaveSettings(s.settings)
	}
	return nil
}

// GetChatSettings returns chat settings
func (s *SettingsService) GetChatSettings() (*config.ChatSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &s.settings.Chat, nil
}

// UpdateChatSettings updates chat settings
func (s *SettingsService) UpdateChatSettings(settings *config.ChatSettings) error {
	s.mu.Lock()
	s.settings.Chat = *settings
	s.mu.Unlock()

	if s.config != nil {
		return s.config.SaveSettings(s.settings)
	}
	return nil
}

// GetDownloadSettings returns download settings
func (s *SettingsService) GetDownloadSettings() (*config.DownloadSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &s.settings.Download, nil
}

// UpdateDownloadSettings updates download settings
func (s *SettingsService) UpdateDownloadSettings(settings *config.DownloadSettings) error {
	s.mu.Lock()
	s.settings.Download = *settings
	s.mu.Unlock()

	if s.config != nil {
		return s.config.SaveSettings(s.settings)
	}
	return nil
}

// GetSecuritySettings returns security settings
func (s *SettingsService) GetSecuritySettings() (*config.SecuritySettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return &s.settings.Security, nil
}

// UpdateSecuritySettings updates security settings
func (s *SettingsService) UpdateSecuritySettings(settings *config.SecuritySettings) error {
	s.mu.Lock()
	s.settings.Security = *settings
	s.mu.Unlock()

	if s.config != nil {
		return s.config.SaveSettings(s.settings)
	}
	return nil
}

// ExportSettings exports settings as JSON string
func (s *SettingsService) ExportSettings() (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Settings are already JSON-serializable
	return "", nil // Implementation could be added if needed
}

// ImportSettings imports settings from JSON string
func (s *SettingsService) ImportSettings(jsonData string) error {
	// Implementation could be added if needed
	return nil
}
