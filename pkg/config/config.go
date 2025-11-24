package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// NotificationSettings configures desktop notification behavior
type NotificationSettings struct {
	Enabled           bool     `json:"enabled"`           // Master toggle for notifications
	MentionsOnly      bool     `json:"mentionsOnly"`      // Only notify for mentions and PMs
	Keywords          []string `json:"keywords"`          // Custom highlight keywords
	Sound             bool     `json:"sound"`             // Play sound on notification
	NotifyWhenFocused bool     `json:"notifyWhenFocused"` // Show notifications when window focused
}

// ReconnectSettings configures auto-reconnect behavior
type ReconnectSettings struct {
	Enabled     bool `json:"enabled"`     // Enable auto-reconnect globally
	MaxAttempts int  `json:"maxAttempts"` // Maximum reconnect attempts (default: 10)
	MaxBackoff  int  `json:"maxBackoff"`  // Maximum backoff in seconds (default: 60)
}

// InterfaceSettings configures UI behavior
type InterfaceSettings struct {
	Theme           string `json:"theme"`           // Theme name (default, dark, light)
	FontSize        int    `json:"fontSize"`        // Font size in pixels (default: 11)
	ShowTimestamps  bool   `json:"showTimestamps"`  // Show message timestamps
	Show24HourTime  bool   `json:"show24HourTime"`  // Use 24-hour time format
	ShowUserList    bool   `json:"showUserList"`    // Show user list sidebar
	ShowIRCLog      bool   `json:"showIRCLog"`      // Show IRC protocol log
	CompactMode     bool   `json:"compactMode"`     // Use compact message layout
	AnimatedAvatars bool   `json:"animatedAvatars"` // Animate user avatars (if any)
}

// ChatSettings configures chat behavior
type ChatSettings struct {
	MaxMessages      int    `json:"maxMessages"`      // Max messages to store per channel (default: 500)
	MaxLogs          int    `json:"maxLogs"`          // Max log entries to store (default: 200)
	AutoFocusInput   bool   `json:"autoFocusInput"`   // Auto-focus input after sending
	ShowJoinPart     bool   `json:"showJoinPart"`     // Show JOIN/PART messages
	ShowQuit         bool   `json:"showQuit"`         // Show QUIT messages
	ClickableURLs    bool   `json:"clickableURLs"`    // Make URLs clickable
	InlineImages     bool   `json:"inlineImages"`     // Show inline image previews
	EmojiEnabled     bool   `json:"emojiEnabled"`     // Enable emoji rendering
	CommandHistory   int    `json:"commandHistory"`   // Command history size (default: 50)
	DefaultQuitMsg   string `json:"defaultQuitMsg"`   // Default quit message
	DefaultPartMsg   string `json:"defaultPartMsg"`   // Default part message
}

// DownloadSettings configures XDCC download behavior
type DownloadSettings struct {
	DownloadPath       string `json:"downloadPath"`       // Default download directory
	MaxConcurrent      int    `json:"maxConcurrent"`      // Max concurrent downloads (default: 3)
	AutoAccept         bool   `json:"autoAccept"`         // Auto-accept downloads
	AutoRetry          bool   `json:"autoRetry"`          // Auto-retry failed downloads
	MaxRetries         int    `json:"maxRetries"`         // Max retry attempts (default: 3)
	SpeedLimitKBps     int    `json:"speedLimitKBps"`     // Download speed limit in KB/s (0 = unlimited)
	NotifyOnComplete   bool   `json:"notifyOnComplete"`   // Notify when download completes
	NotifyOnFail       bool   `json:"notifyOnFail"`       // Notify when download fails
}

// SecuritySettings configures security behavior
type SecuritySettings struct {
	VerifyCertificates bool `json:"verifyCertificates"` // Verify SSL certificates (default: false for IRC)
	AllowDCC           bool `json:"allowDCC"`           // Allow DCC connections
	AllowCTCP          bool `json:"allowCTCP"`          // Allow CTCP requests
	IgnoreList         []string `json:"ignoreList"`     // List of ignored nicknames/hosts
}

// Settings represents all application settings
type Settings struct {
	Notifications NotificationSettings `json:"notifications"`
	Reconnect     ReconnectSettings    `json:"reconnect"`
	Interface     InterfaceSettings    `json:"interface"`
	Chat          ChatSettings         `json:"chat"`
	Download      DownloadSettings     `json:"download"`
	Security      SecuritySettings     `json:"security"`
}

// DefaultSettings returns settings with sensible defaults
func DefaultSettings() *Settings {
	homeDir, _ := os.UserHomeDir()
	defaultDownloadPath := filepath.Join(homeDir, "Downloads", "SIRC")

	return &Settings{
		Notifications: NotificationSettings{
			Enabled:           true,
			MentionsOnly:      true,
			Keywords:          []string{},
			Sound:             false,
			NotifyWhenFocused: false,
		},
		Reconnect: ReconnectSettings{
			Enabled:     true,
			MaxAttempts: 10,
			MaxBackoff:  60,
		},
		Interface: InterfaceSettings{
			Theme:           "default",
			FontSize:        11,
			ShowTimestamps:  true,
			Show24HourTime:  true,
			ShowUserList:    true,
			ShowIRCLog:      false,
			CompactMode:     false,
			AnimatedAvatars: true,
		},
		Chat: ChatSettings{
			MaxMessages:    500,
			MaxLogs:        200,
			AutoFocusInput: true,
			ShowJoinPart:   false,
			ShowQuit:       false,
			ClickableURLs:  true,
			InlineImages:   false,
			EmojiEnabled:   true,
			CommandHistory: 50,
			DefaultQuitMsg: "Goodbye",
			DefaultPartMsg: "Leaving",
		},
		Download: DownloadSettings{
			DownloadPath:     defaultDownloadPath,
			MaxConcurrent:    3,
			AutoAccept:       false,
			AutoRetry:        true,
			MaxRetries:       3,
			SpeedLimitKBps:   0,
			NotifyOnComplete: true,
			NotifyOnFail:     true,
		},
		Security: SecuritySettings{
			VerifyCertificates: false,
			AllowDCC:           true,
			AllowCTCP:          true,
			IgnoreList:         []string{},
		},
	}
}

// Config handles persistent storage of application settings
type Config struct {
	configDir string
}

// NewConfig creates a new config instance
func NewConfig() (*Config, error) {
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

	return &Config{
		configDir: configDir,
	}, nil
}

// SaveSettings saves settings to disk
func (c *Config) SaveSettings(settings *Settings) error {
	filePath := filepath.Join(c.configDir, "settings.json")

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write settings file: %w", err)
	}

	return nil
}

// LoadSettings loads settings from disk
func (c *Config) LoadSettings() (*Settings, error) {
	filePath := filepath.Join(c.configDir, "settings.json")

	// If file doesn't exist, return default settings
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return DefaultSettings(), nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read settings file: %w", err)
	}

	var settings Settings
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, fmt.Errorf("failed to unmarshal settings: %w", err)
	}

	return &settings, nil
}

// GetConfigDir returns the config directory path
func (c *Config) GetConfigDir() string {
	return c.configDir
}
