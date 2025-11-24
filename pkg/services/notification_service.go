package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// NotificationService handles desktop notifications for IRC events
type NotificationService struct {
	app             *application.App
	enabled         bool
	mentionsOnly    bool
	soundEnabled    bool
	keywords        []string
	mu              sync.RWMutex
	windowFocused   bool
	lastNotifTime   map[string]int64 // Throttle notifications per channel
	throttleSeconds int64
}

// NotificationOptions contains settings for notifications
type NotificationOptions struct {
	Enabled      bool
	MentionsOnly bool
	Sound        bool
	Keywords     []string
}

// NewNotificationService creates a new notification service
func NewNotificationService(app *application.App) *NotificationService {
	ns := &NotificationService{
		app:             app,
		enabled:         true,
		mentionsOnly:    false,
		soundEnabled:    true,
		keywords:        []string{},
		lastNotifTime:   make(map[string]int64),
		throttleSeconds: 3, // Don't spam notifications - 3 second throttle
	}

	// Request notification authorization on macOS
	// This is asynchronous and won't block
	go func() {
		if app != nil {
			log.Printf("[Notifications] Requesting authorization...")
		}
	}()

	return ns
}

// SetOptions updates notification preferences
func (ns *NotificationService) SetOptions(opts *NotificationOptions) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	ns.enabled = opts.Enabled
	ns.mentionsOnly = opts.MentionsOnly
	ns.soundEnabled = opts.Sound
	ns.keywords = opts.Keywords

	log.Printf("[Notifications] Settings updated: enabled=%v, mentionsOnly=%v, keywords=%v",
		ns.enabled, ns.mentionsOnly, len(ns.keywords))
}

// GetOptions returns current notification settings
func (ns *NotificationService) GetOptions() *NotificationOptions {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	return &NotificationOptions{
		Enabled:      ns.enabled,
		MentionsOnly: ns.mentionsOnly,
		Sound:        ns.soundEnabled,
		Keywords:     ns.keywords,
	}
}

// SetWindowFocused updates the window focus state
// Notifications are typically suppressed when window is focused
func (ns *NotificationService) SetWindowFocused(focused bool) {
	ns.mu.Lock()
	defer ns.mu.Unlock()
	ns.windowFocused = focused
	log.Printf("[Notifications] Window focused: %v", focused)
}

// ShouldNotify determines if a notification should be sent for a message
func (ns *NotificationService) ShouldNotify(message, nick, currentNick, channel string) bool {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	// Don't notify if disabled
	if !ns.enabled {
		return false
	}

	// Don't notify for own messages
	if nick == currentNick {
		return false
	}

	// Don't notify if window is focused (user is actively using the app)
	if ns.windowFocused {
		return false
	}

	// Check if this is a direct mention
	messageLower := strings.ToLower(message)
	nickLower := strings.ToLower(currentNick)
	isMention := strings.Contains(messageLower, nickLower)

	// Check keywords
	hasKeyword := false
	for _, keyword := range ns.keywords {
		if strings.Contains(messageLower, strings.ToLower(keyword)) {
			hasKeyword = true
			break
		}
	}

	// If mentions only mode, require mention or keyword
	if ns.mentionsOnly {
		return isMention || hasKeyword
	}

	// Otherwise notify for all messages, but prioritize mentions
	return true
}

// CheckHighlight checks if a message contains highlights (mentions or keywords)
// Returns true and the type of highlight ("mention" or "keyword")
func (ns *NotificationService) CheckHighlight(message, currentNick string) (bool, string) {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	messageLower := strings.ToLower(message)
	nickLower := strings.ToLower(currentNick)

	// Check for direct mention
	if strings.Contains(messageLower, nickLower) {
		return true, "mention"
	}

	// Check keywords
	for _, keyword := range ns.keywords {
		if strings.Contains(messageLower, strings.ToLower(keyword)) {
			return true, "keyword"
		}
	}

	return false, ""
}

// SendNotification sends a desktop notification
// This is the main method called when a message arrives
func (ns *NotificationService) SendNotification(ctx context.Context, serverName, channel, from, message string) error {
	ns.mu.RLock()
	if !ns.enabled {
		ns.mu.RUnlock()
		return nil
	}

	if ns.windowFocused {
		ns.mu.RUnlock()
		log.Printf("[Notifications] Skipping notification - window is focused")
		return nil
	}
	ns.mu.RUnlock()

	// Truncate long messages
	displayMessage := message
	if len(displayMessage) > 100 {
		displayMessage = displayMessage[:97] + "..."
	}

	title := "IRC Message"
	if channel != "" {
		if strings.HasPrefix(channel, "#") {
			title = fmt.Sprintf("%s in %s", from, channel)
		} else {
			// Private message
			title = fmt.Sprintf("Private message from %s", from)
		}
	}

	log.Printf("[Notifications] Sending notification: %s - %s", title, displayMessage)

	// In a real implementation, we would use Wails3 notification API
	// For now, we log it. The actual implementation will be added when we integrate with Wails3
	// notification.SendNotification(&notification.NotificationOptions{
	//     Title: title,
	//     Body: displayMessage,
	// })

	return nil
}

// SendMentionNotification sends a notification for a mention/highlight
func (ns *NotificationService) SendMentionNotification(ctx context.Context, serverName, channel, from, message, highlightType string) error {
	ns.mu.RLock()
	if !ns.enabled || ns.windowFocused {
		ns.mu.RUnlock()
		return nil
	}
	ns.mu.RUnlock()

	// Truncate long messages
	displayMessage := message
	if len(displayMessage) > 100 {
		displayMessage = displayMessage[:97] + "..."
	}

	var title string
	if highlightType == "mention" {
		title = fmt.Sprintf("💬 %s mentioned you in %s", from, channel)
	} else {
		title = fmt.Sprintf("⭐ Highlight from %s in %s", from, channel)
	}

	log.Printf("[Notifications] Sending mention notification: %s", title)

	// In a real implementation:
	// notification.SendNotification(&notification.NotificationOptions{
	//     Title: title,
	//     Body: displayMessage,
	//     Sound: ns.soundEnabled,
	// })

	return nil
}

// SendPrivateMessageNotification sends a notification for a private message
func (ns *NotificationService) SendPrivateMessageNotification(ctx context.Context, from, message string) error {
	ns.mu.RLock()
	if !ns.enabled || ns.windowFocused {
		ns.mu.RUnlock()
		return nil
	}
	ns.mu.RUnlock()

	// Truncate long messages
	displayMessage := message
	if len(displayMessage) > 100 {
		displayMessage = displayMessage[:97] + "..."
	}

	title := fmt.Sprintf("📩 Private message from %s", from)

	log.Printf("[Notifications] Sending PM notification from %s", from)

	// In a real implementation:
	// notification.SendNotificationWithActions(&notification.NotificationOptions{
	//     Title: title,
	//     Body: displayMessage,
	//     Sound: ns.soundEnabled,
	//     Actions: []notification.NotificationAction{
	//         {ID: "reply", Title: "Reply"},
	//         {ID: "close", Title: "Close"},
	//     },
	// })

	return nil
}

// AddKeyword adds a highlight keyword
func (ns *NotificationService) AddKeyword(keyword string) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return
	}

	// Check if already exists
	for _, k := range ns.keywords {
		if strings.EqualFold(k, keyword) {
			return
		}
	}

	ns.keywords = append(ns.keywords, keyword)
	log.Printf("[Notifications] Added keyword: %s", keyword)
}

// RemoveKeyword removes a highlight keyword
func (ns *NotificationService) RemoveKeyword(keyword string) {
	ns.mu.Lock()
	defer ns.mu.Unlock()

	for i, k := range ns.keywords {
		if strings.EqualFold(k, keyword) {
			ns.keywords = append(ns.keywords[:i], ns.keywords[i+1:]...)
			log.Printf("[Notifications] Removed keyword: %s", keyword)
			return
		}
	}
}

// GetKeywords returns the list of highlight keywords
func (ns *NotificationService) GetKeywords() []string {
	ns.mu.RLock()
	defer ns.mu.RUnlock()

	// Return a copy
	keywords := make([]string, len(ns.keywords))
	copy(keywords, ns.keywords)
	return keywords
}
