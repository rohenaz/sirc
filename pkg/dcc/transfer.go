package dcc

import (
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"time"
)

// NewTransfer creates a new DCC transfer
func NewTransfer(bot string, packNumber int, fileName string, fileSize int64, ip string, port int, savePath string) *Transfer {
	return &Transfer{
		ID:         fmt.Sprintf("%s-%d-%d", bot, packNumber, time.Now().Unix()),
		Bot:        bot,
		PackNumber: packNumber,
		FileName:   fileName,
		FileSize:   fileSize,
		IP:         ip,
		Port:       port,
		Status:     StatusPending,
		SavePath:   savePath,
		cancelCh:   make(chan struct{}),
		progressCh: make(chan int64, 100),
	}
}

// Start begins the DCC transfer
func (t *Transfer) Start() error {
	t.mu.Lock()
	if t.Status != StatusPending {
		t.mu.Unlock()
		return fmt.Errorf("transfer already started or completed")
	}
	t.Status = StatusConnecting
	t.StartTime = time.Now()
	t.mu.Unlock()

	// Check if file exists for resume support
	fullPath := filepath.Join(t.SavePath, t.FileName)
	resumePos := int64(0)

	fileInfo, err := os.Stat(fullPath)
	if err == nil && fileInfo.Size() < t.FileSize {
		resumePos = fileInfo.Size()
		t.mu.Lock()
		t.ResumePos = resumePos
		t.Downloaded = resumePos
		t.mu.Unlock()
		// TODO: Send DCC RESUME request to bot
	}

	// Connect to the DCC server
	address := fmt.Sprintf("%s:%d", t.IP, t.Port)
	conn, err := net.DialTimeout("tcp", address, 30*time.Second)
	if err != nil {
		t.mu.Lock()
		t.Status = StatusFailed
		t.Error = err.Error()
		t.mu.Unlock()
		return fmt.Errorf("failed to connect: %w", err)
	}

	t.mu.Lock()
	t.conn = conn
	t.Status = StatusActive
	t.mu.Unlock()

	// Start the download
	go t.download()

	return nil
}

// download performs the actual file download
func (t *Transfer) download() {
	defer func() {
		t.mu.Lock()
		if c, ok := t.conn.(net.Conn); ok {
			c.Close()
		}
		if t.Status == StatusActive {
			t.Status = StatusCompleted
			t.EndTime = time.Now()
		}
		t.mu.Unlock()
	}()

	t.mu.RLock()
	conn, ok := t.conn.(net.Conn)
	resumePos := t.ResumePos
	fullPath := filepath.Join(t.SavePath, t.FileName)
	t.mu.RUnlock()

	if !ok {
		t.mu.Lock()
		t.Status = StatusFailed
		t.Error = "invalid connection"
		t.mu.Unlock()
		return
	}

	// Ensure directory exists
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.mu.Lock()
		t.Status = StatusFailed
		t.Error = err.Error()
		t.mu.Unlock()
		return
	}

	// Open or create file
	var file *os.File
	var err error
	if resumePos > 0 {
		file, err = os.OpenFile(fullPath, os.O_WRONLY|os.O_APPEND, 0644)
	} else {
		file, err = os.Create(fullPath)
	}

	if err != nil {
		t.mu.Lock()
		t.Status = StatusFailed
		t.Error = err.Error()
		t.mu.Unlock()
		return
	}
	defer file.Close()

	// Download the file
	buffer := make([]byte, 32*1024) // 32KB buffer
	lastUpdate := time.Now()
	startBytes := resumePos

	for {
		select {
		case <-t.cancelCh:
			t.mu.Lock()
			t.Status = StatusCancelled
			t.mu.Unlock()
			return
		default:
		}

		n, err := conn.Read(buffer)
		if err != nil {
			if err != io.EOF {
				t.mu.Lock()
				t.Status = StatusFailed
				t.Error = err.Error()
				t.mu.Unlock()
			}
			return
		}

		if n > 0 {
			_, writeErr := file.Write(buffer[:n])
			if writeErr != nil {
				t.mu.Lock()
				t.Status = StatusFailed
				t.Error = writeErr.Error()
				t.mu.Unlock()
				return
			}

			t.mu.Lock()
			t.Downloaded += int64(n)

			// Calculate speed
			now := time.Now()
			duration := now.Sub(lastUpdate).Seconds()
			if duration >= 1.0 {
				bytesTransferred := t.Downloaded - startBytes
				t.Speed = int64(float64(bytesTransferred) / duration)
				lastUpdate = now
				startBytes = t.Downloaded
			}

			// Send progress update
			select {
			case t.progressCh <- t.Downloaded:
			default:
			}
			t.mu.Unlock()

			// Send acknowledgment (DCC protocol requirement)
			ack := uint32(t.Downloaded)
			conn.Write([]byte{
				byte(ack >> 24),
				byte(ack >> 16),
				byte(ack >> 8),
				byte(ack),
			})
		}
	}
}

// Cancel cancels the transfer
func (t *Transfer) Cancel() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.Status != StatusActive && t.Status != StatusConnecting {
		return fmt.Errorf("transfer not active")
	}

	close(t.cancelCh)
	t.Status = StatusCancelled

	if c, ok := t.conn.(net.Conn); ok {
		c.Close()
	}

	return nil
}

// Pause pauses the transfer
func (t *Transfer) Pause() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.Status != StatusActive {
		return fmt.Errorf("transfer not active")
	}

	close(t.cancelCh)
	t.Status = StatusPaused

	if c, ok := t.conn.(net.Conn); ok {
		c.Close()
	}

	return nil
}

// GetProgress returns the current download progress
func (t *Transfer) GetProgress() (downloaded, total int64, percent float64) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	downloaded = t.Downloaded
	total = t.FileSize
	if total > 0 {
		percent = float64(downloaded) / float64(total) * 100.0
	}
	return
}

// GetStatus returns the transfer status
func (t *Transfer) GetStatus() TransferStatus {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.Status
}

// GetSpeed returns the current transfer speed in bytes per second
func (t *Transfer) GetSpeed() int64 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.Speed
}
