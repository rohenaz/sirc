package download

import (
	"fmt"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"sirc/pkg/dcc"
)

// Manager manages download queue and transfers
type Manager struct {
	transfers      map[string]*dcc.Transfer
	queue          []*dcc.Transfer
	maxConcurrent  int
	activeCount    int
	savePath       string
	mu             sync.RWMutex
	app            *application.App
}

// NewManager creates a new download manager
func NewManager(savePath string, maxConcurrent int, app *application.App) *Manager {
	return &Manager{
		transfers:     make(map[string]*dcc.Transfer),
		queue:         make([]*dcc.Transfer, 0),
		maxConcurrent: maxConcurrent,
		savePath:      savePath,
		app:           app,
	}
}

// AddTransfer adds a transfer to the queue
func (m *Manager) AddTransfer(transfer *dcc.Transfer) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.transfers[transfer.ID]; exists {
		return fmt.Errorf("transfer already exists: %s", transfer.ID)
	}

	m.transfers[transfer.ID] = transfer
	m.queue = append(m.queue, transfer)

	// TODO: Emit event to frontend
	// Event system will be added later

	// Try to start the transfer if we have capacity
	m.processQueue()

	return nil
}

// RemoveTransfer removes a transfer from the manager
func (m *Manager) RemoveTransfer(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	transfer, exists := m.transfers[id]
	if !exists {
		return fmt.Errorf("transfer not found: %s", id)
	}

	// Cancel if active
	if transfer.Status == dcc.StatusActive || transfer.Status == dcc.StatusConnecting {
		transfer.Cancel()
		m.activeCount--
	}

	// Remove from queue
	for i, t := range m.queue {
		if t.ID == id {
			m.queue = append(m.queue[:i], m.queue[i+1:]...)
			break
		}
	}

	delete(m.transfers, id)

	// TODO: Emit event to frontend

	// Try to start next queued transfer
	m.processQueue()

	return nil
}

// PauseTransfer pauses a transfer
func (m *Manager) PauseTransfer(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	transfer, exists := m.transfers[id]
	if !exists {
		return fmt.Errorf("transfer not found: %s", id)
	}

	err := transfer.Pause()
	if err == nil {
		m.activeCount--
		m.processQueue()

		// TODO: Emit pause event
	}

	return err
}

// ResumeTransfer resumes a paused transfer
func (m *Manager) ResumeTransfer(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	transfer, exists := m.transfers[id]
	if !exists {
		return fmt.Errorf("transfer not found: %s", id)
	}

	if transfer.Status != dcc.StatusPaused {
		return fmt.Errorf("transfer not paused")
	}

	// Reset status to pending so it gets picked up by processQueue
	transfer.Status = dcc.StatusPending

	m.processQueue()

	return nil
}

// processQueue starts transfers if there's capacity
func (m *Manager) processQueue() {
	for m.activeCount < m.maxConcurrent {
		var nextTransfer *dcc.Transfer

		for _, t := range m.queue {
			if t.Status == dcc.StatusPending {
				nextTransfer = t
				break
			}
		}

		if nextTransfer == nil {
			break
		}

		m.activeCount++

		// Start transfer in goroutine
		go func(transfer *dcc.Transfer) {
			err := transfer.Start()
			if err != nil {
				m.mu.Lock()
				m.activeCount--
				m.mu.Unlock()
				// TODO: Emit error event
			} else {
				// Monitor transfer progress
				m.monitorTransfer(transfer)
			}
		}(nextTransfer)
	}
}

// monitorTransfer monitors a transfer and emits progress events
func (m *Manager) monitorTransfer(transfer *dcc.Transfer) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			status := transfer.GetStatus()
			// TODO: Emit progress event

			// Check if transfer is done
			if status == dcc.StatusCompleted ||
				status == dcc.StatusFailed ||
				status == dcc.StatusCancelled {

				m.mu.Lock()
				m.activeCount--
				m.mu.Unlock()

				// TODO: Emit completion event

				// Process next in queue
				m.mu.Lock()
				m.processQueue()
				m.mu.Unlock()

				return
			}
		}
	}
}

// GetTransfers returns all transfers
func (m *Manager) GetTransfers() []*dcc.Transfer {
	m.mu.RLock()
	defer m.mu.RUnlock()

	transfers := make([]*dcc.Transfer, 0, len(m.transfers))
	for _, t := range m.transfers {
		transfers = append(transfers, t)
	}
	return transfers
}

// GetTransfer returns a specific transfer
func (m *Manager) GetTransfer(id string) (*dcc.Transfer, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	transfer, exists := m.transfers[id]
	if !exists {
		return nil, fmt.Errorf("transfer not found: %s", id)
	}

	return transfer, nil
}

// SetMaxConcurrent sets the maximum number of concurrent downloads
func (m *Manager) SetMaxConcurrent(max int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.maxConcurrent = max
	m.processQueue()
}
