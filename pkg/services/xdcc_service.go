package services

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"sirc/pkg/dcc"
	"sirc/pkg/download"
)

// XDCCService provides XDCC functionality to the frontend
type XDCCService struct {
	ircService      *IRCService
	downloadManager *download.Manager
	app             *application.App
}

// NewXDCCService creates a new XDCC service
func NewXDCCService(ircService *IRCService, downloadManager *download.Manager, app *application.App) *XDCCService {
	return &XDCCService{
		ircService:      ircService,
		downloadManager: downloadManager,
		app:             app,
	}
}

// RequestPack requests an XDCC pack from a bot
func (s *XDCCService) RequestPack(serverID, bot string, packNumber int) error {
	// Send XDCC request via IRC
	command := fmt.Sprintf("XDCC SEND %d", packNumber)
	err := s.ircService.SendCTCP(serverID, bot, command)
	if err != nil {
		return fmt.Errorf("failed to send XDCC request: %w", err)
	}

	return nil
}

// ParseDCCSend parses a DCC SEND message and starts the download
// This would typically be called when receiving a CTCP DCC SEND message
func (s *XDCCService) ParseDCCSend(serverID, bot, message string) error {
	// Parse DCC SEND message format:
	// DCC SEND filename ip port filesize
	parts := strings.Fields(message)
	if len(parts) < 5 || parts[0] != "DCC" || parts[1] != "SEND" {
		return fmt.Errorf("invalid DCC SEND message")
	}

	fileName := parts[2]
	// Remove quotes if present
	fileName = strings.Trim(fileName, "\"")

	var ip string
	var port int
	var fileSize int64

	// Parse IP (could be decimal or dotted notation)
	fmt.Sscanf(parts[3], "%s", &ip)
	fmt.Sscanf(parts[4], "%d", &port)
	if len(parts) > 5 {
		fmt.Sscanf(parts[5], "%d", &fileSize)
	}

	// Convert decimal IP to dotted notation if needed
	if !strings.Contains(ip, ".") {
		var ipNum uint32
		fmt.Sscanf(ip, "%d", &ipNum)
		ip = fmt.Sprintf("%d.%d.%d.%d",
			(ipNum>>24)&0xFF,
			(ipNum>>16)&0xFF,
			(ipNum>>8)&0xFF,
			ipNum&0xFF)
	}

	// Create and add transfer
	savePath := filepath.Join("./downloads", serverID)
	transfer := dcc.NewTransfer(bot, 0, fileName, fileSize, ip, port, savePath)

	return s.downloadManager.AddTransfer(transfer)
}

// GetDownloads returns all downloads
func (s *XDCCService) GetDownloads() []*dcc.Transfer {
	return s.downloadManager.GetTransfers()
}

// PauseDownload pauses a download
func (s *XDCCService) PauseDownload(transferID string) error {
	return s.downloadManager.PauseTransfer(transferID)
}

// ResumeDownload resumes a download
func (s *XDCCService) ResumeDownload(transferID string) error {
	return s.downloadManager.ResumeTransfer(transferID)
}

// CancelDownload cancels and removes a download
func (s *XDCCService) CancelDownload(transferID string) error {
	return s.downloadManager.RemoveTransfer(transferID)
}

// SetMaxConcurrentDownloads sets the maximum number of concurrent downloads
func (s *XDCCService) SetMaxConcurrentDownloads(max int) error {
	if max < 1 {
		return fmt.Errorf("max concurrent downloads must be at least 1")
	}
	s.downloadManager.SetMaxConcurrent(max)
	return nil
}
